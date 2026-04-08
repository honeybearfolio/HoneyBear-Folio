import { IS_RELEASE } from "../utils/version";

/**
 * Development settings configuration.
 * These settings are ONLY applied when IS_RELEASE is false.
 */
interface DevSettingsMap {
  FORCE_WELCOME_SCREEN: boolean;
  FORCE_HIDE_UPDATE_POPUP: boolean;
  FORCE_SHOW_UPDATE_POPUP: boolean;
  FORCE_SUCCESS_TOAST: boolean;
  FORCE_FAILURE_TOAST: boolean;
}

const DEV_SETTINGS: DevSettingsMap = {
  // UI Flow Overrides
  FORCE_WELCOME_SCREEN: false, // If true, always show welcome screen (ignores localStorage)
  FORCE_HIDE_UPDATE_POPUP: true, // If true, never check for updates
  FORCE_SHOW_UPDATE_POPUP: false, // If true, mocks an available update (useful for UI testing)

  // Toast Testing (triggers on app mount)
  FORCE_SUCCESS_TOAST: false,
  FORCE_FAILURE_TOAST: false,
};

/**
 * Helper to get a development setting.
 * Returns undefined if we are in a release build.
 */
export function getDevSetting<K extends keyof DevSettingsMap>(
  key: K,
): DevSettingsMap[K] | undefined {
  if (IS_RELEASE) {
    return undefined;
  }
  return DEV_SETTINGS[key];
}
