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
    const course = await redis.get(`course:${courseId}`);

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
