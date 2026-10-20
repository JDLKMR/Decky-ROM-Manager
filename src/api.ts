import { callable } from "@decky/api";
import type { DirListing, Profile, Settings } from "./types";

export const getSettings = callable<[], Settings>("get_settings");
export const setBrowserDir = callable<[path: string], Settings>("set_browser_dir");
export const setShowGameButton = callable<[value: boolean], Settings>("set_show_game_button");
export const saveProfile = callable<[profile: Partial<Profile>], Settings>("save_profile");
export const deleteProfile = callable<[profileId: string], Settings>("delete_profile");
export const listDir = callable<[path: string], DirListing>("list_dir");
