import type { NextRequest } from "next/server";
import { authenticatePrincipal, toErrorResponse } from "@/lib/api";
import { renderSkill, SKILL_FILENAME } from "@/lib/agent-skill";
import { listHouseholdsForUser } from "@/lib/db/queries/households";
import { ForbiddenError } from "@/lib/errors";

/**
 * GET /api/v1/skill[?download=1] — the agent skill (SKILL.md) as text/markdown.
 * Allowed: a signed-in household owner (the admin), or any valid API key with `read`
 * (agents fetching their own instructions). The content never includes a key.
 */
export async function GET(req: NextRequest) {
  try {
    const principal = await authenticatePrincipal(req, { allowApiKeys: true });
    if (principal.kind === "session") {
      const households = await listHouseholdsForUser(principal.user.id);
      if (!households.some((h) => h.role === "owner")) {
        throw new ForbiddenError("Only the household owner can download the agent skill");
      }
    }
    const headers: Record<string, string> = {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "private, no-store",
    };
    if (req.nextUrl.searchParams.get("download") === "1") {
      headers["Content-Disposition"] = `attachment; filename="${SKILL_FILENAME}"`;
    }
    return new Response(renderSkill(req.nextUrl.origin), { status: 200, headers });
  } catch (err) {
    return toErrorResponse(err);
  }
}
