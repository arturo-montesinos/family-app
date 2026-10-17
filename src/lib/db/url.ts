/**
 * Resolve the Postgres connection string.
 *
 * The Vercel <-> Neon integration injects several variables (DATABASE_URL, POSTGRES_URL,
 * DATABASE_URL_UNPOOLED, ...) and, if a custom prefix was chosen during setup, they may be
 * prefixed (e.g. STORAGE_DATABASE_URL). Accept the common names so a naming mismatch
 * doesn't silently leave the app without a database.
 */
const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
];

export function resolveDatabaseUrl(): { url: string; source: string } | null {
  for (const name of CANDIDATES) {
    const v = process.env[name];
    if (v) return { url: v, source: name };
  }
  // Prefixed variants, e.g. STORAGE_DATABASE_URL / MYDB_POSTGRES_URL.
  for (const [name, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (/_(DATABASE_URL|POSTGRES_URL)$/.test(name) && v.startsWith("postgres")) {
      return { url: v, source: name };
    }
  }
  return null;
}

export function getDatabaseUrl(): string {
  return resolveDatabaseUrl()?.url ?? "";
}
