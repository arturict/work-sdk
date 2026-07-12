import { agentGuide } from "@/lib/machine-content";
import { textResponse } from "@/lib/responses";

export function GET() {
  return textResponse(agentGuide, "text/markdown; charset=utf-8");
}
