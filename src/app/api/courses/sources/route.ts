export const runtime = "edge";

type WebSearchResult = {
  title?: string;
  url: string;
  snippet?: string;
  displayLink?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") ?? "").trim();
  const authed = (searchParams.get("authed") ?? "").trim() === "1";

  if (!courseId) {
    return json({ success: false, error: "Missing courseId" }, { status: 400 });
  }

  // Authenticated users should not touch Redis.
  // Currently, only the guest flow persists search metadata in Redis.
  // For authed users we return an empty result set (UI should treat it as best-effort).
  if (authed) {
    return json({
      success: true,
      courseId,
      query: null,
      results: [],
      from: "none",
    });
  }

  const { Redis } = await import("@upstash/redis");
  const redis = Redis.fromEnv();

  // Stored by /api/generate during streaming.
  const raw = (await redis.get(`course:search:${courseId}`)) as {
    query?: string;
    results?: WebSearchResult[];
  } | null;

  const results = Array.isArray(raw?.results) ? raw!.results! : [];

  // Minimal sanitization/shape guarantee.
  const safeResults = results
    .map((r) => {
      const url = typeof r?.url === "string" ? r.url.trim() : "";
      if (!url) return null;
      return {
        url,
        title: typeof r?.title === "string" ? r.title.trim() : undefined,
        snippet: typeof r?.snippet === "string" ? r.snippet.trim() : undefined,
        displayLink:
          typeof r?.displayLink === "string" ? r.displayLink.trim() : undefined,
      };
    })
    .filter(Boolean) as WebSearchResult[];

  return json({
    success: true,
    courseId,
    query: raw?.query ?? null,
    results: safeResults,
    from: "redis",
  });
}
