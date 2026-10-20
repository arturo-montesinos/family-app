import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Route-level auth for API keys: the /api/v1/skill route, admin endpoints that keys may
 * never reach, and per-method scope enforcement. DB-facing modules are mocked.
 */

vi.mock("server-only", () => ({}));

const HH = "8b0f7e0c-3c56-4c8e-9d6f-1a2b3c4d5e6f";
const KEY_ID = "11111111-2222-4333-8444-555555555555";
const user = { id: "u-owner", name: "Arturo", email: "a@example.com", emailVerified: null, image: null };
const ownerMember = { householdId: HH, userId: "u-owner", role: "owner", color: null, displayName: null, joinedAt: new Date() };

let keyScopes: string[] = ["read"];
const authenticateApiKey = vi.fn(async (token: string) => {
  if (token !== "fam_valid") throw new UnauthorizedError("Invalid, revoked or expired API key");
  return { kind: "api_key", user, key: { id: KEY_ID, name: "Claude", scopes: keyScopes, householdId: HH } };
});
vi.mock("@/lib/services/api-keys", () => ({ authenticateApiKey }));

let sessionUser: typeof user | null = null;
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(async () => {
    if (!sessionUser) throw new UnauthorizedError();
    return sessionUser;
  }),
  requireHousehold: vi.fn(async () => ({ user: sessionUser, member: ownerMember })),
}));

let sessionRole = "owner";
vi.mock("@/lib/db/queries/households", () => ({
  listHouseholdsForUser: vi.fn(async () => [{ id: HH, name: "Home", role: sessionRole }]),
  getHousehold: vi.fn(async () => ({ id: HH, name: "Home" })),
}));
vi.mock("@/lib/db/queries/members", () => ({
  getMember: vi.fn(async () => ownerMember),
  listMembers: vi.fn(async () => [{ ...ownerMember, name: "Arturo", email: "a@example.com", image: null }]),
}));
vi.mock("@/lib/db/queries/todos", () => ({ findTodoHouseholdId: vi.fn(async () => HH) }));
const deleteTodo = vi.fn(async (_ctx: unknown, id: string) => ({ id }));
vi.mock("@/lib/services/todos", () => ({ deleteTodo, getTodo: vi.fn(), updateTodo: vi.fn() }));
const createInvite = vi.fn();
vi.mock("@/lib/services/invites", () => ({ createInvite, acceptInvite: vi.fn() }));
vi.mock("@/lib/services/households", () => ({
  listMyHouseholds: vi.fn(async () => []),
  createHousehold: vi.fn(),
  listMembers: vi.fn(async () => [{ userId: "u-owner", displayName: "Papa" }]),
}));

