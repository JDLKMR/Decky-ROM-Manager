import { useEffect, useRef, useState } from "react";
import { FaArrowUp, FaCheck, FaFile, FaFolder } from "react-icons/fa";
import { deleteProfile, listDir, saveProfile } from "./api";
import { describeFileTypes, normalizeFileTypes } from "./profiles";
import { deriveStartIn } from "./steam";
import type { DirListing, Profile, Settings } from "./types";
import {
  DialogBody,
  DialogButton,
  DialogHeader,
  Focusable,
  ModalRoot,
  TextField,
  showModal,
} from "./ui";

type CloseProps = { closeModal?: () => void };

const itemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left" as const,
  marginBottom: "8px",
};
const subStyle = { fontSize: "0.75em", opacity: 0.6, wordBreak: "break-all" as const };
const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};
const ellipsis = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const joinPath = (base: string, name: string) => `${base.replace(/\/$/, "")}/${name}`;

/** Large ROM folders are shown a page at a time so the list stays responsive. */
const PAGE = 150;

/* ------------------------------------------------------------------ */
/* Folder / file browser                                               */
/* ------------------------------------------------------------------ */
function useListing(startPath: string) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const latest = useRef(0);
  const load = async (p: string) => {
    const mine = ++latest.current;
    const next = await listDir(p);
    if (mine !== latest.current) return; // a newer navigation superseded this one
    setLimit(PAGE);
    setListing(next);
  };
  useEffect(() => {
    load(startPath);
  }, []);
  return { listing, load, limit, showMore: () => setLimit((n) => n + PAGE) };
}

export function FileBrowserModal({
  startPath,
  onSelect,
  closeModal,
}: { startPath: string; onSelect: (path: string) => void } & CloseProps) {
  const { listing, load, limit, showMore } = useListing(startPath);
  const files = listing?.files.slice(0, limit) ?? [];
  const hidden = (listing?.files.length ?? 0) - files.length;
  return (
    <ModalRoot onCancel={closeModal} closeModal={closeModal}>
      <DialogHeader>Choose ROM file</DialogHeader>
      <DialogBody>
        <div style={{ ...subStyle, marginBottom: "10px", fontSize: "0.9em" }}>
          {listing?.path ?? "Loading…"}
        </div>
        {listing?.parent && (
          <DialogButton style={itemStyle} onClick={() => load(listing.parent!)}>
            <div style={rowStyle}>
              <FaArrowUp />
              <span style={ellipsis}>Up one level</span>
            </div>
          </DialogButton>
        )}
        {listing?.dirs.map((d) => (
          <DialogButton key={`d:${d}`} style={itemStyle} onClick={() => load(joinPath(listing.path, d))}>
            <div style={rowStyle}>
              <FaFolder />
              <span style={ellipsis}>{d}</span>
            </div>
          </DialogButton>
        ))}
        {listing &&
          files.map((f) => (
            <DialogButton
              key={`f:${f}`}
              style={itemStyle}
              onClick={() => {
                closeModal?.();
                onSelect(joinPath(listing.path, f));
              }}
            >
              <div style={rowStyle}>
                <FaFile />
                <span style={ellipsis}>{f}</span>
              </div>
            </DialogButton>
          ))}
        {hidden > 0 && (
          <DialogButton style={itemStyle} onClick={showMore}>
            Show more ({hidden} more files)
          </DialogButton>
        )}
        {listing && listing.dirs.length === 0 && listing.files.length === 0 && (
          <div style={{ opacity: 0.7 }}>This folder is empty.</div>
        )}
      </DialogBody>
    </ModalRoot>
  );
}

