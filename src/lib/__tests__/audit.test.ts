import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-helpers", () => ({ requireHousehold: vi.fn(), requireUser: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));
const insertAuditRow = vi.fn();
vi.mock("@/lib/db/queries/audit", () => ({ insertAuditRow, listAudit: vi.fn() }));

const { audit, recordAudit } = await import("@/lib/services/audit");
const { changedFields, entityTypeOf, sanitizeMetadata, summarize, SUMMARY_MAX } = await import("@/lib/audit");

const HH = "8b0f7e0c-3c56-4c8e-9d6f-1a2b3c4d5e6f";
const KEY = "11111111-2222-4333-8444-555555555555";
const user = { id: "u-owner", name: "Arturo", email: "a@example.com", emailVerified: null, image: null };
const member = { householdId: HH, userId: "u-owner", role: "owner" as const, color: null, displayName: null, joinedAt: new Date() };

beforeEach(() => insertAuditRow.mockReset());

describe("pure helpers", () => {
  it("derives the entity type from the action", () => {
    expect(entityTypeOf("event.create")).toBe("event");
    expect(entityTypeOf("api_key.revoke")).toBe("api_key");
    expect(entityTypeOf("todo.complete")).toBe("todo");
  });
  it("summarizes to one short line", () => {
    expect(summarize("  Hockey\n  practice ")).toBe("Hockey practice");
    const long = summarize("x".repeat(500));
    expect(long).toHaveLength(SUMMARY_MAX);
    expect(long.endsWith("…")).toBe(true);
    expect(summarize(null)).toBe("");
  });
  it("strips secret-looking metadata keys and undefined values", () => {
    expect(sanitizeMetadata({ scopes: ["read"], key: "fam_x", keyHash: "abc", token: "t", x: undefined })).toEqual({
      scopes: ["read"],
    });
    expect(sanitizeMetadata({ apiKey: "fam_x" })).toBeNull();
    expect(sanitizeMetadata(null)).toBeNull();
  });
  it("lists changed fields", () => {
    expect(changedFields({ title: "a", dueAt: null, details: undefined })).toEqual(["title", "dueAt"]);
  });
});

describe("audit()", () => {
  it("records a user action from the web UI", async () => {
    await audit({ user, member }, "event.create", { entityId: "e1", summary: "Hockey", metadata: { allDay: false } });
    expect(insertAuditRow).toHaveBeenCalledWith({
      householdId: HH,
      actorType: "user",
      actorUserId: "u-owner",
      apiKeyId: null,
      action: "event.create",
      entityType: "event",
      entityId: "e1",
      summary: "Hockey",
      metadata: { allDay: false },
      ip: "203.0.113.7",
    });
  });

  it("records an API key action with actor_type=api_key", async () => {
    const via = { id: KEY, name: "Claude", scopes: ["read" as const, "write" as const], householdId: HH };
    await audit({ user, member, via }, "todo.complete", { entityId: "t1", summary: "Dishes" });
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: "api_key", apiKeyId: KEY, actorUserId: "u-owner", entityType: "todo" }),
    );
  });

  it("never throws when the insert fails (the main action continues)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    insertAuditRow.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordAudit({ householdId: HH, actorUserId: "u", action: "post.delete", details: { summary: "x" } }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
