import type { Profile } from "./types";

/** "SFC, .gb  gbc" -> [".sfc", ".gb", ".gbc"] (lower-case, leading dot, de-duplicated). */
export function normalizeFileTypes(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    let t = raw.trim().toLowerCase();
    if (!t || t === ".") continue;
    if (!t.startsWith(".")) t = "." + t;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export const describeFileTypes = (p: Profile) =>
  p.fileTypes.length ? p.fileTypes.join(", ") : "No file type";

export type Resolution =
  | { kind: "profile"; profile: Profile }
  | { kind: "ask"; conflict: string | null };

/**
 * Decide which profile a ROM file maps to.
 * - The longest matching file type wins, so ".xiso.iso" beats a plain ".iso".
 * - Exactly one profile owns that type: apply it without asking.
 * - Several profiles own the identical type (or none match): ask.
 *   `conflict` is set only for the several-profiles case, so the picker can say why.
 */
export function resolveProfile(fileName: string, profiles: Profile[]): Resolution {
  const name = fileName.toLowerCase();
  let best = 0;
  let owners: Profile[] = [];
  for (const p of profiles) {
    for (const t of p.fileTypes) {
      if (!name.endsWith(t)) continue;
      if (t.length > best) {
        best = t.length;
        owners = [p];
      } else if (t.length === best && !owners.includes(p)) {
        owners.push(p);
      }
    }
  }
  if (owners.length === 1) return { kind: "profile", profile: owners[0] };
  if (owners.length > 1) {
    const type = owners[0].fileTypes.find((t) => name.endsWith(t) && t.length === best) ?? "";
    return { kind: "ask", conflict: type };
  }
  return { kind: "ask", conflict: null };
}
