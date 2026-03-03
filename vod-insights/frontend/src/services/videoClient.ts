/**
 * videoClient.ts
 * 
 * IPC communication wrapper for native video player control.
 * Provides a type-safe interface for invoking native video operations
 * and receiving playback telemetry.
 */

export type PlaybackState = "playing" | "paused" | "stopped";

export interface PlaybackTelemetry {
  currentTime: number; // milliseconds
  duration: number; // milliseconds
  state: PlaybackState;
  timestamp: number; // Date.now()
}

export interface VideoClientError {
  code: string;
  message: string;
  context?: string;
}

export type TelemetryCallback = (telemetry: PlaybackTelemetry) => void;
export type ErrorCallback = (error: VideoClientError) => void;

/**
 * VideoClient: Thread-safe IPC communication for native video control
 * 
 * - Manages command queue for buffering operations
 * - Handles error recovery and fallback scenarios
 * - Provides callbacks for telemetry and errors
 * - Type-safe wrapper around ipcRenderer
 */
class VideoClient {
  private ipcRenderer?: any;
  private isInitialized = false;
  private commandQueue: Array<{
    method: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private isProcessingQueue = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private lastError: VideoClientError | null = null;

  /**
   * Initialize the VideoClient
   * Attempts to load ipcRenderer from window context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we're in Electron renderer process
      if (typeof window !== "undefined" && (window as any).aetDesktop) {
        this.ipcRenderer = (window as any).ipcRenderer;
        if (!this.ipcRenderer) {
          console.warn(
            "VideoClient: ipcRenderer not available in window context"
          );
          return;
        }
        this.isInitialized = true;
        await this.setupTelemetryListener();
      } else {
        console.warn(
          "VideoClient: Not in Electron context, native video unavailable"
        );
      }
    } catch (error) {
      console.error("VideoClient initialization error:", error);
    }
  }

  /**
   * Check if native video is available
   */
  isAvailable(): boolean {
    return this.isInitialized && !!this.ipcRenderer;
  }

  /**
   * Get the last error that occurred
   */
  getLastError(): VideoClientError | null {
    return this.lastError;
  }

  /**
   * Initialize native video player
   * @param filePath Path to video file
   * @returns Promise resolving when initialization is complete
   */
  async initializePlayer(filePath: string): Promise<void> {
    if (!this.isAvailable()) {
      throw this.createError(
        "UNAVAILABLE",
        "Native video not available",
        "initializePlayer"
      );
    }

    try {
      await this.queueCommand("video:initialize", [filePath]);
    } catch (error) {
      this.handleError("INIT_FAILED", String(error), "initializePlayer");
      throw this.lastError;
    }
  }

  /**
   * Play video
   */
  async play(): Promise<void> {
    return this.queueCommand("video:play", []);
  }

  /**
   * Pause video
   */
  async pause(): Promise<void> {
    return this.queueCommand("video:pause", []);
  }

  /**
   * Stop video and release resources
   */
  async stop(): Promise<void> {
    return this.queueCommand("video:stop", []);
  }

  /**
   * Seek to specific time
   * @param timeMs Time in milliseconds
   */
  async seek(timeMs: number): Promise<void> {
    if (typeof timeMs !== "number" || timeMs < 0) {
      throw this.createError(
        "INVALID_ARG",
        "timeMs must be a non-negative number",
        "seek"
      );
    }
    return this.queueCommand("video:seek", [timeMs]);
  }

  /**
   * Set playback rate
   * @param rate Playback rate (1.0 = normal, 2.0 = 2x, 0.5 = 0.5x)
   */
  async setPlaybackRate(rate: number): Promise<void> {
    if (typeof rate !== "number" || rate <= 0) {
      throw this.createError(
        "INVALID_ARG",
        "rate must be a positive number",
        "setPlaybackRate"
      );
    }
    return this.queueCommand("video:set-rate", [rate]);
  }

  /**
   * Get current playback state
   */
  async getState(): Promise<PlaybackState> {
    const state = await this.queueCommand("video:get-state", []);
    return state as PlaybackState;
  }

  /**
   * Get current playback time in milliseconds
   */
  async getCurrentTime(): Promise<number> {
    const time = await this.queueCommand("video:get-time", []);
    return time as number;
  }

  /**
   * Get total duration in milliseconds
   */
  async getDuration(): Promise<number> {
    const duration = await this.queueCommand("video:get-duration", []);
    return duration as number;
  }

  /**
   * Register telemetry callback
   * Called whenever playback telemetry is available
   */
  onTelemetry(callback: TelemetryCallback): () => void {
    if (!this.listeners.has("telemetry")) {
      this.listeners.set("telemetry", new Set());
    }
    this.listeners.get("telemetry")!.add(callback);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get("telemetry");
      if (set) {
        set.delete(callback);
      }
    };
  }

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): () => void {
    if (!this.listeners.has("error")) {
      this.listeners.set("error", new Set());
    }
    this.listeners.get("error")!.add(callback);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get("error");
      if (set) {
        set.delete(callback);
      }
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      await this.queueCommand("video:shutdown", []);
    } catch (error) {
      console.warn("Error shutting down video client:", error);
    }
    this.isInitialized = false;
    this.listeners.clear();
    this.commandQueue = [];
  }

  // ============ Private Methods ============

  /**
   * Queue a command for execution
   * Ensures commands are processed sequentially
   */
  private queueCommand(method: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        method,
        args,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Process command queue
   * Ensures sequential execution and error handling
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (!command) break;

      try {
        if (!this.ipcRenderer) {
          throw this.createError(
            "UNAVAILABLE",
            "ipcRenderer not available",
            command.method
          );
        }

        const result = await this.ipcRenderer.invoke(command.method, ...command.args);
        command.resolve(result);
      } catch (error) {
        const videoError = this.createError(
          "INVOCATION_FAILED",
          String(error),
          command.method
        );
        this.handleError(videoError.code, videoError.message, command.method);
        command.reject(videoError);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Setup telemetry listener from main process
   */
  private async setupTelemetryListener(): Promise<void> {
    if (!this.ipcRenderer) return;

    try {
      this.ipcRenderer.on("video:telemetry", (event: any, telemetry: PlaybackTelemetry) => {
        this.emitTelemetry(telemetry);
      });

      this.ipcRenderer.on("video:error", (event: any, error: VideoClientError) => {
        this.handleErrorEvent(error);
      });
    } catch (error) {
      console.warn("Failed to setup telemetry listener:", error);
    }
  }

  /**
   * Emit telemetry to all listeners
   */
  private emitTelemetry(telemetry: PlaybackTelemetry): void {
    const callbacks = this.listeners.get("telemetry");
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(telemetry);
        } catch (error) {
          console.error("Telemetry callback error:", error);
        }
      });
    }
  }

  /**
   * Emit error to all listeners
   */
  private emitError(error: VideoClientError): void {
    const callbacks = this.listeners.get("error");
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(error);
        } catch (error) {
          console.error("Error callback error:", error);
        }
      });
    }
  }

  /**
   * Handle error event from main process
   */
  private handleErrorEvent(error: VideoClientError): void {
    this.lastError = error;
    this.emitError(error);
  }

  /**
   * Create a VideoClientError
   */
  private createError(
    code: string,
    message: string,
    context?: string
  ): VideoClientError {
    return {
      code,
      message,
      context,
    };
  }

  /**
   * Handle error (store and emit)
   */
  private handleError(code: string, message: string, context?: string): void {
    const error = this.createError(code, message, context);
    this.lastError = error;
    this.emitError(error);
  }
}

// Singleton instance
let videoClient: VideoClient | null = null;

/**
 * Get or create VideoClient singleton
 */
export function getVideoClient(): VideoClient {
  if (!videoClient) {
    videoClient = new VideoClient();
  }
  return videoClient;
}

/**
 * Initialize the video client
 */
export async function initializeVideoClient(): Promise<void> {
  const client = getVideoClient();
  await client.initialize();
}

export default VideoClient;
