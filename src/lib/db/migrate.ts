import { config } from "dotenv";
import { resolveDatabaseUrl } from "./url";

config({ path: [".env.local", ".env"] });

async function main() {
  const resolved = resolveDatabaseUrl();
  if (!resolved) {
    if (process.env.VERCEL) {
      // On Vercel a missing DB means the app can't work (sign-in fails with a
      // "server configuration" error). Fail the build so it's visible.
      const dbVars = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|PG|NEON/i.test(k));
      console.error(
        "[db:migrate] No database URL found on Vercel. Connect the Neon database to this project " +
          "(Storage tab) for this environment, then redeploy. DB-looking env vars present: " +
          (dbVars.length ? dbVars.join(", ") : "(none)"),
      );
      process.exit(1);
    }
    console.warn("[db:migrate] DATABASE_URL is not set — skipping migrations.");
    return;
  }

  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");

  const db = drizzle({ client: neon(resolved.url) });
  console.log(`[db:migrate] Running migrations from ./drizzle using ${resolved.source} ...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[db:migrate] Done.");
}

main().catch((err) => {
  console.error("[db:migrate] Migration failed:", err);
  process.exit(1);
});
