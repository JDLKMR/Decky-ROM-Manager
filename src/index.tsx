import { definePlugin, routerHook } from "@decky/api";
import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronRight, FaGamepad } from "react-icons/fa";
import { getSettings, setBrowserDir, setShowGameButton } from "./api";
import { GameButtonHost, setGameButtonEnabled } from "./GameButton";
import { DirectoryBrowserModal, ProfileEditorModal } from "./modals";
import { describeFileTypes } from "./profiles";
import type { Settings } from "./types";
import { ButtonItem, PanelSection, PanelSectionRow, ToggleField, showModal, staticClasses } from "./ui";

const GLOBAL_NAME = "ROMManagerGameButton";

function Content() {
  const [s, setS] = useState<Settings | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  if (!s) return <PanelSection>Loading…</PanelSection>;

  const chooseBrowserDir = () =>
    showModal(
      <DirectoryBrowserModal startPath={s.browserDir} onSelect={async (p: string) => setS(await setBrowserDir(p))} />,
    );
  const editProfile = (profile: Settings["profiles"][number] | null) =>
    showModal(<ProfileEditorModal profile={profile} profiles={s.profiles} onChange={setS} />);

  return (
    <>
      <PanelSection title="ROM browser">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={chooseBrowserDir} description={s.browserDir}>
            Start directory
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Button on game pages"
            description="Adds a ROM button to non-Steam game pages"
            checked={s.showGameButton}
            onChange={async (v: boolean) => {
              setGameButtonEnabled(v);
              setS(await setShowGameButton(v));
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Console profiles">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => editProfile(null)}>
            Add Profile
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setOpen(!open)}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {open ? <FaChevronDown /> : <FaChevronRight />}
              <span>Profiles ({s.profiles.length})</span>
            </div>
          </ButtonItem>
        </PanelSectionRow>
        {open && s.profiles.length === 0 && (
          <PanelSectionRow>
            <div style={{ opacity: 0.7 }}>No profiles yet. Use Add Profile.</div>
          </PanelSectionRow>
        )}
        {open &&
          s.profiles.map((p) => (
            <PanelSectionRow key={p.id}>
              <ButtonItem layout="below" onClick={() => editProfile(p)} description={describeFileTypes(p)}>
                {p.name}
              </ButtonItem>
            </PanelSectionRow>
          ))}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  getSettings()
    .then((st) => setGameButtonEnabled(st.showGameButton !== false))
    .catch(() => {});
  routerHook.addGlobalComponent(GLOBAL_NAME, GameButtonHost);

  return {
    name: "ROM Manager",
    titleView: <div className={staticClasses.Title}>ROM Manager</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount() {
      routerHook.removeGlobalComponent(GLOBAL_NAME);
    },
  };
});
