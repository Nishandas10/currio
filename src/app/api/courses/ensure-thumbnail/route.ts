import { Redis } from "@upstash/redis";
import { fetchWithRetry } from "@/lib/utils";

export const runtime = "edge";

const redis = Redis.fromEnv();

type EnsureThumbnailBody = {
  courseId: string;
};

/**
 * Ensures a course has a persisted thumbnail.
 *
 * Contract:
 * - Input: { courseId }
 * - Output: { success: true, courseImage } where courseImage is base64 PNG (no data: prefix)
 * - Behavior: If course already has courseImage in Redis, returns it without regenerating.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<EnsureThumbnailBody>;
    const courseId = (body.courseId ?? "").trim();

    if (!courseId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing courseId" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const key = `course:${courseId}`;
    const metaKey = `course:meta:${courseId}`;
    const lockKey = `course:thumb:lock:${courseId}`;

    // During streaming, the full course object may not exist yet.
    // We still want to generate the thumbnail immediately.
    const course = (await redis.get(key)) as Record<string, unknown> | null;
    const meta = (await redis.get(metaKey)) as Record<string, unknown> | null;

    const existing =
      typeof course?.courseImage === "string"
        ? (course.courseImage as string)
        : "";
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, courseImage: existing, cached: true }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // If another request is already generating a thumbnail, wait briefly and re-check.
    // This prevents double-generation during navigation (Home -> /course/[id]) or fast rerenders.
    const locked = await redis.get(lockKey);
    if (locked) {
      // Simple wait + re-check loop (max ~2s)
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const again = (await redis.get(key)) as Record<string, unknown> | null;
        const img =
          typeof again?.courseImage === "string"
            ? (again.courseImage as string)
            : "";
        if (img) {
          return new Response(
            JSON.stringify({ success: true, courseImage: img, cached: true }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
      }
      // If still not ready, let this request proceed to generate (lock may have expired).
    }

    // Acquire lock (best-effort).
    // Use nx: true to ensure only one process generates the thumbnail.
    // Set a short expiry (e.g., 30s) to prevent deadlocks if the process crashes.
    const acquired = await redis.set(lockKey, Date.now(), { nx: true, ex: 30 });

    if (!acquired) {
      // If we failed to acquire the lock, it means someone else just took it.
      // We should enter the wait loop.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const again = (await redis.get(key)) as Record<string, unknown> | null;
        const img =
          typeof again?.courseImage === "string"
            ? (again.courseImage as string)
            : "";
        if (img) {
          return new Response(
            JSON.stringify({ success: true, courseImage: img, cached: true }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
      }
      // If still not ready after waiting, we could error out or try generating.
      // Let's error out to avoid double generation.
      return new Response(
        JSON.stringify({
          success: false,
          error: "Thumbnail generation timed out",
        }),
        { status: 408, headers: { "content-type": "application/json" } }
      );
    }

    // Choose the best-available prompt:
    // 1) courseTitle (when full course exists)
    // 2) initial user prompt stored in meta (available immediately)
    const title =
      typeof course?.courseTitle === "string"
        ? (course.courseTitle as string)
        : "";
    const fallbackPrompt =
      typeof meta?.prompt === "string" ? (meta.prompt as string) : "";
    const promptToUse = title.trim() || fallbackPrompt.trim();

    if (!promptToUse) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing prompt to generate thumbnail",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Call the image generator.
    // In production, edge runtimes can behave differently around URL parsing/host headers.
    // Use the request origin explicitly and disable caching to avoid odd cross-request reuse.
    const origin = new URL(req.url).origin;
    const generatorUrl = `${origin}/api/generate-image`;

    const genRes = await fetchWithRetry(generatorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify({ prompt: promptToUse }),
    });

    if (!genRes.ok) {
      const text = await genRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Generator failed",
          details: text,
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const genJson = (await genRes.json()) as {
      success?: boolean;
      image?: string;
    };
    const courseImage = typeof genJson.image === "string" ? genJson.image : "";

    if (!genJson.success || !courseImage) {
      return new Response(
        JSON.stringify({ success: false, error: "No image returned" }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Persist back to Redis. Keep the TTL behavior unchanged (key already has TTL if set that way),
    // so we just update the object at the same key.
    // Persist either into the full course object if it exists, or create a minimal shell.
    // When streaming finishes, /api/generate will overwrite course:${courseId} with full content,
    // but it will also include courseImage (from its own parallel generation promise).

    // CRITICAL: Re-read current data to avoid overwriting course content if 'generate' finished while we were working.
    const currentData = (await redis.get(key)) as Record<
      string,
      unknown
    > | null;
    await redis.set(
      key,
      { ...(currentData ?? { id: courseId }), courseImage },
      { ex: 3600 }
    );

    // Release lock.
    try {
      await redis.del(lockKey);
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ success: true, courseImage, cached: false }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error("ensure-thumbnail error:", error);
    // Best-effort: try releasing lock if we can infer courseId (we can't reliably here).
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to ensure thumbnail",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