/** Folders only; used by the settings to choose where the ROM browser starts. */
export function DirectoryBrowserModal({
  startPath,
  onSelect,
  closeModal,
}: { startPath: string; onSelect: (path: string) => void } & CloseProps) {
  const { listing, load } = useListing(startPath);
  return (
    <ModalRoot onCancel={closeModal} closeModal={closeModal}>
      <DialogHeader>ROM browser start folder</DialogHeader>
      <DialogBody>
        <div style={{ ...subStyle, marginBottom: "10px", fontSize: "0.9em" }}>
          {listing?.path ?? "Loading…"}
        </div>
        <DialogButton
          style={itemStyle}
          disabled={!listing}
          onClick={() => {
            if (!listing) return;
            closeModal?.();
            onSelect(listing.path);
          }}
        >
          <div style={rowStyle}>
            <FaCheck />
            <span style={ellipsis}>Use this folder</span>
          </div>
        </DialogButton>
        {listing?.parent && (
          <DialogButton style={itemStyle} onClick={() => load(listing.parent!)}>
            <div style={rowStyle}>
              <FaArrowUp />
              <span style={ellipsis}>Up one level</span>
            </div>
          </DialogButton>
        )}
        {listing?.dirs.map((d) => (
          <DialogButton key={d} style={itemStyle} onClick={() => load(joinPath(listing.path, d))}>
            <div style={rowStyle}>
              <FaFolder />
              <span style={ellipsis}>{d}</span>
            </div>
          </DialogButton>
        ))}
        {listing && listing.dirs.length === 0 && <div style={{ opacity: 0.7 }}>No subfolders here.</div>}
      </DialogBody>
    </ModalRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Console profile selection (no / ambiguous file type)                */
/* ------------------------------------------------------------------ */
export function ProfilePickerModal({
  gameName,
  romName,
  profiles,
  conflict,
  onPick,
  closeModal,
}: {
  gameName: string;
  romName: string;
  profiles: Profile[];
  /** Set when several profiles claim the ROM's file type. */
  conflict: string | null;
  onPick: (profile: Profile) => void;
} & CloseProps) {
  return (
    <ModalRoot onCancel={closeModal} closeModal={closeModal}>
      <DialogHeader>Choose console profile</DialogHeader>
      <DialogBody>
        <div style={{ marginBottom: "6px" }}>
          <b>{romName}</b> for {gameName}
        </div>
        {conflict && (
          <div style={{ ...subStyle, fontSize: "0.85em", marginBottom: "10px" }}>
            More than one profile uses {conflict}, so pick which one to apply.
          </div>
        )}
        {profiles.map((p) => (
          <DialogButton
            key={p.id}
            style={{ ...itemStyle, marginTop: "8px" }}
            onClick={() => {
              closeModal?.();
              onPick(p);
            }}
          >
            <div style={ellipsis}>{p.name}</div>
            <div style={subStyle}>{describeFileTypes(p)}</div>
          </DialogButton>
        ))}
      </DialogBody>
    </ModalRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Yes/No confirmation, cursor starts on "Yes"                         */
/* ------------------------------------------------------------------ */
function ConfirmModal({
  title,
  body,
  onConfirm,
  closeModal,
}: { title: string; body: string; onConfirm: () => void } & CloseProps) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      (wrap.current?.querySelector('[class*="DialogButton"], button') as HTMLElement | null)?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <ModalRoot onCancel={closeModal} closeModal={closeModal}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <div style={{ marginBottom: "16px" }}>{body}</div>
        <div ref={wrap}>
          <Focusable
            // @ts-ignore
            style={{ display: "flex", gap: "12px" }}
            // @ts-ignore
            flow-children="row"
          >
            <DialogButton
              {...{ autoFocus: true }}
              style={{ flex: 1 }}
              onClick={() => {
                closeModal?.();
                onConfirm();
              }}
            >
              Yes
            </DialogButton>
            <DialogButton style={{ flex: 1 }} onClick={() => closeModal?.()}>
              No
            </DialogButton>
          </Focusable>
        </div>
      </DialogBody>
    </ModalRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit a console profile                                        */
/* ------------------------------------------------------------------ */
export function ProfileEditorModal({
  profile,
  profiles,
  onChange,
  closeModal,
}: {
  /** null = new profile */
  profile: Profile | null;
  profiles: Profile[];
  onChange: (s: Settings) => void;
} & CloseProps) {
  const [name, setName] = useState(profile?.name ?? "");
  const [types, setTypes] = useState((profile?.fileTypes ?? []).join(", "));
  const [target, setTarget] = useState(profile?.target ?? "");
  const [launch, setLaunch] = useState(profile?.launchOptions ?? "");
  const [busy, setBusy] = useState(false);

  const startIn = deriveStartIn(target);
  const clashes = normalizeFileTypes(types)
    .map((t) => ({ t, names: profiles.filter((p) => p.id !== profile?.id && p.fileTypes.includes(t)).map((p) => p.name) }))
    .filter((c) => c.names.length > 0);

  const save = async () => {
    setBusy(true);
    try {
      const next = await saveProfile({
        id: profile?.id,
        name: name.trim(),
        fileTypes: normalizeFileTypes(types),
        target: target.trim(),
        launchOptions: launch.trim(),
      });
      onChange(next);
      closeModal?.();
    } catch (e) {
      console.error("[ROM Manager] save profile failed", e);
      setBusy(false);
    }
  };

  const remove = () =>
    showModal(
      <ConfirmModal
        title="Delete profile?"
        body={`Delete the "${profile?.name}" profile? Games already set up with it are not changed.`}
        onConfirm={async () => {
          onChange(await deleteProfile(profile!.id));
          closeModal?.();
        }}
      />,
    );

  return (
    <ModalRoot onCancel={closeModal} closeModal={closeModal}>
      <DialogHeader>{profile ? "Edit profile" : "Add profile"}</DialogHeader>
      <DialogBody>
        <TextField label="Name" description="Usually the console name or abbreviation" value={name} onChange={(e: any) => setName(e.target.value)} />
        <TextField
          label="File types"
          description="Optional. Separate with commas, e.g. .gb, .gbc. A ROM of this type skips profile selection. Leave blank to always choose manually."
          value={types}
          onChange={(e: any) => setTypes(e.target.value)}
        />
        {clashes.map((c) => (
          <div key={c.t} style={{ ...subStyle, fontSize: "0.85em", marginTop: "6px" }}>
            {c.t} is also used by {c.names.join(", ")}, so ROMs of that type will ask which profile to use.
          </div>
        ))}
        <TextField label="Target" description={'e.g. "/usr/bin/flatpak" run org.libretro.RetroArch'} value={target} onChange={(e: any) => setTarget(e.target.value)} />
        <div style={{ ...subStyle, fontSize: "0.85em", margin: "6px 0 10px" }}>
          Start In (automatic): {startIn || "—"}
        </div>
        <TextField
          label="Launch options"
          description={"Use <rom_path> where the chosen ROM's path goes, e.g. -f -g \"<rom_path>\""}
          value={launch}
          onChange={(e: any) => setLaunch(e.target.value)}
        />
        <Focusable
          // @ts-ignore
          style={{ display: "flex", gap: "8px", marginTop: "16px" }}
          // @ts-ignore
          flow-children="row"
        >
          <DialogButton disabled={busy || !name.trim() || !target.trim()} onClick={save}>
            Save
          </DialogButton>
          <DialogButton onClick={() => closeModal?.()}>Cancel</DialogButton>
          {profile && <DialogButton onClick={remove}>Delete</DialogButton>}
        </Focusable>
      </DialogBody>
    </ModalRoot>
  );
}
