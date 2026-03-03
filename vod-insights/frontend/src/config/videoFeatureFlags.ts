/**
 * videoFeatureFlags.ts
 * 
 * Feature flag system for native video player.
 * Enables A/B testing and gradual rollout of native video functionality.
 */

export type FeatureFlagSource = "env" | "localStorage" | "hardcoded" | "override";

export interface FeatureFlagConfig {
  enableNativeVideo: boolean;
  enableVideoTelemetry: boolean;
  enableVideoDebug: boolean;
  nativeVideoSampleRate: number; // percentage: 0-100
  fallbackOnError: boolean;
}

/**
 * Feature flag manager
 * Supports multiple sources with priority hierarchy:
 * 1. Override (highest priority)
 * 2. localStorage
 * 3. Environment variables
 * 4. Hardcoded defaults (lowest priority)
 */
class VideoFeatureFlagManager {
  private flags: FeatureFlagConfig;
  private sources: Map<string, FeatureFlagSource> = new Map();
  private localStorage: typeof window.localStorage | null = null;

  constructor() {
    // Try to get localStorage (may not be available in all contexts)
    if (typeof window !== "undefined" && window.localStorage) {
      this.localStorage = window.localStorage;
    }

    // Initialize with defaults
    this.flags = this.loadFlags();
  }

  /**
   * Load flags from all available sources
   */
  private loadFlags(): FeatureFlagConfig {
    const defaults: FeatureFlagConfig = {
      enableNativeVideo: false,
      enableVideoTelemetry: true,
      enableVideoDebug: false,
      nativeVideoSampleRate: 0,
      fallbackOnError: true,
    };

    const config: FeatureFlagConfig = { ...defaults };

    // Load from environment (lowest priority after defaults)
    if (typeof process !== "undefined" && process.env) {
      if (process.env.VITE_NATIVE_VIDEO_ENABLED === "true") {
        config.enableNativeVideo = true;
        this.sources.set("enableNativeVideo", "env");
      }
      if (process.env.VITE_VIDEO_TELEMETRY_ENABLED === "false") {
        config.enableVideoTelemetry = false;
        this.sources.set("enableVideoTelemetry", "env");
      }
      if (process.env.VITE_VIDEO_DEBUG_ENABLED === "true") {
        config.enableVideoDebug = true;
        this.sources.set("enableVideoDebug", "env");
      }
      if (process.env.VITE_NATIVE_VIDEO_SAMPLE_RATE) {
        const rate = Math.min(
          100,
          Math.max(0, parseInt(process.env.VITE_NATIVE_VIDEO_SAMPLE_RATE, 10))
        );
        config.nativeVideoSampleRate = rate;
        this.sources.set("nativeVideoSampleRate", "env");
      }
    }

    // Load from localStorage (higher priority than env)
    if (this.localStorage) {
      try {
        const stored = this.localStorage.getItem("videoFeatureFlags");
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.keys(parsed).forEach((key) => {
            if (key in config) {
              (config as any)[key] = parsed[key];
              this.sources.set(key, "localStorage");
            }
          });
        }
      } catch (error) {
        console.warn("Error loading feature flags from localStorage:", error);
      }
    }

    return config;
  }

  /**
   * Get a feature flag value
   */
  getFlag(flagName: keyof FeatureFlagConfig): any {
    return this.flags[flagName];
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlagConfig {
    return { ...this.flags };
  }

  /**
   * Get flag source (for debugging)
   */
  getFlagSource(flagName: keyof FeatureFlagConfig): FeatureFlagSource {
    return this.sources.get(flagName) || "hardcoded";
  }

  /**
   * Set a flag (override)
   * @param flagName Flag to set
   * @param value Value to set
   * @param persist Whether to persist to localStorage
   */
  setFlag(
    flagName: keyof FeatureFlagConfig,
    value: any,
    persist = true
  ): void {
    this.flags[flagName] = value;
    this.sources.set(flagName, "override");

    if (persist && this.localStorage) {
      try {
        const current = this.localStorage.getItem("videoFeatureFlags");
        const parsed = current ? JSON.parse(current) : {};
        parsed[flagName] = value;
        this.localStorage.setItem("videoFeatureFlags", JSON.stringify(parsed));
      } catch (error) {
        console.warn("Error persisting feature flag to localStorage:", error);
      }
    }
  }

  /**
   * Check if native video should be enabled for this instance
   * Considers sample rate for A/B testing
   */
  shouldEnableNativeVideo(): boolean {
    if (!this.flags.enableNativeVideo) {
      return false;
    }

    // If sample rate is 100, always enable
    if (this.flags.nativeVideoSampleRate >= 100) {
      return true;
    }

    // If sample rate is 0, always disable
    if (this.flags.nativeVideoSampleRate <= 0) {
      return false;
    }

    // Use deterministic hashing based on user/session to ensure consistent A/B testing
    const hash = this.getSessionHash();
    return hash % 100 < this.flags.nativeVideoSampleRate;
  }

  /**
   * Reset all flags to defaults
   */
  resetToDefaults(): void {
    this.flags = {
      enableNativeVideo: false,
      enableVideoTelemetry: true,
      enableVideoDebug: false,
      nativeVideoSampleRate: 0,
      fallbackOnError: true,
    };
    this.sources.clear();

    if (this.localStorage) {
      try {
        this.localStorage.removeItem("videoFeatureFlags");
      } catch (error) {
        console.warn("Error resetting feature flags:", error);
      }
    }
  }

  /**
   * Get a session hash for consistent A/B testing
   */
  private getSessionHash(): number {
    // Use a simple hash of the current session
    // In production, this could be based on userId or sessionId
    const seed = typeof window !== "undefined" && window.performance
      ? Math.floor(window.performance.timeOrigin) % 1000
      : Math.random() * 1000;

    return Math.floor(seed);
  }

  /**
   * Debug log all flags and their sources
   */
  logDebugInfo(): void {
    console.group("🎬 Video Feature Flags");
    Object.entries(this.flags).forEach(([key, value]) => {
      const source = this.sources.get(key as keyof FeatureFlagConfig) || "hardcoded";
      console.log(`  ${key}: ${JSON.stringify(value)} [${source}]`);
    });
    console.log(
      `  shouldEnableNativeVideo(): ${this.shouldEnableNativeVideo()}`
    );
    console.groupEnd();
  }
}

// Singleton instance
let flagManager: VideoFeatureFlagManager | null = null;

/**
 * Get or create feature flag manager
 */
export function getVideoFeatureFlagManager(): VideoFeatureFlagManager {
  if (!flagManager) {
    flagManager = new VideoFeatureFlagManager();
  }
  return flagManager;
}

/**
 * Check if native video is enabled
 */
export function isNativeVideoEnabled(): boolean {
  return getVideoFeatureFlagManager().shouldEnableNativeVideo();
}

/**
 * Check if video telemetry is enabled
 */
export function isVideoTelemetryEnabled(): boolean {
  return getVideoFeatureFlagManager().getFlag("enableVideoTelemetry");
}

/**
 * Check if video debug mode is enabled
 */
export function isVideoDebugEnabled(): boolean {
  return getVideoFeatureFlagManager().getFlag("enableVideoDebug");
}

/**
 * Set native video flag (for testing/debugging)
 */
export function setNativeVideoEnabled(
  enabled: boolean,
  persist = true
): void {
  getVideoFeatureFlagManager().setFlag("enableNativeVideo", enabled, persist);
}

/**
 * Log all feature flags (for debugging)
 */
export function logVideoFeatureFlags(): void {
  getVideoFeatureFlagManager().logDebugInfo();
}

export default getVideoFeatureFlagManager;
