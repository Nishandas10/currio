import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// EDGE RUNTIME: Critical for speed
export const runtime = "edge";

const PROMPT_REFINEMENT_SYSTEM = `You are an expert at creating high-quality image generation prompts for educational course thumbnails.
Given a course title (and optional description), create a detailed image prompt that depicts the subject matter clearly and attractively.

Guidelines:
- SUBJECT: The main subject should be directly relevant to the course topic (e.g., for "Python Programming", show a computer screen with code or a stylized python logo; for "History of Rome", show the Colosseum or a Roman bust).
- STYLE: Use a "cinematic, high-resolution, photorealistic" style or "modern 3D illustration" style. Avoid abstract or vague art.
- COMPOSITION: Center the subject with a clean background.
- LIGHTING: Use professional studio lighting or natural sunlight.
- NO TEXT: Do not include any text, words, or letters in the image.

Output ONLY the refined prompt, nothing else.`;

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

    // Step 1: Refine the prompt using Gemini Flash Lite
    const promptInput = `Course topic: ${userPrompt}${
      description ? `\nDescription: ${description}` : ""
    }\n\nCreate an image generation prompt for this course thumbnail.`;

    const refinedPromptResult = await generateText({
      model: google("gemini-2.0-flash-lite"),
      system: PROMPT_REFINEMENT_SYSTEM,
      prompt: promptInput,
    });

    const refinedPrompt = refinedPromptResult.text.trim();

    // Step 2: Generate image using Imagen 4.0
    const imageModel = google.image("imagen-4.0-fast-generate-001");
    const { images } = await imageModel.doGenerate({
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
