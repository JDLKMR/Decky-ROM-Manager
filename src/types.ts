export interface Profile {
  id: string;
  name: string;
  /** Lower-case, leading dot, e.g. [".gb", ".gbc"]. Empty = always ask which profile. */
  fileTypes: string[];
  target: string;
  launchOptions: string;
}

export interface Settings {
  browserDir: string;
  showGameButton: boolean;
  /** Always alphabetical by name (the backend sorts them). */
  profiles: Profile[];
}

export interface DirListing {
  path: string;
  parent: string | null;
  dirs: string[];
  files: string[];
}

export interface Game {
  appid: number;
  name: string;
}
