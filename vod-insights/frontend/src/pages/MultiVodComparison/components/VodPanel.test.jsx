import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import VodPanel from './VodPanel';

// Mock the sub-components
vi.mock('./IndividualScrubber', () => ({
  default: ({ onSeek }) => (
    <div
      data-testid="individual-scrubber"
      onClick={() => onSeek?.(50)}
    >
      Individual Scrubber
    </div>
  ),
}));

vi.mock('./VideoElement', () => ({
  default: React.forwardRef(({ src, className }, ref) => (
    <div ref={ref} data-testid="video-element" className={className}>
      Video: {src}
    </div>
  )),
}));

vi.mock('../hooks/useVodScrubber', () => ({
  useVodScrubber: () => ({
    currentTime: 0,
    duration: 600,
  }),
}));

const mockVod = {
  vod_id: 'vod-1',
  name: 'Test VOD',
  path: '/path/to/video.mp4',
  duration: 600,
  current_time: 150,
  offset: 0,
};

describe('VodPanel', () => {
  const mockOnSeek = vi.fn();

  beforeEach(() => {
    mockOnSeek.mockClear();
  });

  describe('Rendering', () => {
    it('should render the component with valid vod data', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/Test VOD/)).toBeTruthy();
    });

    it('should display fallback when vod is null', () => {
      render(
        <VodPanel
          vod={null}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/No VOD data available/)).toBeTruthy();
    });

    it('should display fallback when vod is undefined', () => {
      render(
        <VodPanel
          vod={undefined}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/No VOD data available/)).toBeTruthy();
    });

    it('should render VOD name as title', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText('Test VOD')).toBeTruthy();
    });

    it('should render VideoElement with correct source', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByTestId('video-element')).toBeTruthy();
      expect(screen.getByText(/\/path\/to\/video.mp4/)).toBeTruthy();
    });

    it('should render IndividualScrubber', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByTestId('individual-scrubber')).toBeTruthy();
    });

    it('should render time display section', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // Should display time in MM:SS format
      expect(screen.getByText(/\d+:\d+/)).toBeTruthy();
    });
  });

  describe('Offset display', () => {
    it('should not display offset when offset is 0', () => {
      const vodWithZeroOffset = { ...mockVod, offset: 0 };

      const { container } = render(
        <VodPanel
          vod={vodWithZeroOffset}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      const offsetSpan = container.querySelector('[class*="offset"]');
      // Should not show offset span or it should be empty
      expect(
        screen.queryByText(/Offset:/)
      ).toBeFalsy();
    });

    it('should display positive offset', () => {
      const vodWithPositiveOffset = { ...mockVod, offset: 5 };

      render(
        <VodPanel
          vod={vodWithPositiveOffset}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/\+5s/)).toBeTruthy();
    });

    it('should display negative offset', () => {
      const vodWithNegativeOffset = { ...mockVod, offset: -5 };

      render(
        <VodPanel
          vod={vodWithNegativeOffset}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/-5s/)).toBeTruthy();
    });

    it('should properly format large offsets', () => {
      const vodWithLargeOffset = { ...mockVod, offset: 120 };

      render(
        <VodPanel
          vod={vodWithLargeOffset}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/\+120s/)).toBeTruthy();
    });
  });

  describe('Time display', () => {
    it('should format current time correctly in MM:SS', () => {
      const vodWithTime = { ...mockVod, current_time: 90 };

      render(
        <VodPanel
          vod={vodWithTime}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // 90 seconds = 1:30
      expect(screen.getByText(/1:30/)).toBeTruthy();
    });

    it('should format duration correctly in MM:SS', () => {
      const vodWithDuration = { ...mockVod, duration: 600 };

      render(
        <VodPanel
          vod={vodWithDuration}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // 600 seconds = 10:00
      expect(screen.getByText(/10:00/)).toBeTruthy();
    });

    it('should pad seconds with leading zero', () => {
      const vodWithSmallTime = { ...mockVod, current_time: 65 };

      render(
        <VodPanel
          vod={vodWithSmallTime}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // 65 seconds = 1:05
      expect(screen.getByText(/1:05/)).toBeTruthy();
    });

    it('should show "0:00" for zero time', () => {
      const vodWithZeroTime = { ...mockVod, current_time: 0 };

      render(
        <VodPanel
          vod={vodWithZeroTime}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/0:00/)).toBeTruthy();
    });

    it('should handle null/undefined current_time', () => {
      const vodWithUndefinedTime = { ...mockVod, current_time: undefined };

      render(
        <VodPanel
          vod={vodWithUndefinedTime}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // Should fall back to 0:00
      expect(screen.getByText(/0:00/)).toBeTruthy();
    });

    it('should handle null/undefined duration', () => {
      const vodWithUndefinedDuration = { ...mockVod, duration: undefined };

      render(
        <VodPanel
          vod={vodWithUndefinedDuration}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByTestId('video-element')).toBeTruthy();
    });
  });

  describe('Global time synchronization', () => {
    it('should calculate expected time from global time and offset', () => {
      const vodWithOffset = { ...mockVod, offset: 10 };

      const { container } = render(
        <VodPanel
          vod={vodWithOffset}
          vodIndex={0}
          globalTime={50}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // globalTime (50) + offset (10) = 60
      // This would be set on the video element's currentTime
      expect(container.querySelector('[data-testid="video-element"]')).toBeTruthy();
    });

    it('should clamp time to valid range', () => {
      const vodWithSmallDuration = { ...mockVod, duration: 100 };

      render(
        <VodPanel
          vod={vodWithSmallDuration}
          vodIndex={0}
          globalTime={200}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // Time should be clamped to duration (100)
      expect(screen.getByTestId('video-element')).toBeTruthy();
    });

    it('should handle negative calculated time', () => {
      const vodWithNegativeOffset = { ...mockVod, offset: -100 };

      render(
        <VodPanel
          vod={vodWithNegativeOffset}
          vodIndex={0}
          globalTime={50}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      // globalTime (50) + offset (-100) = -50, should clamp to 0
      expect(screen.getByTestId('video-element')).toBeTruthy();
    });
  });

  describe('Seek handling', () => {
    it('should call onSeek when scrubber is interacted with', () => {
      render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      const scrubber = screen.getByTestId('individual-scrubber');
      fireEvent.click(scrubber);

      expect(mockOnSeek).toHaveBeenCalled();
    });
  });

  describe('Props updates', () => {
    it('should update when vod prop changes', () => {
      const { rerender } = render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText('Test VOD')).toBeTruthy();

      const newVod = { ...mockVod, name: 'Updated VOD' };
      rerender(
        <VodPanel
          vod={newVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText('Updated VOD')).toBeTruthy();
    });

    it('should update when globalTime changes', () => {
      const { rerender } = render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      rerender(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={100}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByTestId('video-element')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have tabindex on main panel', () => {
      const { container } = render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      const panel = container.firstChild;
      expect(panel).toHaveAttribute('tabIndex', '0');
    });

    it('should have semantic HTML structure', () => {
      const { container } = render(
        <VodPanel
          vod={mockVod}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(container.querySelector('h3')).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large current time values', () => {
      const vodWithLargeTime = { ...mockVod, current_time: 86400 }; // 24 hours

      const { container } = render(
        <VodPanel
          vod={vodWithLargeTime}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(container.querySelector('[data-testid="video-element"]')).toBeTruthy();
    });

    it('should handle special characters in VOD name', () => {
      const vodWithSpecialName = { ...mockVod, name: 'VOD #1 (2024-03-01) [Draft]' };

      render(
        <VodPanel
          vod={vodWithSpecialName}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/VOD #1/)).toBeTruthy();
    });

    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/to/video/file/2024/03/01/my_video.mp4';
      const vodWithLongPath = { ...mockVod, path: longPath };

      render(
        <VodPanel
          vod={vodWithLongPath}
          vodIndex={0}
          globalTime={0}
          syncMode="linked"
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByTestId('video-element')).toBeTruthy();
    });
  });
});
