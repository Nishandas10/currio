import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const courseId = id.split("-").pop() ?? id;

  try {
    const redis = Redis.fromEnv();
    let course = await redis.get(`course:${courseId}`);

    if (!course) {
      // Fallback: Check for meta key (prompt/searchQuery) if full course is missing
      // This happens if generation was interrupted (e.g. mobile redirect)
      const meta = await redis.get(`course:meta:${courseId}`);
      if (meta) {
        course = meta;
      }
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error("Redis fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const courseId = id.split("-").pop() ?? id;

  try {
    const body = await request.json();
    const { courseThumbnail } = body;

    if (!courseThumbnail) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const redis = Redis.fromEnv();
    const key = `course:${courseId}`;

    // Get existing course to merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (await redis.get(key)) as any;
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Update with new thumbnail
    const updated = { ...existing, courseThumbnail };
    await redis.set(key, updated);
    // Preserve TTL if possible, or reset it.
    // Usually guest courses expire in 24h.
    // We can just set it again to be safe or let it be.
    // Let's keep it simple.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Redis update error:", error);
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    );
  }
}
