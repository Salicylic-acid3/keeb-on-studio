/**
 * The QMK side's Settings tab: what applies to the whole keyboard, the way
 * the ZMK side's Settings tab holds its device-wide settings. It is Vial's
 * "QMK Settings" for the parts these keyboards use -- Tap-Hold (the same
 * fields as Vial's own tab) and mouse keys. The combo timeout stays on the
 * combo list's gear, where the ZMK side keeps its combo settings.
 *
 * Staged like everything else on the QMK side: nothing is written until Save.
 */
import {
  IconDeviceFloppy,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";
import { HexIcon } from "../../components/brand/HexIcon";
import { StatusDot } from "../../components/EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import { QmkSettingsCard } from "../components/QmkSettingsCard";
import {
  MOUSE_KEY_SETTINGS,
  supportedFields,
  TAP_HOLD_SETTINGS,
} from "../lib/qmkSettings";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";
import type { QmkFirmwareUpdate } from "../hooks/useQmkFirmwareUpdate";
import { QmkFirmwareUpdateCard } from "../components/QmkFirmwareUpdateCard";

export function QmkSettingsPage({
  keyboard,
  firmwareUpdate,
}: {
  keyboard: UseVialKeyboard;
  firmwareUpdate?: QmkFirmwareUpdate;
}) {
  const { t } = useLanguage();
  const tapHold = supportedFields(TAP_HOLD_SETTINGS, keyboard.qmkSettingIds);
  const mouse = supportedFields(MOUSE_KEY_SETTINGS, keyboard.qmkSettingIds);

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <HexIcon>
              <IconSettings
                size={24}
                className="text-[var(--color-electric)]"
              />
            </HexIcon>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Settings")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Keyboard-wide behaviour (QMK Settings)")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {keyboard.hasUnsavedChanges && (
              <>
                <span className="flex items-center gap-1 text-xs text-[var(--color-neon)] mr-2">
                  <StatusDot status="unsaved" />
                  {t("Unsaved changes")}
                </span>
                <button
                  className="btn-ghost text-sm"
                  onClick={keyboard.discardChanges}
                  disabled={keyboard.isSaving}
                >
                  {t("Discard")}
                </button>
              </>
            )}
            <button
              className="btn-electric text-sm flex items-center gap-1.5"
              onClick={() => void keyboard.saveChanges()}
              disabled={keyboard.isSaving || !keyboard.hasUnsavedChanges}
            >
              {keyboard.isSaving ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconDeviceFloppy size={16} />
              )}
              {t("Save")}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {firmwareUpdate && <QmkFirmwareUpdateCard update={firmwareUpdate} />}
          {tapHold.length > 0 && (
            <QmkSettingsCard
              title="Tap-Hold"
              fields={tapHold}
              values={keyboard.qmkSettings}
              saved={keyboard.savedQmkSettings}
              onChange={keyboard.setQmkSetting}
            />
          )}
          {mouse.length > 0 && (
            <QmkSettingsCard
              title="Mouse Key Settings"
              fields={mouse}
              values={keyboard.qmkSettings}
              saved={keyboard.savedQmkSettings}
              onChange={keyboard.setQmkSetting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
