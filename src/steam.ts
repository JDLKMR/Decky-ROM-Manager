import type { Game, Profile } from "./types";

const w = window as any;

export const APP_TYPE_SHORTCUT = 1073741824; // non-Steam shortcut
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/** The game if `appid` is a non-Steam shortcut, otherwise null (ROM Manager only edits shortcuts). */
export function getShortcutByAppId(appid: number): Game | null {
  try {
    const o = w.appStore?.GetAppOverviewByAppID?.(appid);
    if (!o || o.app_type !== APP_TYPE_SHORTCUT) return null;
    return { appid, name: o.display_name || `App ${appid}` };
  } catch {
    return null;
  }
}

/** The executable inside a Target string: `"/usr/bin/flatpak" run x` -> /usr/bin/flatpak */
function exeOf(target: string): string {
  const t = target.trim();
  const q = t[0];
  if (q === '"' || q === "'") {
    const end = t.indexOf(q, 1);
    return end > 0 ? t.slice(1, end) : t.slice(1);
  }
  return t.split(/\s+/)[0] ?? "";
}

/** Start In is always the folder holding the Target's executable, with a trailing slash. */
export function deriveStartIn(target: string): string {
  const exe = exeOf(target);
  const i = exe.lastIndexOf("/");
  if (i < 0) return "";
  return i === 0 ? "/" : `${exe.slice(0, i)}/`;
}

const ROM_TOKEN = "<rom_path>";
const SAFE_BARE = /^[A-Za-z0-9_\-.,/:@%+=]+$/;

/**
 * Fill `<rom_path>` in a launch-options template. The path is escaped for the
 * quoting around the token, so `"<rom_path>"` stays safe for names containing
 * quotes, `$`, backticks or backslashes.
 */
export function buildLaunchOptions(template: string, romPath: string): string {
  let out = "";
  let quote: "" | '"' | "'" = "";
  for (let i = 0; i < template.length; ) {
    if (template.startsWith(ROM_TOKEN, i)) {
      if (quote === '"') out += romPath.replace(/([\\"$`])/g, "\\$1");
      else if (quote === "'") out += romPath.replace(/'/g, "'\\''");
      else out += SAFE_BARE.test(romPath) ? romPath : `'${romPath.replace(/'/g, "'\\''")}'`;
      i += ROM_TOKEN.length;
      continue;
    }
    const ch = template[i];
    if (ch === "\\" && quote !== "'" && i + 1 < template.length) {
      out += ch + template[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"' && quote !== "'") quote = quote === '"' ? "" : '"';
    else if (ch === "'" && quote !== '"') quote = quote === "'" ? "" : "'";
    out += ch;
    i++;
  }
  return out;
}

/** Clear Target / Start In / Launch Options, then fill them from the profile. */
export async function applyProfile(game: Game, profile: Profile, romPath: string) {
  const A = w.SteamClient.Apps;
  A.SetShortcutExe(game.appid, "");
  A.SetShortcutStartDir(game.appid, "");
  A.SetShortcutLaunchOptions(game.appid, "");
  await sleep(100);
  A.SetShortcutExe(game.appid, profile.target);
  A.SetShortcutStartDir(game.appid, deriveStartIn(profile.target));
  A.SetShortcutLaunchOptions(game.appid, buildLaunchOptions(profile.launchOptions, romPath));
}
