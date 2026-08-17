import { llmsFull } from "@/lib/llms";
import { textResponse } from "@/lib/responses";

export async function GET() {
  return textResponse(await llmsFull());
}
