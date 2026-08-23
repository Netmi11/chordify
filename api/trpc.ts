import type { IncomingMessage, ServerResponse } from "node:http";
import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const path = requestUrl.searchParams.get("trpcPath") ?? "";

  return nodeHTTPRequestHandler({
    req,
    res,
    path,
    router: appRouter,
    createContext: async (): Promise<TrpcContext> => ({
      // The ChordShift production API only uses public procedures. Keep the
      // shared router context shape without requiring the legacy Manus OAuth
      // middleware in Vercel Functions.
      req: req as TrpcContext["req"],
      res: res as TrpcContext["res"],
      user: null,
    }),
  });
}
