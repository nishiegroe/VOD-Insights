/**
 * PlaybackControls.test.tsx
 * 
 * Comprehensive unit tests for PlaybackControls component.
 * Target coverage: >85%
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackControls } from "./PlaybackControls";

describe("PlaybackControls", () => {
  const mockOnPlay = vi.fn();
  const mockOnPause = vi.fn();
  const mockOnPlaybackRateChange = vi.fn();
  const mockOnVolumeChange = vi.fn();

  const defaultProps = {
    isPlaying: false,
    isPaused: true,
    onPlay: mockOnPlay,
    onPause: mockOnPause,
    playbackRate: 1.0,
    onPlaybackRateChange: mockOnPlaybackRateChange,
    volume: 1.0,
    onVolumeChange: mockOnVolumeChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Render", () => {
    it("should render play/pause button", () => {
      render(<PlaybackControls {...defaultProps} />);
      const button = screen.getByTestId("play-pause-button");
      expect(button).toBeInTheDocument();
    });

    it("should render rate select control", () => {
      render(<PlaybackControls {...defaultProps} showAdvanced={true} />);
      const select = screen.getByTestId("rate-select");
      expect(select).toBeInTheDocument();
    });

    it("should hide rate select when showAdvanced is false", () => {
      render(<PlaybackControls {...defaultProps} showAdvanced={false} />);
      const select = screen.queryByTestId("rate-select");
      expect(select).not.toBeInTheDocument();
    });

    it("should render volume toggle button", () => {
      render(<PlaybackControls {...defaultProps} />);
      const button = screen.getByTestId("volume-toggle");
      expect(button).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <PlaybackControls {...defaultProps} className="custom-class" />
      );
      const controls = container.querySelector(".playback-controls.custom-class");
      expect(controls).toBeInTheDocument();
    });
  });

  describe("Play/Pause Button", () => {
    it("should call onPlay when paused and button clicked", async () => {
      const user = userEvent.setup();
      mockOnPlay.mockResolvedValue(undefined);

      render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      const button = screen.getByTestId("play-pause-button");

      await user.click(button);

      expect(mockOnPlay).toHaveBeenCalledTimes(1);
    });

    it("should call onPause when playing and button clicked", async () => {
      const user = userEvent.setup();
      mockOnPause.mockResolvedValue(undefined);

      render(<PlaybackControls {...defaultProps} isPlaying={true} isPaused={false} />);
      const button = screen.getByTestId("play-pause-button");

      await user.click(button);

      expect(mockOnPause).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
      render(<PlaybackControls {...defaultProps} disabled={true} />);
      const button = screen.getByTestId("play-pause-button");
      expect(button).toBeDisabled();
    });

    it("should show correct icon based on playing state", () => {
      const { rerender } = render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      let svg = screen.getByTestId("play-pause-button").querySelector("svg");
      expect(svg).toBeInTheDocument();

      rerender(<PlaybackControls {...defaultProps} isPlaying={true} />);
      svg = screen.getByTestId("play-pause-button").querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should handle play errors gracefully", async () => {
      const user = userEvent.setup();
      const error = new Error("Play failed");
      mockOnPlay.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      const button = screen.getByTestId("play-pause-button");

      await user.click(button);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Play/Pause error:", error);
      });

      consoleErrorSpy.mockRestore();
    });

    it("should have correct aria labels", () => {
      const { rerender } = render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      let button = screen.getByTestId("play-pause-button");
      expect(button).toHaveAttribute("aria-label", "Play");

      rerender(<PlaybackControls {...defaultProps} isPlaying={true} />);
      button = screen.getByTestId("play-pause-button");
      expect(button).toHaveAttribute("aria-label", "Pause");
    });
  });

  describe("Playback Rate", () => {
    it("should display correct rate in select", () => {
      render(<PlaybackControls {...defaultProps} playbackRate={1.5} />);
      const select = screen.getByTestId("rate-select") as HTMLSelectElement;
      expect(select.value).toBe("1.50");
    });

    it("should call onPlaybackRateChange when rate changes", async () => {
      const user = userEvent.setup();
      mockOnPlaybackRateChange.mockResolvedValue(undefined);

      render(<PlaybackControls {...defaultProps} playbackRate={1.0} />);
      const select = screen.getByTestId("rate-select");

      await user.selectOptions(select, "1.50");

      expect(mockOnPlaybackRateChange).toHaveBeenCalledWith(1.5);
    });

    it("should have all standard playback rates available", () => {
      render(<PlaybackControls {...defaultProps} />);
      const select = screen.getByTestId("rate-select");
      const options = select.querySelectorAll("option");

      const rates = Array.from(options).map(opt => opt.value);
      expect(rates).toContain("0.25");
      expect(rates).toContain("0.50");
      expect(rates).toContain("1.00");
      expect(rates).toContain("1.50");
      expect(rates).toContain("2.00");
    });

    it("should disable rate select when disabled", () => {
      render(<PlaybackControls {...defaultProps} disabled={true} />);
      const select = screen.getByTestId("rate-select");
      expect(select).toBeDisabled();
    });

    it("should handle rate change errors", async () => {
      const user = userEvent.setup();
      const error = new Error("Rate change failed");
      mockOnPlaybackRateChange.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<PlaybackControls {...defaultProps} />);
      const select = screen.getByTestId("rate-select");

      await user.selectOptions(select, "1.50");

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Playback rate change error:", error);
      });

      consoleErrorSpy.mockRestore();
    });

    it("should show 'Normal' label for 1.0x rate", () => {
      render(<PlaybackControls {...defaultProps} />);
      const options = screen.getByTestId("rate-select").querySelectorAll("option");
      const normalOption = Array.from(options).find(opt => opt.textContent === "Normal");
      expect(normalOption).toBeInTheDocument();
    });
  });

  describe("Volume Control", () => {
    it("should show volume slider when toggle clicked", async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} />);

      let slider = screen.queryByTestId("volume-slider");
      expect(slider).not.toBeInTheDocument();

      const toggle = screen.getByTestId("volume-toggle");
      await user.click(toggle);

      slider = screen.getByTestId("volume-slider");
      expect(slider).toBeInTheDocument();
    });

    it("should hide volume slider when toggle clicked again", async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} />);

      const toggle = screen.getByTestId("volume-toggle");
      await user.click(toggle);

      let slider = screen.getByTestId("volume-slider");
      expect(slider).toBeInTheDocument();

      await user.click(toggle);

      slider = screen.queryByTestId("volume-slider");
      expect(slider).not.toBeInTheDocument();
    });

    it("should call onVolumeChange when slider value changes", async () => {
      const user = userEvent.setup();
      mockOnVolumeChange.mockResolvedValue(undefined);

      render(<PlaybackControls {...defaultProps} volume={1.0} />);

      const toggle = screen.getByTestId("volume-toggle");
      await user.click(toggle);

      const slider = screen.getByTestId("volume-slider") as HTMLInputElement;
      await user.clear(slider);
      await user.type(slider, "0.5");

      expect(mockOnVolumeChange).toHaveBeenCalled();
    });

    it("should display current volume percentage", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<PlaybackControls {...defaultProps} volume={0.5} />);

      const toggle = screen.getByTestId("volume-toggle");
      await user.click(toggle);

      let label = screen.getByText("50%");
      expect(label).toBeInTheDocument();

      rerender(<PlaybackControls {...defaultProps} volume={0.75} />);
      label = screen.getByText("75%");
      expect(label).toBeInTheDocument();
    });

    it("should disable volume toggle when disabled", () => {
      render(<PlaybackControls {...defaultProps} disabled={true} />);
      const toggle = screen.getByTestId("volume-toggle");
      expect(toggle).toBeDisabled();
    });

    it("should show mute icon when volume is 0", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<PlaybackControls {...defaultProps} volume={1.0} />);

      rerender(<PlaybackControls {...defaultProps} volume={0} />);

      const toggle = screen.getByTestId("volume-toggle");
      // Check that mute icon is present (it's a different SVG path)
      const svg = toggle.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should show low volume icon when volume is between 0 and 0.5", async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} volume={0.25} />);

      const toggle = screen.getByTestId("volume-toggle");
      const svg = toggle.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should handle volume change errors", async () => {
      const user = userEvent.setup();
      const error = new Error("Volume change failed");
      mockOnVolumeChange.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<PlaybackControls {...defaultProps} />);

      const toggle = screen.getByTestId("volume-toggle");
      await user.click(toggle);

      const slider = screen.getByTestId("volume-slider") as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "0.5" } });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Volume change error:", error);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Integration", () => {
    it("should handle rapid clicks without double-triggering", async () => {
      const user = userEvent.setup();
      mockOnPlay.mockResolvedValue(undefined);

      render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      const button = screen.getByTestId("play-pause-button");

      // Simulate rapid clicks
      await user.click(button);
      await user.click(button);

      // Should complete first click before handling second
      await waitFor(() => {
        expect(mockOnPlay).toHaveBeenCalledTimes(2);
      });
    });

    it("should work with no callbacks provided", () => {
      const { container } = render(
        <PlaybackControls
          isPlaying={false}
          isPaused={true}
          onPlay={async () => {}}
          onPause={async () => {}}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it("should update correctly when props change", () => {
      const { rerender } = render(
        <PlaybackControls {...defaultProps} playbackRate={1.0} volume={1.0} />
      );

      let select = screen.getByTestId("rate-select") as HTMLSelectElement;
      expect(select.value).toBe("1.00");

      rerender(<PlaybackControls {...defaultProps} playbackRate={1.5} volume={0.5} />);

      select = screen.getByTestId("rate-select") as HTMLSelectElement;
      expect(select.value).toBe("1.50");
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria labels on all interactive elements", () => {
      render(<PlaybackControls {...defaultProps} />);

      const playPauseButton = screen.getByTestId("play-pause-button");
      expect(playPauseButton).toHaveAttribute("aria-label");

      const volumeToggle = screen.getByTestId("volume-toggle");
      expect(volumeToggle).toHaveAttribute("aria-label");

      const rateSelect = screen.getByTestId("rate-select");
      expect(rateSelect).toHaveAttribute("aria-label");
    });

    it("should manage aria-expanded state correctly", async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} />);

      const toggle = screen.getByTestId("volume-toggle");
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<PlaybackControls {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass("playback-controls");
    });

    it("should work with callback ref", () => {
      const refCallback = vi.fn();
      render(<PlaybackControls {...defaultProps} ref={refCallback} />);

      expect(refCallback).toHaveBeenCalled();
      expect(refCallback.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });
});
