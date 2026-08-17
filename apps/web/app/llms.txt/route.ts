import { llmsIndex } from "@/lib/llms";
import { textResponse } from "@/lib/responses";

export function GET() {
  return textResponse(llmsIndex());
}
