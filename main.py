import copy
import json
import os
import re
import uuid

import decky

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

RETROARCH = '"/usr/bin/flatpak" run org.libretro.RetroArch'


def _retroarch(profile_id: str, name: str, types: list, core: str) -> dict:
    return {
        "id": profile_id,
        "name": name,
        "fileTypes": types,
        "target": RETROARCH,
        "launchOptions": f'-L /{core} "<rom_path>"',
    }


# Start In is not stored: it is worked out from Target whenever a profile is applied.
DEFAULT_PROFILES = [
    _retroarch("nes", "NES", [".nes"], "mesen_libretro.so"),
    _retroarch("snes", "SNES", [".sfc"], "snes9x_libretro.so"),
    _retroarch("n64", "Nintendo 64", [".z64"], "mupen64plus_next_libretro.so"),
    _retroarch("gb-gbc", "Game Boy/Game Boy Color", [".gb", ".gbc"], "gambatte_libretro.so"),
    _retroarch("gba", "Game Boy Advance", [".gba"], "mgba_libretro.so"),
    _retroarch("nds", "Nintendo DS/DSiWare", [".nds"], "melondsds_libretro.so"),
    {
        "id": "3ds",
        "name": "Nintendo 3DS",
        "fileTypes": [".cci"],
        "target": '"/home/deck/Scripts/azahar.sh"',
        "launchOptions": '"<rom_path>"',
    },
    {
        "id": "gc-wii",
        "name": "Nintendo GameCube/Wii",
        "fileTypes": [".rvz"],
        "target": '"/usr/bin/flatpak" run org.DolphinEmu.dolphin-emu',
        "launchOptions": '-b -e "<rom_path>"',
    },
    {
        "id": "wiiu",
        "name": "Nintendo Wii U",
        "fileTypes": [".wua"],
        "target": '"/home/deck/Applications/Cemu.AppImage"',
        "launchOptions": '-f -g "<rom_path>"',
    },
    {
        "id": "switch",
        "name": "Nintendo Switch",
        "fileTypes": [".nsp", ".xci"],
        "target": '"/home/deck/Applications/Eden.AppImage"',
        "launchOptions": '-f -g "<rom_path>"',
    },
    {
        "id": "ps2",
        "name": "PlayStation 2",
        "fileTypes": [".chd"],
        "target": '"/home/deck/Applications/pcsx2-Qt.AppImage"',
        "launchOptions": '-batch -fullscreen -nogui "<rom_path>"',
    },
    {
        "id": "xbox",
        "name": "Xbox",
        "fileTypes": [".xiso.iso"],
        "target": '"/usr/bin/flatpak" run app.xemu.xemu',
        "launchOptions": '-full-screen -dvd_path "<rom_path>"',
    },
    _retroarch("cdi", "Philips CD-I", [], "same_cdi_libretro.so"),
]

DEFAULTS = {
    # Where the ROM file browser always starts. Falls back to the nearest existing
    # parent folder if this one doesn't exist (e.g. SD card not inserted).
    "browserDir": "/home/deck/Emulation/roms",
    "showGameButton": True,
    # each: {id, name, fileTypes: [".sfc", ...], target, launchOptions}
    "profiles": DEFAULT_PROFILES,
}

MAX_ENTRIES = 20000


def _natural_key(text: str) -> list:
    # Alternates str / int starting with str, so keys always compare cleanly.
    return [int(t) if t.isdigit() else t.casefold() for t in re.split(r"(\d+)", text)]


def _norm_types(raw) -> list:
    """['SFC', ' .gb '] -> ['.sfc', '.gb'] (lower-case, leading dot, no duplicates)."""
    if isinstance(raw, str):
        raw = re.split(r"[\s,;]+", raw)
    out, seen = [], set()
    for t in raw or []:
        t = str(t).strip().lower()
        if not t or t == ".":
            continue
        if not t.startswith("."):
            t = "." + t
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _clean_profile(p) -> dict | None:
    if not isinstance(p, dict):
        return None
    name = str(p.get("name", "")).strip()
    target = str(p.get("target", "")).strip()
    if not name or not target:
        return None
    return {
        "id": str(p.get("id") or uuid.uuid4().hex[:8]),
        "name": name,
        "fileTypes": _norm_types(p.get("fileTypes")),
        "target": target,
        "launchOptions": str(p.get("launchOptions", "")).strip(),
    }


def _sorted(profiles: list) -> list:
    return sorted(profiles, key=lambda p: _natural_key(p["name"]))


def _load() -> dict:
    data = {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, ValueError, OSError):
        pass
    merged = copy.deepcopy(DEFAULTS)
    if isinstance(data, dict):
        merged.update({k: v for k, v in data.items() if k in DEFAULTS})
    cleaned = [c for c in (_clean_profile(p) for p in merged["profiles"]) if c]
    merged["profiles"] = _sorted(cleaned)
    if not isinstance(merged["browserDir"], str) or not merged["browserDir"]:
        merged["browserDir"] = DEFAULTS["browserDir"]
    merged["showGameButton"] = bool(merged["showGameButton"])
    return merged


def _save(data: dict) -> dict:
    data["profiles"] = _sorted(data["profiles"])
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    tmp = SETTINGS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, SETTINGS_FILE)
    return data


def _existing_dir(path: str) -> str:
    p = os.path.abspath(os.path.expanduser(path or decky.DECKY_USER_HOME))
    while p != "/" and not os.path.isdir(p):
        p = os.path.dirname(p)
    return p


class Plugin:
    async def _main(self):
        decky.logger.info("ROM Manager loaded")

    async def _unload(self):
        decky.logger.info("ROM Manager unloaded")

    # ---- settings -------------------------------------------------------
    async def get_settings(self) -> dict:
        return _load()

    async def set_browser_dir(self, path: str) -> dict:
        s = _load()
        s["browserDir"] = os.path.normpath(os.path.expanduser(path))
        return _save(s)

    async def set_show_game_button(self, value: bool) -> dict:
        s = _load()
        s["showGameButton"] = bool(value)
        return _save(s)

    # ---- console profiles -----------------------------------------------
    async def save_profile(self, profile: dict) -> dict:
        """Create (no id / unknown id) or update (known id) a profile."""
        clean = _clean_profile(profile)
        if clean is None:
            raise ValueError("A profile needs a name and a target.")
        s = _load()
        s["profiles"] = [p for p in s["profiles"] if p["id"] != clean["id"]]
        s["profiles"].append(clean)
        return _save(s)

    async def delete_profile(self, profile_id: str) -> dict:
        s = _load()
        s["profiles"] = [p for p in s["profiles"] if p["id"] != profile_id]
        return _save(s)

    # ---- filesystem -----------------------------------------------------
    async def list_dir(self, path: str) -> dict:
        p = _existing_dir(path)
        dirs, files = [], []
        try:
            with os.scandir(p) as it:
                for e in it:
                    if e.name.startswith("."):
                        continue
                    try:
                        if e.is_dir():
                            dirs.append(e.name)
                        elif e.is_file():
                            files.append(e.name)
                    except OSError:
                        continue
        except OSError as err:
            decky.logger.error(f"Failed to list {p}: {err}")
        dirs.sort(key=_natural_key)
        files.sort(key=_natural_key)
        return {
            "path": p,
            "parent": None if p == "/" else os.path.dirname(p),
            "dirs": dirs[:MAX_ENTRIES],
            "files": files[:MAX_ENTRIES],
        }
