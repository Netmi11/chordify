import { defineConfig } from "drizzle-kit";

// Migrations should use Neon's direct URL; runtime functions use the pooled URL.
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required to run drizzle commands");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle-postgres",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
});
