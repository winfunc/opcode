/**
 * Thinking Preferences Service
 * Stores lightweight UI preferences for thinking/analysis views in localStorage
 */

const PREF_EXPANDED_KEY = "claudia_thinking_expanded_by_default";

export class ThinkingPreferencesService {
  /**
   * Whether thinking/analysis blocks should be expanded by default
   * Defaults to true when not set
   */
  static isExpandedByDefault(): boolean {
    try {
      const v = localStorage.getItem(PREF_EXPANDED_KEY);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  }

  /**
   * Set default expanded preference
   */
  static setExpandedByDefault(expanded: boolean): void {
    try {
      localStorage.setItem(PREF_EXPANDED_KEY, String(expanded));
    } catch (e) {
      console.error("Failed to persist thinking expanded preference", e);
    }
  }
}