const req = (url: string, init: { method?: string; auth?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers: init.auth ? { authorization: init.auth } : {},
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

beforeEach(() => {
  sessionUser = null;
  sessionRole = "owner";
  keyScopes = ["read"];
  vi.clearAllMocks();
});

describe("GET /api/v1/skill", () => {
  const load = () => import("@/app/api/v1/skill/route");

  it("401 without a session or key", async () => {
    const { GET } = await load();
    expect((await GET(req("/api/v1/skill"))).status).toBe(401);
  });

  it("401 with an invalid key", async () => {
    const { GET } = await load();
    expect((await GET(req("/api/v1/skill", { auth: "Bearer fam_nope" }))).status).toBe(401);
  });

  it("403 for a signed-in non-owner", async () => {
    sessionUser = user;
    sessionRole = "adult";
    const { GET } = await load();
    expect((await GET(req("/api/v1/skill"))).status).toBe(403);
  });

  it("200 markdown for the owner's session, no key material, base URL from origin", async () => {
    sessionUser = user;
    const { GET } = await load();
    const res = await GET(req("/api/v1/skill"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
    expect(res.headers.get("content-disposition")).toBeNull();
    const body = await res.text();
    expect(body).toMatch(/^---\nname: family-app\n/);
    expect(body).toContain("FAMILY_APP_API_KEY");
    expect(body).toContain("http://localhost");
    expect(body).not.toMatch(/fam_[A-Za-z0-9_-]{20,}/);
  });

  it("200 for any valid key with read; ?download=1 sets the attachment filename", async () => {
    const { GET } = await load();
    const res = await GET(req("/api/v1/skill?download=1", { auth: "Bearer fam_valid" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="SKILL.md"');
  });
});

describe("admin endpoints are forbidden to API keys regardless of scope", () => {
  beforeEach(() => {
    keyScopes = ["read", "write", "delete"];
  });

  it("GET /api/v1/households → 403", async () => {
    const { GET } = await import("@/app/api/v1/households/route");
    const res = await GET(req("/api/v1/households", { auth: "Bearer fam_valid" }), params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("API keys can't access this endpoint");
  });

  it("POST /api/v1/households → 403", async () => {
    const { POST } = await import("@/app/api/v1/households/route");
    const res = await POST(req("/api/v1/households", { method: "POST", auth: "Bearer fam_valid", body: { name: "x" } }), params({}));
    expect(res.status).toBe(403);
  });

  it("POST /api/v1/invites → 403 and the service is never called", async () => {
    const { POST } = await import("@/app/api/v1/invites/route");
    const res = await POST(
      req("/api/v1/invites", { method: "POST", auth: "Bearer fam_valid", body: { householdId: HH, email: "x@y.z" } }),
      params({}),
    );
    expect(res.status).toBe(403);
    expect(createInvite).not.toHaveBeenCalled();
  });

  it("POST /api/v1/invites/:token/accept → 403", async () => {
    const { POST } = await import("@/app/api/v1/invites/[token]/accept/route");
    const res = await POST(req("/api/v1/invites/abc/accept", { method: "POST", auth: "Bearer fam_valid" }), params({ token: "a".repeat(43) }));
    expect(res.status).toBe(403);
  });
});

describe("content endpoints enforce scopes per method", () => {
  it("GET members works with read (read-only roster for agents)", async () => {
    const { GET } = await import("@/app/api/v1/households/[id]/members/route");
    const res = await GET(req(`/api/v1/households/${HH}/members`, { auth: "Bearer fam_valid" }), params({ id: HH }));
    expect(res.status).toBe(200);
  });

  it("a key can't reach another household (404)", async () => {
    const other = "99999999-3c56-4c8e-9d6f-1a2b3c4d5e6f";
    const { GET } = await import("@/app/api/v1/households/[id]/members/route");
    const res = await GET(req(`/api/v1/households/${other}/members`, { auth: "Bearer fam_valid" }), params({ id: other }));
    expect(res.status).toBe(404);
  });

  it("DELETE without the delete scope → 403 naming it; with it → 200", async () => {
    const id = "22222222-3c56-4c8e-9d6f-1a2b3c4d5e6f";
    const { DELETE } = await import("@/app/api/v1/todos/[id]/route");

    keyScopes = ["read", "write"];
    let res = await DELETE(req(`/api/v1/todos/${id}`, { method: "DELETE", auth: "Bearer fam_valid" }), params({ id }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/"delete" scope/);
    expect(deleteTodo).not.toHaveBeenCalled();

    keyScopes = ["read", "delete"];
    res = await DELETE(req(`/api/v1/todos/${id}`, { method: "DELETE", auth: "Bearer fam_valid" }), params({ id }));
    expect(res.status).toBe(200);
    expect(deleteTodo).toHaveBeenCalledWith(expect.objectContaining({ via: expect.objectContaining({ id: KEY_ID }) }), id);
  });

  it("GET /api/v1/me returns the key's bootstrap info", async () => {
    keyScopes = ["read", "write"];
    const { GET } = await import("@/app/api/v1/me/route");
    const res = await GET(req("/api/v1/me", { auth: "Bearer fam_valid" }), params({}));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({
      kind: "api_key",
      key: { id: KEY_ID, name: "Claude", scopes: ["read", "write"] },
      householdId: HH,
      timeZone: "America/Toronto",
    });
  });
});
