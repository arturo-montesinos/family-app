import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getDatabaseUrl } from "./url";

/**
 * Neon HTTP driver + Drizzle. Stateless per query, ideal for serverless/Vercel.
 * Note: neon-http does not support interactive transactions; use `db.batch([...])`
 * for multi-statement atomic writes.
 *
 * The client is created lazily by @neondatabase/serverless: a missing
 * database URL only errors when a query actually runs, so `next build`
 * works without a database. See ./url.ts for the accepted variable names.
 */
const sql = neon(getDatabaseUrl());

export const db = drizzle({ client: sql, schema });

export type DB = typeof db;
export { schema };
