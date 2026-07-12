import { markdownHomepage } from "@/lib/machine-content";
import { textResponse } from "@/lib/responses";

export function GET() {
  return textResponse(markdownHomepage, "text/markdown; charset=utf-8");
}
