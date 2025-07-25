import { logger } from "@/lib/logger";
import noticeSound from "@/assets/sounds/notice.mp3";

/**
 * Audio notification modes
 */
export type AudioNotificationMode = "off" | "on_message" | "on_queue";

/**
 * Audio notification configuration
 */
export interface AudioNotificationConfig {
  mode: AudioNotificationMode;
}

/**
 * Default audio notification configuration
 */
export const DEFAULT_AUDIO_CONFIG: AudioNotificationConfig = {
  mode: "off",
};

/**
 * Audio notification manager class
 * 
 * Handles playing audio notifications based on configuration and task completion events.
 * Supports different notification modes and provides test functionality.
 */
export class AudioNotificationManager {
  private audio: HTMLAudioElement | null = null;
  private config: AudioNotificationConfig = DEFAULT_AUDIO_CONFIG;

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize the audio element
   */
  private initializeAudio(): void {
    try {
      this.audio = new Audio(noticeSound);
      this.audio.volume = 0.7;
      this.audio.preload = "auto";
    } catch (error) {
      logger.error("Failed to initialize audio notification:", error);
    }
  }

  /**
   * Update the audio notification configuration
   */
  setConfig(config: AudioNotificationConfig): void {
    this.config = config;
    logger.debug("Audio notification config updated:", config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioNotificationConfig {
    return { ...this.config };
  }

  /**
   * Play notification sound
   */
  private async playSound(): Promise<void> {
    if (!this.audio) {
      logger.warn("Audio element not initialized");
      return;
    }

    try {
      // Reset audio to beginning
      this.audio.currentTime = 0;
      await this.audio.play();
      logger.debug("Audio notification played successfully");
    } catch (error) {
      logger.error("Failed to play audio notification:", error);
    }
  }

  /**
   * Handle message completion notification
   */
  async onMessageComplete(): Promise<void> {
    if (this.config.mode === "on_message") {
      await this.playSound();
    }
  }

  /**
   * Handle queue completion notification
   */
  async onQueueComplete(): Promise<void> {
    if (this.config.mode === "on_queue") {
      await this.playSound();
    }
  }

  /**
   * Test audio notification (always plays regardless of config)
   */
  async testNotification(): Promise<void> {
    await this.playSound();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
  }
}

/**
 * Global audio notification manager instance
 */
export const audioNotificationManager = new AudioNotificationManager();

/**
 * Load audio notification configuration from localStorage (independent of Claude settings)
 */
export function loadAudioConfigFromLocalStorage(): AudioNotificationConfig {
  try {
    const stored = localStorage.getItem('claudia-audio-notifications');
    if (stored) {
      const config = JSON.parse(stored);
      if (config && typeof config === "object" && config.mode) {
        return {
          mode: config.mode,
        };
      }
    }
  } catch (error) {
    logger.error("Failed to load audio config from localStorage:", error);
  }
  return DEFAULT_AUDIO_CONFIG;
}

/**
 * Save audio notification configuration to localStorage (independent of Claude settings)
 */
export function saveAudioConfigToLocalStorage(config: AudioNotificationConfig): void {
  try {
    localStorage.setItem('claudia-audio-notifications', JSON.stringify(config));
    logger.debug("Audio config saved to localStorage:", config);
  } catch (error) {
    logger.error("Failed to save audio config to localStorage:", error);
  }
}

/**
 * Legacy function - Load from Claude settings (for migration)
 */
export function loadAudioConfigFromSettings(settings: any): AudioNotificationConfig {
  try {
    const audioConfig = settings?.audioNotifications;
    if (audioConfig && typeof audioConfig === "object") {
      return {
        mode: audioConfig.mode || "off",
      };
    }
  } catch (error) {
    logger.error("Failed to load audio config from settings:", error);
  }
  return DEFAULT_AUDIO_CONFIG;
}