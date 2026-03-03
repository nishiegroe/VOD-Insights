/**
 * Electron IPC Handler for Native Video Playback
 * 
 * Handles video commands from React frontend and manages telemetry streaming.
 * Sets up bi-directional communication between:
 * - React/Frontend (sends video commands)
 * - Main process (handles IPC)
 * - Native module (libvlc wrapper)
 * - Worker thread (piscina for non-blocking operations)
 */

import { ipcMain, BrowserWindow } from 'electron';
import VideoPlayer from './native/build/Release/video_player';

interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  state: 'playing' | 'paused' | 'stopped';
  lastError?: string;
}

interface TelemetryFrame {
  timestamp: number;
  currentTime: number;
  duration: number;
  state: string;
  fps: number;
}

class VideoIpcHandler {
  private videoPlayer: InstanceType<typeof VideoPlayer> | null = null;
  private mainWindow: BrowserWindow | null = null;
  private telemetryInterval: NodeJS.Timer | null = null;
  private telemetryFrames: TelemetryFrame[] = [];
  private lastTelemetryTime: number = 0;
  private frameCount: number = 0;

  /**
   * Initialize IPC handlers and attach to main window
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Create native video player instance
    try {
      this.videoPlayer = new VideoPlayer();
    } catch (error) {
      console.error('Failed to create VideoPlayer:', error);
      return;
    }

    this.setupIpcHandlers();
  }

  /**
   * Setup all IPC event handlers
   */
  private setupIpcHandlers(): void {
    // Video initialization
    ipcMain.handle('video:initialize', async (_, filePath: string) => {
      return this.handleInitialize(filePath);
    });

    // Playback control
    ipcMain.handle('video:play', async () => {
      return this.handlePlay();
    });

    ipcMain.handle('video:pause', async () => {
      return this.handlePause();
    });

    ipcMain.handle('video:stop', async () => {
      return this.handleStop();
    });

    ipcMain.handle('video:seek', async (_, timeMs: number) => {
      return this.handleSeek(timeMs);
    });

    ipcMain.handle('video:setPlaybackRate', async (_, rate: number) => {
      return this.handleSetPlaybackRate(rate);
    });

    // State queries
    ipcMain.handle('video:getCurrentTime', async () => {
      return this.handleGetCurrentTime();
    });

    ipcMain.handle('video:getDuration', async () => {
      return this.handleGetDuration();
    });

    ipcMain.handle('video:getState', async () => {
      return this.handleGetState();
    });

    ipcMain.handle('video:isPlaying', async () => {
      return this.handleIsPlaying();
    });

    // Rendering and metrics (Phase 2)
    ipcMain.handle('video:setWindowHandle', async (_, hwnd: number | null) => {
      return this.handleSetWindowHandle(hwnd);
    });

    ipcMain.handle('video:getCurrentFrame', async () => {
      return this.handleGetCurrentFrame();
    });

    ipcMain.handle('video:getFps', async () => {
      return this.handleGetFps();
    });

    ipcMain.handle('video:getDimensions', async () => {
      return this.handleGetDimensions();
    });

    ipcMain.handle('video:getPerformanceMetrics', async () => {
      return this.handleGetPerformanceMetrics();
    });

    // Telemetry control
    ipcMain.handle('video:startTelemetry', async (_, interval: number = 33) => {
      return this.startTelemetry(interval);
    });

    ipcMain.handle('video:stopTelemetry', async () => {
      return this.stopTelemetry();
    });

    // Error handling
    ipcMain.handle('video:getLastError', async () => {
      return this.handleGetLastError();
    });

    ipcMain.handle('video:shutdown', async () => {
      return this.handleShutdown();
    });
  }

  /**
   * Initialize video player with file path
   */
  private handleInitialize(filePath: string): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.initialize(filePath);
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Start video playback
   */
  private handlePlay(): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.play();
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Pause video playback
   */
  private handlePause(): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.pause();
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop video playback
   */
  private handleStop(): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.stop();
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Seek to specific time
   */
  private handleSeek(timeMs: number): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.seek(timeMs);
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Set playback rate
   */
  private handleSetPlaybackRate(rate: number): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.setPlaybackRate(rate);
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get current playback time
   */
  private handleGetCurrentTime(): number {
    if (!this.videoPlayer) {
      return 0;
    }

    try {
      return this.videoPlayer.getCurrentTime();
    } catch (error) {
      console.error('Error getting current time:', error);
      return 0;
    }
  }

  /**
   * Get total duration
   */
  private handleGetDuration(): number {
    if (!this.videoPlayer) {
      return 0;
    }

    try {
      return this.videoPlayer.getDuration();
    } catch (error) {
      console.error('Error getting duration:', error);
      return 0;
    }
  }

  /**
   * Get playback state
   */
  private handleGetState(): VideoState {
    if (!this.videoPlayer) {
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        state: 'stopped'
      };
    }

