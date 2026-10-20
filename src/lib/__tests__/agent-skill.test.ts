import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderSkill, SKILL_DEFAULT_BASE_URL } from "@/lib/agent-skill";
import { SKILL_MD, SKILL_SOURCE_PATH } from "@/lib/agent-skill/content.generated";
import { crc32, zipFiles } from "@/lib/zip";

afterEach(() => vi.unstubAllEnvs());

describe("agent skill", () => {
  it("embedded copy matches docs/agent-skill/family-app/SKILL.md (run npm run skill:generate)", () => {
    expect(SKILL_MD).toBe(readFileSync(SKILL_SOURCE_PATH, "utf8"));
  });

  it("has the required frontmatter and the delete rule", () => {
    expect(SKILL_MD).toMatch(/^---\nname: family-app\ndescription: .+\n---\n/);
    expect(SKILL_MD).toContain("FAMILY_APP_API_KEY");
    expect(SKILL_MD).toMatch(/DELETE: hard rule/);
  });

  it("uses NEXT_PUBLIC_APP_URL, else the request origin, else production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://family.example.org/");
    const custom = renderSkill("http://localhost:3000");
    expect(custom).toContain("**Base URL:** `https://family.example.org`.");
    expect(custom).toContain('"${FAMILY_APP_URL:-https://family.example.org}/api/v1"');
    expect(custom).not.toContain(SKILL_DEFAULT_BASE_URL);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const local = renderSkill("http://localhost:3000");
    expect(local).toContain("**Base URL:** `http://localhost:3000`.");
    expect(local).not.toContain(SKILL_DEFAULT_BASE_URL);
    expect(renderSkill(null)).toContain(SKILL_DEFAULT_BASE_URL);
  });
});

describe("zipFiles", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("writes a stored zip with the file name and content", () => {
    const zip = zipFiles({ "family-app/SKILL.md": "hello" });
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("family-app/SKILL.md");
    expect(text).toContain("hello");
  });
});
