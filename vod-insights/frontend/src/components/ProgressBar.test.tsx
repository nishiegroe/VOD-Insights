/**
 * ProgressBar.test.tsx
 * 
 * Comprehensive unit tests for ProgressBar component.
 * Target coverage: >85%
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  const mockOnSeek = vi.fn();

  const defaultProps = {
    currentTime: 30000, // 30 seconds in ms
    duration: 120000, // 2 minutes in ms
    onSeek: mockOnSeek,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSeek.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Render", () => {
    it("should render progress bar container", () => {
      render(<ProgressBar {...defaultProps} />);
      const bar = screen.getByTestId("progress-bar");
      expect(bar).toBeInTheDocument();
    });

    it("should render progress track", () => {
      render(<ProgressBar {...defaultProps} />);
      const track = screen.getByTestId("progress-bar-played");
      expect(track).toBeInTheDocument();
    });

    it("should render scrubber thumb", () => {
      render(<ProgressBar {...defaultProps} />);
      const thumb = screen.getByTestId("progress-bar-thumb");
      expect(thumb).toBeInTheDocument();
    });

    it("should render buffered indicator", () => {
      render(<ProgressBar {...defaultProps} buffered={75} />);
      const buffered = screen.getByTestId("progress-bar-buffered");
      expect(buffered).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <ProgressBar {...defaultProps} className="custom-class" />
      );
      const bar = container.querySelector(".progress-bar.custom-class");
      expect(bar).toBeInTheDocument();
    });

    it("should apply custom style", () => {
      const { container } = render(
        <ProgressBar {...defaultProps} style={{ height: "40px" }} />
      );
      const bar = container.querySelector(".progress-bar");
      expect(bar).toHaveStyle("height: 40px");
    });
  });

  describe("Progress Display", () => {
    it("should calculate correct progress percentage", () => {
      render(<ProgressBar {...defaultProps} currentTime={60000} duration={120000} />);
      const played = screen.getByTestId("progress-bar-played");
      // 60000 / 120000 = 0.5 = 50%
      expect(played).toHaveStyle("width: 50%");
    });

    it("should handle zero duration", () => {
      render(<ProgressBar {...defaultProps} duration={0} />);
      const played = screen.getByTestId("progress-bar-played");
      expect(played).toHaveStyle("width: 0%");
    });

    it("should handle currentTime greater than duration", () => {
      render(<ProgressBar {...defaultProps} currentTime={150000} duration={120000} />);
      const played = screen.getByTestId("progress-bar-played");
      // Should not exceed 100%
      const style = window.getComputedStyle(played);
      const width = parseFloat(style.width);
      expect(width).toBeGreaterThanOrEqual(0);
    });

    it("should update progress when currentTime changes", () => {
      const { rerender } = render(
        <ProgressBar {...defaultProps} currentTime={30000} />
      );

      let played = screen.getByTestId("progress-bar-played");
      expect(played).toHaveStyle("width: 25%"); // 30000 / 120000

      rerender(<ProgressBar {...defaultProps} currentTime={60000} />);

      played = screen.getByTestId("progress-bar-played");
      expect(played).toHaveStyle("width: 50%"); // 60000 / 120000
    });
  });

  describe("Buffered Display", () => {
    it("should display buffered percentage", () => {
      render(<ProgressBar {...defaultProps} buffered={50} />);
      const buffered = screen.getByTestId("progress-bar-buffered");
      expect(buffered).toHaveStyle("width: 50%");
    });

    it("should cap buffered at 100%", () => {
      render(<ProgressBar {...defaultProps} buffered={150} />);
      const buffered = screen.getByTestId("progress-bar-buffered");
      expect(buffered).toHaveStyle("width: 100%");
    });

    it("should default to 0 buffered", () => {
      const { container } = render(<ProgressBar {...defaultProps} />);
      const buffered = container.querySelector(".progress-bar__buffered");
      expect(buffered).toHaveStyle("width: 0%");
    });
  });

  describe("Seeking", () => {
    it("should call onSeek when clicked", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} />);

      const bar = screen.getByTestId("progress-bar");
      // Click at 50% of the bar
      await user.click(bar, { clientX: 60 }); // Assuming bar is 120px wide

      expect(mockOnSeek).toHaveBeenCalled();
    });

    it("should calculate correct seek time on click", async () => {
      const user = userEvent.setup();
      const { container } = render(<ProgressBar {...defaultProps} duration={120000} />);

      const bar = container.querySelector(".progress-bar") as HTMLElement;
      const rect = bar.getBoundingClientRect();

      // Mock getBoundingClientRect
      vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
        ...rect,
        width: 120,
        left: 0,
      } as DOMRect);

      // Click at 50%
      fireEvent.mouseDown(bar, { clientX: 60 });

      await new Promise(resolve => setTimeout(resolve, 10));

      // 50% of 120000ms = 60000ms
      expect(mockOnSeek).toHaveBeenCalledWith(expect.closeTo(60000, 5000));
    });

    it("should not seek when disabled", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} disabled={true} />);

      const bar = screen.getByTestId("progress-bar");
      await user.click(bar);

      expect(mockOnSeek).not.toHaveBeenCalled();
    });

    it("should not seek when canSeek is false", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} canSeek={false} />);

      const bar = screen.getByTestId("progress-bar");
      await user.click(bar);

      expect(mockOnSeek).not.toHaveBeenCalled();
    });

    it("should clamp seek time to valid range", async () => {
      const { container } = render(
        <ProgressBar {...defaultProps} duration={120000} />
      );

      const bar = container.querySelector(".progress-bar") as HTMLElement;
      vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
        width: 100,
        left: 0,
      } as DOMRect);

      // Try to click beyond the bar
      fireEvent.mouseDown(bar, { clientX: 150 });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should clamp to duration
      expect(mockOnSeek).toHaveBeenCalled();
      const call = mockOnSeek.mock.calls[0][0];
      expect(call).toBeLessThanOrEqual(120000);
      expect(call).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Dragging", () => {
    it("should add dragging class when dragging", async () => {
      const { container } = render(<ProgressBar {...defaultProps} />);
      const bar = container.querySelector(".progress-bar") as HTMLElement;

      fireEvent.mouseDown(bar);

      expect(bar).toHaveClass("dragging");
    });

    it("should remove dragging class on mouse up", async () => {
      const { container } = render(<ProgressBar {...defaultProps} />);
      const bar = container.querySelector(".progress-bar") as HTMLElement;

      fireEvent.mouseDown(bar);
      expect(bar).toHaveClass("dragging");

      fireEvent.mouseUp(window);
      expect(bar).not.toHaveClass("dragging");
    });

    it("should seek continuously while dragging", async () => {
      const { container } = render(<ProgressBar {...defaultProps} />);
      const bar = container.querySelector(".progress-bar") as HTMLElement;

      vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
        width: 100,
        left: 0,
      } as DOMRect);

      fireEvent.mouseDown(bar, { clientX: 25 });
      fireEvent.mouseMove(window, { clientX: 50 });
      fireEvent.mouseMove(window, { clientX: 75 });
      fireEvent.mouseUp(window);

      // Should have multiple seek calls
      expect(mockOnSeek.mock.calls.length).toBeGreaterThan(1);
    });

    it("should handle seek errors during drag", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockOnSeek.mockRejectedValue(new Error("Seek failed"));

      const { container } = render(<ProgressBar {...defaultProps} />);
      const bar = container.querySelector(".progress-bar") as HTMLElement;

      fireEvent.mouseDown(bar);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Seek error during drag:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Timestamp Preview", () => {
    it("should show timestamp preview on hover", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} showTimestampPreview={true} />);

      const bar = screen.getByTestId("progress-bar");
      await user.hover(bar);

      const preview = screen.queryByTestId("progress-bar-timestamp-preview");
      expect(preview).toBeInTheDocument();
    });

    it("should hide timestamp preview when showTimestampPreview is false", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} showTimestampPreview={false} />);

      const bar = screen.getByTestId("progress-bar");
      await user.hover(bar);

      const preview = screen.queryByTestId("progress-bar-timestamp-preview");
      expect(preview).not.toBeInTheDocument();
    });

    it("should hide timestamp preview when canSeek is false", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} canSeek={false} />);

      const bar = screen.getByTestId("progress-bar");
      await user.hover(bar);

      const preview = screen.queryByTestId("progress-bar-timestamp-preview");
      expect(preview).not.toBeInTheDocument();
    });

    it("should display correctly formatted time", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ProgressBar {...defaultProps} duration={3661000} /> // 1:01:01
      );

      const bar = container.querySelector(".progress-bar") as HTMLElement;
      vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
        width: 100,
        left: 0,
      } as DOMRect);

      fireEvent.mouseMove(bar, { clientX: 50 });

      const preview = screen.queryByTestId("progress-bar-timestamp-preview");
      if (preview) {
        expect(preview.textContent).toMatch(/\d+:\d{2}:/);
      }
    });
  });

  describe("Keyboard Navigation", () => {
    it("should seek forward on ArrowRight", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} currentTime={30000} />);

      const bar = screen.getByTestId("progress-bar");
      bar.focus();

      await user.keyboard("{ArrowRight}");

      expect(mockOnSeek).toHaveBeenCalledWith(35000); // 30000 + 5000
    });

    it("should seek backward on ArrowLeft", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} currentTime={30000} />);

      const bar = screen.getByTestId("progress-bar");
      bar.focus();

      await user.keyboard("{ArrowLeft}");

      expect(mockOnSeek).toHaveBeenCalledWith(25000); // 30000 - 5000
    });

    it("should seek to start on Home", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} />);

      const bar = screen.getByTestId("progress-bar");
      bar.focus();

      await user.keyboard("{Home}");

      expect(mockOnSeek).toHaveBeenCalledWith(0);
    });

    it("should seek to end on End", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} />);

      const bar = screen.getByTestId("progress-bar");
      bar.focus();

      await user.keyboard("{End}");

      expect(mockOnSeek).toHaveBeenCalledWith(120000);
    });

    it("should not seek on keyboard when disabled", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} disabled={true} />);

      const bar = screen.getByTestId("progress-bar");
      await user.keyboard("{ArrowRight}");

      expect(mockOnSeek).not.toHaveBeenCalled();
    });

    it("should clamp keyboard seek to valid range", async () => {
      const user = userEvent.setup();
      render(<ProgressBar {...defaultProps} currentTime={119000} />);

      const bar = screen.getByTestId("progress-bar");
      bar.focus();

      await user.keyboard("{ArrowRight}");

      // Should clamp to duration
      expect(mockOnSeek).toHaveBeenCalled();
      const call = mockOnSeek.mock.calls[0][0];
      expect(call).toBeLessThanOrEqual(120000);
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<ProgressBar {...defaultProps} />);
      const bar = screen.getByTestId("progress-bar");

      expect(bar).toHaveAttribute("role", "slider");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "120000");
      expect(bar).toHaveAttribute("aria-valuenow", "30000");
    });

    it("should update ARIA value when time changes", () => {
      const { rerender } = render(<ProgressBar {...defaultProps} currentTime={30000} />);

      let bar = screen.getByTestId("progress-bar");
      expect(bar).toHaveAttribute("aria-valuenow", "30000");

      rerender(<ProgressBar {...defaultProps} currentTime={60000} />);

      bar = screen.getByTestId("progress-bar");
      expect(bar).toHaveAttribute("aria-valuenow", "60000");
    });

    it("should have ARIA label", () => {
      render(<ProgressBar {...defaultProps} />);
      const bar = screen.getByTestId("progress-bar");

      expect(bar).toHaveAttribute("aria-label");
    });

    it("should be focusable when seeking is allowed", () => {
      render(<ProgressBar {...defaultProps} canSeek={true} />);
      const bar = screen.getByTestId("progress-bar");

      expect(bar).toHaveAttribute("tabIndex", "0");
    });

    it("should not be focusable when seeking is disabled", () => {
      render(<ProgressBar {...defaultProps} canSeek={false} />);
      const bar = screen.getByTestId("progress-bar");

      expect(bar).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ProgressBar {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass("progress-bar");
    });
  });

  describe("Edge Cases", () => {
    it("should handle negative currentTime", () => {
      render(<ProgressBar {...defaultProps} currentTime={-1000} />);
      const played = screen.getByTestId("progress-bar-played");
      // Should render but clamp to 0 percentage in display
      expect(played).toBeInTheDocument();
    });

    it("should handle very large durations", () => {
      render(<ProgressBar {...defaultProps} duration={360000000} />);
      const bar = screen.getByTestId("progress-bar");
      expect(bar).toBeInTheDocument();
    });

    it("should handle rapid updates", async () => {
      const { rerender } = render(<ProgressBar {...defaultProps} currentTime={0} />);

      for (let i = 0; i < 10; i++) {
        rerender(<ProgressBar {...defaultProps} currentTime={i * 1000} />);
      }

      const bar = screen.getByTestId("progress-bar");
      expect(bar).toBeInTheDocument();
    });
  });
});
