import { getSettings } from "./api";
import { FileBrowserModal, ProfilePickerModal } from "./modals";
import { resolveProfile } from "./profiles";
import { applyProfile, basename } from "./steam";
import { toast } from "./toast";
import type { Game, Profile } from "./types";
import { showModal } from "./ui";

async function apply(game: Game, profile: Profile, romPath: string) {
  try {
    await applyProfile(game, profile, romPath);
    toast(`${profile.name} profile applied to ${game.name}`);
  } catch (e) {
    console.error("[ROM Manager] apply failed", e);
    toast(`Could not update ${game.name}`);
  }
}

/**
 * Choose ROM file -> (profile chosen automatically by file type, or picked by
 * hand) -> clear the shortcut's fields and apply the profile.
 */
export async function startRomFlow(game: Game) {
  try {
    const s = await getSettings();
    if (s.profiles.length === 0) {
      toast("Add a console profile first (in the ROM Manager menu).");
      return;
    }
    showModal(
      <FileBrowserModal
        startPath={s.browserDir}
        onSelect={(romPath) => {
          const romName = basename(romPath);
          const res = resolveProfile(romName, s.profiles);
          if (res.kind === "profile") {
            apply(game, res.profile, romPath);
            return;
          }
          showModal(
            <ProfilePickerModal
              gameName={game.name}
              romName={romName}
              profiles={s.profiles}
              conflict={res.conflict}
              onPick={(p) => apply(game, p, romPath)}
            />,
          );
        }}
      />,
    );
  } catch (e) {
    console.error("[ROM Manager] could not start", e);
    toast("Could not open the ROM browser.");
  }
}
