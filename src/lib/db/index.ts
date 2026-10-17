import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon HTTP driver + Drizzle. Stateless per query, ideal for serverless/Vercel.
 * Note: neon-http does not support interactive transactions; use `db.batch([...])`
 * for multi-statement atomic writes.
 *
 * The client is created lazily by @neondatabase/serverless: a missing
 * DATABASE_URL only errors when a query actually runs, so `next build`
 * works without a database.
 */
const sql = neon(process.env.DATABASE_URL ?? "");

export const db = drizzle({ client: sql, schema });

export type DB = typeof db;
export { schema };
