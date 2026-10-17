import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

// TODO(backend agent): implement seed data (demo household, members, events, todos, posts).
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[db:seed] DATABASE_URL is not set — nothing to seed.");
    return;
  }
  console.log("[db:seed] Seed script not implemented yet.");
}

main().catch((err) => {
  console.error("[db:seed] Failed:", err);
  process.exit(1);
});
