import { proxyWellPathRequest } from "../../_proxy";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handler(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyWellPathRequest(request, path);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
