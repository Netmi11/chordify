import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fetchTab4uSong } from "./tab4u";
import { loadLibrarySnapshot, saveLibrarySnapshot } from "./librarySync";

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

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  tab4u: router({
    fetchSong: publicProcedure
      .input(z.object({ url: z.string().url().max(2048) }))
      .query(({ input }) => fetchTab4uSong(input.url)),
  }),
  librarySync: router({
    pull: publicProcedure
      .input(libraryKeySchema)
      .query(({ input }) => loadLibrarySnapshot(input.libraryId, input.secret)),
    push: publicProcedure
      .input(libraryKeySchema.extend({ songs: z.array(syncedSongSchema).max(500) }))
      .mutation(({ input }) => saveLibrarySnapshot(input.libraryId, input.secret, input.songs)),
  }),
});

export type AppRouter = typeof appRouter;
