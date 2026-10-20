import { SKILL_MD } from "./content.generated";

export { SKILL_DIR, SKILL_FILENAME } from "./constants";

/**
 * The agent skill (docs/agent-skill/family-app/SKILL.md), embedded at build time.
 * Pure: safe for server pages, route handlers and tests.
 */

/** Base URL written in the canonical SKILL.md; replaced with the deployment's URL when served. */
export const SKILL_DEFAULT_BASE_URL = "https://family-app-eight-omega.vercel.app";

/**
 * SKILL.md with the base URL set to `NEXT_PUBLIC_APP_URL`, else `fallbackOrigin` (the
 * request origin), else the production default. Contains no secrets: the key is only
 * referenced as the FAMILY_APP_API_KEY env var.
 */
export function renderSkill(fallbackOrigin?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || SKILL_DEFAULT_BASE_URL).replace(/\/+$/, "");
  return SKILL_MD.replaceAll(SKILL_DEFAULT_BASE_URL, base);
}
