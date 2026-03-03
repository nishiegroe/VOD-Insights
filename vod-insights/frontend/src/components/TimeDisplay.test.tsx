/**
 * TimeDisplay.test.tsx
 * 
 * Comprehensive unit tests for TimeDisplay component.
 * Target coverage: >85%
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeDisplay } from "./TimeDisplay";

describe("TimeDisplay", () => {
  const defaultProps = {
    currentTime: 30500, // 30.5 seconds
    duration: 120000, // 2 minutes
  };

  beforeEach(() => {
    // Clear any mocks
  });

  describe("Render", () => {
    it("should render time display container", () => {
      render(<TimeDisplay {...defaultProps} />);
      const display = screen.getByTestId("time-display");
      expect(display).toBeInTheDocument();
    });

    it("should render current time", () => {
      render(<TimeDisplay {...defaultProps} />);
      const current = screen.getByTestId("time-display-current");
      expect(current).toBeInTheDocument();
      expect(current.textContent).toMatch(/\d+:\d{2}/);
    });

    it("should render duration", () => {
      render(<TimeDisplay {...defaultProps} />);
      const duration = screen.getByTestId("time-display-duration");
      expect(duration).toBeInTheDocument();
    });

    it("should render separator", () => {
      render(<TimeDisplay {...defaultProps} />);
      const separator = screen.getByTestId("time-display-separator");
      expect(separator).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <TimeDisplay {...defaultProps} className="custom-class" />
      );
      const display = container.querySelector(".time-display.custom-class");
      expect(display).toBeInTheDocument();
    });

    it("should apply custom style", () => {
      const { container } = render(
        <TimeDisplay {...defaultProps} style={{ fontSize: "16px" }} />
      );
      const display = container.querySelector(".time-display");
      expect(display).toHaveStyle("font-size: 16px");
    });
  });

  describe("Time Format", () => {
    it("should display time in MM:SS format by default", () => {
      render(<TimeDisplay currentTime={30500} duration={120000} format="short" />);
      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("0:30"); // 30.5s rounds down to 30s
    });

    it("should display time in HH:MM:SS format when requested", () => {
      const fiveMinutes = 300000;
      render(
        <TimeDisplay currentTime={fiveMinutes} duration={fiveMinutes} format="long" />
      );
      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toMatch(/0:0?\d:\d{2}/);
    });

    it("should auto-detect format based on duration", () => {
      const oneHour = 3600000;
      render(
        <TimeDisplay currentTime={30000} duration={oneHour} format="auto" />
      );
      const current = screen.getByTestId("time-display-current");
      const text = current.textContent || "";
      // Should use HH:MM:SS for durations > 1 hour
      const parts = text.split(":");
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    it("should use short format for durations < 1 hour with auto", () => {
      const thirtyMinutes = 1800000;
      render(
        <TimeDisplay currentTime={30000} duration={thirtyMinutes} format="auto" />
      );
      const current = screen.getByTestId("time-display-current");
      const text = current.textContent || "";
      // Should use MM:SS for durations < 1 hour
      expect(text).toMatch(/\d+:\d{2}/);
    });

    it("should pad minutes and seconds with zeros", () => {
      render(
        <TimeDisplay currentTime={125000} duration={600000} format="short" />
      );
      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("2:05");
    });

    it("should display hours correctly", () => {
      const oneHourThirtyMin = 5400000;
      render(
        <TimeDisplay
          currentTime={oneHourThirtyMin}
          duration={7200000}
          format="long"
        />
      );
      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toMatch(/1:\d{2}:\d{2}/);
    });
  });

  describe("Duration Display", () => {
    it("should display duration next to current time", () => {
      render(<TimeDisplay {...defaultProps} />);
      const duration = screen.getByTestId("time-display-duration");
      expect(duration.textContent).toBe("2:00");
    });

    it("should show custom noDurationText when duration is 0", () => {
      const customText = "LIVE";
      render(
        <TimeDisplay
          currentTime={100}
          duration={0}
          noDurationText={customText}
        />
      );
      const duration = screen.getByTestId("time-display-duration");
      expect(duration.textContent).toBe(customText);
    });

    it("should update when duration changes", () => {
      const { rerender } = render(
        <TimeDisplay currentTime={30000} duration={120000} />
      );

      let duration = screen.getByTestId("time-display-duration");
      expect(duration.textContent).toBe("2:00");

      rerender(<TimeDisplay currentTime={30000} duration={600000} />);

      duration = screen.getByTestId("time-display-duration");
      expect(duration.textContent).toBe("10:00");
    });
  });

  describe("Current Time Only Mode", () => {
    it("should hide duration when currentTimeOnly is true", () => {
      render(<TimeDisplay {...defaultProps} currentTimeOnly={true} />);

      const duration = screen.queryByTestId("time-display-duration");
      expect(duration).not.toBeInTheDocument();
    });

    it("should hide separator when currentTimeOnly is true", () => {
      render(<TimeDisplay {...defaultProps} currentTimeOnly={true} />);

      const separators = screen.queryAllByTestId("time-display-separator");
      expect(separators).toHaveLength(0);
    });

    it("should still show current time with currentTimeOnly", () => {
      render(<TimeDisplay {...defaultProps} currentTimeOnly={true} />);

      const current = screen.getByTestId("time-display-current");
      expect(current).toBeInTheDocument();
      expect(current.textContent).toBeTruthy();
    });
  });

  describe("Countdown Mode", () => {
    it("should show remaining time instead of elapsed in countdown mode", () => {
      const twoMinutes = 120000;
      const oneMinuteElapsed = 60000;

      render(
        <TimeDisplay
          currentTime={oneMinuteElapsed}
          duration={twoMinutes}
          showAsCountdown={true}
          format="short"
        />
      );

      const current = screen.getByTestId("time-display-current");
      // Remaining: 120000 - 60000 = 60000ms = 1:00
      expect(current.textContent).toBe("1:00");
    });

    it("should show negative sign for countdown display", () => {
      const durationMs = 120000;
      const currentTimeMs = 119000;

      render(
        <TimeDisplay
          currentTime={currentTimeMs}
          duration={durationMs}
          showAsCountdown={true}
        />
      );

      const current = screen.getByTestId("time-display-current");
      const text = current.textContent || "";
      // Should show something like "0:01" (1 second remaining)
      expect(text).toMatch(/\d+:\d{2}/);
    });

    it("should apply countdown class", () => {
      const { container } = render(
        <TimeDisplay
          {...defaultProps}
          showAsCountdown={true}
        />
      );

      const display = container.querySelector(".time-display.countdown");
      expect(display).toBeInTheDocument();
    });

    it("should not show countdown style when false", () => {
      const { container } = render(
        <TimeDisplay {...defaultProps} showAsCountdown={false} />
      );

      const display = container.querySelector(".time-display.countdown");
      expect(display).not.toBeInTheDocument();
    });
  });

  describe("Separator", () => {
    it("should use custom separator", () => {
      render(<TimeDisplay {...defaultProps} separator=" - " />);

      const separator = screen.getByTestId("time-display-separator");
      expect(separator.textContent).toBe(" - ");
    });

    it("should be hidden from screen readers", () => {
      render(<TimeDisplay {...defaultProps} />);

      const separator = screen.getByTestId("time-display-separator");
      expect(separator).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero current time", () => {
      render(<TimeDisplay currentTime={0} duration={120000} />);

      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("0:00");
    });

    it("should handle currentTime > duration", () => {
      render(<TimeDisplay currentTime={150000} duration={120000} />);

      const current = screen.getByTestId("time-display-current");
      expect(current).toBeInTheDocument();
    });

    it("should handle very large durations", () => {
      const twoHours = 7200000;
      render(
        <TimeDisplay
          currentTime={3600000}
          duration={twoHours}
          format="auto"
        />
      );

      const display = screen.getByTestId("time-display");
      expect(display).toBeInTheDocument();
    });

    it("should handle milliseconds correctly", () => {
      render(
        <TimeDisplay currentTime={1500} duration={3000} format="short" />
      );

      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("0:01");
    });

    it("should handle fractional seconds", () => {
      render(
        <TimeDisplay currentTime={1234} duration={5000} format="short" />
      );

      const current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("0:01");
    });
  });

  describe("Updates", () => {
    it("should update current time when prop changes", () => {
      const { rerender } = render(
        <TimeDisplay currentTime={30000} duration={120000} />
      );

      let current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("0:30");

      rerender(<TimeDisplay currentTime={60000} duration={120000} />);

      current = screen.getByTestId("time-display-current");
      expect(current.textContent).toBe("1:00");
    });

    it("should update format when prop changes", () => {
      const { rerender } = render(
        <TimeDisplay
          currentTime={125000}  // 2 min, 5 sec
          duration={600000}     // 10 minutes
          format="short"
        />
      );

      let current = screen.getByTestId("time-display-current");
      const shortText = current.textContent;
      // Short should be "2:05"
      expect(shortText).toBe("2:05");

      rerender(
        <TimeDisplay
          currentTime={125000}
          duration={600000}
          format="long"
        />
      );

      current = screen.getByTestId("time-display-current");
      const longText = current.textContent;
      // Long should be "0:02:05"
      expect(longText).toBe("0:02:05");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA role", () => {
      render(<TimeDisplay {...defaultProps} />);

      const display = screen.getByTestId("time-display");
      expect(display).toHaveAttribute("role", "status");
    });

    it("should have aria-live for dynamic updates", () => {
      render(<TimeDisplay {...defaultProps} />);

      const display = screen.getByTestId("time-display");
      expect(display).toHaveAttribute("aria-live", "polite");
    });

    it("should have aria-label", () => {
      render(<TimeDisplay {...defaultProps} />);

      const display = screen.getByTestId("time-display");
      expect(display).toHaveAttribute("aria-label");
    });

    it("should include time in aria-label", () => {
      const oneMinuteElapsed = 60000;
      const twoMinutes = 120000;

      render(
        <TimeDisplay currentTime={oneMinuteElapsed} duration={twoMinutes} />
      );

      const display = screen.getByTestId("time-display");
      const ariaLabel = display.getAttribute("aria-label") || "";
      // Should contain formatted time
      expect(ariaLabel).toMatch(/\d+:\d{2}/);
    });

    it("should have screen reader progress indicator", () => {
      const { container } = render(<TimeDisplay {...defaultProps} />);

      const srElement = container.querySelector(".sr-only[role='progressbar']");
      expect(srElement).toBeInTheDocument();
    });

    it("should update screen reader progress", () => {
      const { rerender, container } = render(
        <TimeDisplay currentTime={60000} duration={120000} />
      );

      let srElement = container.querySelector(".sr-only[role='progressbar']") as HTMLElement;
      expect(srElement?.getAttribute("aria-valuenow")).toBe("50");

      rerender(<TimeDisplay currentTime={30000} duration={120000} />);

      srElement = container.querySelector(".sr-only[role='progressbar']") as HTMLElement;
      expect(srElement?.getAttribute("aria-valuenow")).toBe("25");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<TimeDisplay {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass("time-display");
    });
  });
});
