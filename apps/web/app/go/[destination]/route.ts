import { NextResponse } from "next/server";

import { site } from "@/lib/site";

const destinations = {
  github: site.github,
  npm: site.npm,
} as const;

type Destination = keyof typeof destinations;

function safeLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().slice(0, 64);
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : undefined;
}

function campaignFromReferrer(request: Request): string | undefined {
  const referrer = request.headers.get("referer");
  if (!referrer) return undefined;

  try {
    const url = new URL(referrer);
    if (url.origin !== new URL(site.url).origin) return undefined;
    return safeLabel(url.searchParams.get("src"));
  } catch {
    return undefined;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ destination: string }> },
) {
  const { destination: requestedDestination } = await params;
  if (!(requestedDestination in destinations)) {
    return new NextResponse("Unknown destination", { status: 404 });
  }

  const destination = requestedDestination as Destination;
  const url = new URL(request.url);
  const placement = safeLabel(url.searchParams.get("from")) ?? "unknown";
  const campaign = safeLabel(url.searchParams.get("src")) ?? campaignFromReferrer(request) ?? "direct";

  console.info(JSON.stringify({
    level: "info",
    event: "outbound_click",
    destination,
    placement,
    campaign,
  }));

  const response = NextResponse.redirect(destinations[destination], 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
