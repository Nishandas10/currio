import { google } from "@ai-sdk/google";
import { retryOperation } from "@/lib/utils";

// EDGE RUNTIME: Critical for speed
export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt: string; description?: string };
    const userPrompt = body.prompt?.trim();
    const description = body.description?.trim();

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing 'prompt' in request body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Step 1: Use description directly or fallback to prompt
    // We skip the refinement step to speed up generation and reduce latency.
    // The description from the course generation is usually descriptive enough.
    const refinedPrompt = description || userPrompt;

    // Step 2: Generate image using Imagen 4.0
    const imageModel = google.image("imagen-4.0-fast-generate-001");
    const { images } = await retryOperation(async () => {
      return await imageModel.doGenerate({
        prompt: refinedPrompt,
        n: 1,
        size: "1024x1024",
        aspectRatio: "1:1",
        seed: undefined,
        // Include required fields for ImageModelV3CallOptions
        files: [],
        mask: undefined,
        providerOptions: {},
      });
    });

    if (!images || images.length === 0) {
      throw new Error("Failed to generate image");
    }

    // Convert Uint8Array to base64 if needed
    const imageData =
      typeof images[0] === "string"
        ? images[0]
        : Buffer.from(images[0]).toString("base64");

    // Return the base64 image data
    return new Response(
      JSON.stringify({
        success: true,
        image: imageData,
        refinedPrompt,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Image generation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