    try {
      return {
        isPlaying: this.videoPlayer.isPlaying(),
        currentTime: this.videoPlayer.getCurrentTime(),
        duration: this.videoPlayer.getDuration(),
        state: this.videoPlayer.getState() as any
      };
    } catch (error) {
      console.error('Error getting state:', error);
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        state: 'stopped'
      };
    }
  }

  /**
   * Check if video is playing
   */
  private handleIsPlaying(): boolean {
    if (!this.videoPlayer) {
      return false;
    }

    try {
      return this.videoPlayer.isPlaying();
    } catch (error) {
      console.error('Error checking if playing:', error);
      return false;
    }
  }

  /**
   * Set native window handle for rendering
   */
  private handleSetWindowHandle(hwnd: number | null): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    try {
      const success = this.videoPlayer.setWindowHandle(hwnd);
      if (!success) {
        const error = this.videoPlayer.getLastError();
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get current frame number
   */
  private handleGetCurrentFrame(): number {
    if (!this.videoPlayer) {
      return 0;
    }

    try {
      return this.videoPlayer.getCurrentFrame();
    } catch (error) {
      console.error('Error getting current frame:', error);
      return 0;
    }
  }

  /**
   * Get video FPS from metadata
   */
  private handleGetFps(): number {
    if (!this.videoPlayer) {
      return 30.0;
    }

    try {
      return this.videoPlayer.getFps();
    } catch (error) {
      console.error('Error getting FPS:', error);
      return 30.0;
    }
  }

  /**
   * Get video dimensions
   */
  private handleGetDimensions(): { width: number; height: number; success: boolean } {
    if (!this.videoPlayer) {
      return { width: 0, height: 0, success: false };
    }

    try {
      return this.videoPlayer.getDimensions();
    } catch (error) {
      console.error('Error getting dimensions:', error);
      return { width: 0, height: 0, success: false };
    }
  }

  /**
   * Get performance metrics
   */
  private handleGetPerformanceMetrics(): any {
    if (!this.videoPlayer) {
      return {
        currentFps: 0,
        averageFps: 0,
        cpuPercent: 0,
        memoryMb: 0,
        seekLatencyMs: 0,
        frameDrops: 0,
        totalFramesRendered: 0
      };
    }

    try {
      return this.videoPlayer.getPerformanceMetrics();
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        currentFps: 0,
        averageFps: 0,
        cpuPercent: 0,
        memoryMb: 0,
        seekLatencyMs: 0,
        frameDrops: 0,
        totalFramesRendered: 0
      };
    }
  }

  /**
   * Get last error message
   */
  private handleGetLastError(): string {
    if (!this.videoPlayer) {
      return 'VideoPlayer not initialized';
    }

    try {
      return this.videoPlayer.getLastError();
    } catch (error) {
      return String(error);
    }
  }

  /**
   * Start telemetry streaming (state updates every 33ms)
   */
  private startTelemetry(interval: number = 33): { success: boolean; error?: string } {
    if (!this.videoPlayer) {
      return { success: false, error: 'VideoPlayer not initialized' };
    }

    if (this.telemetryInterval) {
      this.stopTelemetry();
    }

    try {
      this.lastTelemetryTime = Date.now();
      this.frameCount = 0;
      this.telemetryFrames = [];

      this.telemetryInterval = setInterval(() => {
        this.emitTelemetryFrame();
      }, interval);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop telemetry streaming
   */
  private stopTelemetry(): { success: boolean } {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    return { success: true };
  }

  /**
   * Emit a telemetry frame to the frontend
   */
  private emitTelemetryFrame(): void {
    if (!this.videoPlayer || !this.mainWindow) {
      return;
    }

    try {
      this.videoPlayer.processEvents();

      const now = Date.now();
      this.frameCount++;
      const elapsed = now - this.lastTelemetryTime;
      const fps = elapsed > 0 ? (this.frameCount * 1000) / elapsed : 0;

      const frame: TelemetryFrame = {
        timestamp: now,
        currentTime: this.videoPlayer.getCurrentTime(),
        duration: this.videoPlayer.getDuration(),
        state: this.videoPlayer.getState(),
        fps: Math.round(fps)
      };

      this.telemetryFrames.push(frame);

      // Keep only last 100 frames in memory
      if (this.telemetryFrames.length > 100) {
        this.telemetryFrames.shift();
      }

      // Send to renderer process
      this.mainWindow.webContents.send('video:telemetry', frame);
    } catch (error) {
      console.error('Error emitting telemetry:', error);
    }
  }

  /**
   * Shutdown and cleanup
   */
  private handleShutdown(): { success: boolean } {
    this.stopTelemetry();

    if (this.videoPlayer) {
      try {
        this.videoPlayer.shutdown();
      } catch (error) {
        console.error('Error shutting down VideoPlayer:', error);
      }
    }

    this.videoPlayer = null;
    this.mainWindow = null;

    return { success: true };
  }

  /**
   * Get telemetry history (last N frames)
   */
  public getTelemetryHistory(lastNFrames: number = 30): TelemetryFrame[] {
    return this.telemetryFrames.slice(-lastNFrames);
  }
}

export default VideoIpcHandler;
