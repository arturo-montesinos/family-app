import type { BatchItem } from "drizzle-orm/batch";

/** Non-empty tuple type required by `db.batch()` (neon-http's atomic multi-statement API). */
export type BatchList = [BatchItem<"pg">, ...BatchItem<"pg">[]];
