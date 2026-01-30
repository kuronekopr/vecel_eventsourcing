import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DIRECT_URL) {
    // Fallback if DIRECT_URL is not set (e.g. CI without it), though recommended for migrations
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL or DIRECT_URL is required");
}

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    },
});
