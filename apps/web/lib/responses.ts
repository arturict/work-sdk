export function textResponse(body: string, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "content-type": contentType,
    },
  });
}
