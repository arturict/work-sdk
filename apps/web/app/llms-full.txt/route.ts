import { llmsFull } from "@/lib/machine-content";
import { textResponse } from "@/lib/responses";

export function GET() {
  return textResponse(llmsFull);
}
