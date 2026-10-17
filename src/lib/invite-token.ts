/** Extracts an invite token from a pasted URL (".../invite/<token>") or a bare token. */
export function extractInviteToken(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /\/invite\/([A-Za-z0-9_-]{16,128})(?:[/?#]|$)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{16,128}$/.test(s) ? s : null;
}
