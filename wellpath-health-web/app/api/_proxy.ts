const DEFAULT_API_ORIGIN = "http://localhost:3000/api";

export async function proxyWellPathRequest(
  request: Request,
  path: string[],
) {
  const configuredBase =
    process.env.WELLPATH_API_URL?.trim() || DEFAULT_API_ORIGIN;
  const base = configuredBase.replace(/\/+$/, "");
  const cleanPath = path
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");
  const incomingUrl = new URL(request.url);
  const target = `${base}/${cleanPath}${incomingUrl.search}`;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const hasBody = !["GET", "HEAD"].includes(request.method);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "The WellPath data service is unavailable. Start the existing backend or configure WELLPATH_API_URL.",
      },
      { status: 502 },
    );
  }
}
