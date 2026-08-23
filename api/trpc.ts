import type { IncomingMessage, ServerResponse } from "node:http";
import { initTRPC } from "@trpc/server";
import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import superjson from "superjson";
import { z } from "zod";
import { fetchTab4uSong } from "../server/tab4u";
import { loadImportedLibraryCatalog, loadLibrarySnapshot, saveLibrarySnapshot } from "../server/librarySync";

const t = initTRPC.create({ transformer: superjson });
const publicProcedure = t.procedure;
const router = t.router;

const libraryKeySchema = z.object({
  libraryId: z.string().uuid(),
  secret: z.string().min(32).max(256),
});

const syncedSongSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(2000),
  artist: z.string().min(1).max(512),
  sourceUrl: z.string().url().max(2048),
  note: z.string().max(10000),
  addedAt: z.number().int().nonnegative(),
  lines: z.array(z.object({
    label: z.string().max(2000).optional(),
    chord: z.string().max(10000),
    lyric: z.string().max(10000),
    tab: z.string().max(10000).optional(),
  })).max(3000),
});

// Keep the production Vercel API intentionally small and independent from the
// legacy Express/Manus auth layer. These are the public procedures used by the
// ChordShift client in production.
const vercelRouter = router({
  tab4u: router({
    fetchSong: publicProcedure
      .input(z.object({ url: z.string().url().max(2048) }))
      .query(({ input }) => fetchTab4uSong(input.url)),
  }),
  librarySync: router({
    catalog: publicProcedure.query(() => loadImportedLibraryCatalog()),
    pull: publicProcedure
      .input(libraryKeySchema)
      .query(({ input }) => loadLibrarySnapshot(input.libraryId, input.secret)),
    push: publicProcedure
      .input(libraryKeySchema.extend({ songs: z.array(syncedSongSchema).max(500) }))
      .mutation(({ input }) => saveLibrarySnapshot(input.libraryId, input.secret, input.songs)),
  }),
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const path = requestUrl.searchParams.get("trpcPath") ?? "";

  return nodeHTTPRequestHandler({
    req,
    res,
    path,
    router: vercelRouter,
  });
}
