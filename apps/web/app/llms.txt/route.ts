import { llmsIndex } from "@/lib/machine-content";
import { textResponse } from "@/lib/responses";

export function GET() {
  return textResponse(llmsIndex);
}
