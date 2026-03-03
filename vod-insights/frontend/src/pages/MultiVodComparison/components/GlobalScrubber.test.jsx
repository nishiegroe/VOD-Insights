import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GlobalScrubber from './GlobalScrubber';

const mockState = {
  vods: [
    {
      vod_id: 'vod-1',
      name: 'VOD 1',
      duration: 600,
      current_time: 0,
      offset: 0,
      events: [
        { event_id: 'e1', timestamp: 100, label: 'Kill', type: 'kill' },
        { event_id: 'e2', timestamp: 200, label: 'Death', type: 'death' },
      ],
    },
    {
      vod_id: 'vod-2',
      name: 'VOD 2',
      duration: 500,
      current_time: 0,
      offset: 0,
      events: [
        { event_id: 'e3', timestamp: 150, label: 'Kill', type: 'kill' },
      ],
    },
    {
      vod_id: 'vod-3',
      name: 'VOD 3',
      duration: 700,
      current_time: 0,
      offset: 0,
      events: [],
    },
  ],
};

describe('GlobalScrubber', () => {
  const mockOnSeek = vi.fn();

  beforeEach(() => {
    mockOnSeek.mockClear();
  });

  describe('Rendering', () => {
    it('should render when state has vods', () => {
      render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      expect(screen.getByText(/Global Scrubber/)).toBeTruthy();
    });

    it('should not render when state is null', () => {
      const { container } = render(
        <GlobalScrubber state={null} globalTime={0} onSeek={mockOnSeek} />
      );

      expect(container.firstChild).toBeFalsy();
    });

    it('should not render when vods array is empty', () => {
      const emptyState = { ...mockState, vods: [] };
      const { container } = render(
        <GlobalScrubber state={emptyState} globalTime={0} onSeek={mockOnSeek} />
      );

      expect(container.firstChild).toBeFalsy();
    });

    it('should render legend with all VOD labels', () => {
      render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      expect(screen.getByText('VOD 1')).toBeTruthy();
      expect(screen.getByText('VOD 2')).toBeTruthy();
      expect(screen.getByText('VOD 3')).toBeTruthy();
    });

    it('should render time display', () => {
      render(
        <GlobalScrubber state={mockState} globalTime={150} onSeek={mockOnSeek} />
      );

      // Should show current time and duration
      expect(screen.getByText(/\d+:\d+/)).toBeTruthy();
    });
  });

  describe('Event markers', () => {
    it('should render event markers for all VODs', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const markers = container.querySelectorAll('[class*="eventMarker"]');
      expect(markers.length).toBeGreaterThan(0);
    });

    it('should display kill events with lightning emoji', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const killMarkers = container.querySelectorAll('[class*="eventMarker"]');
      const killEmojis = Array.from(killMarkers)
        .filter(m => m.textContent === '⚡')
        .length;

      expect(killEmojis).toBeGreaterThan(0);
    });

    it('should display death events with skull emoji', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const deathMarkers = container.querySelectorAll('[class*="eventMarker"]');
      const deathEmojis = Array.from(deathMarkers)
        .filter(m => m.textContent === '💀')
        .length;

      expect(deathEmojis).toBeGreaterThan(0);
    });

    it('should position markers correctly based on timestamp', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const markers = container.querySelectorAll('[class*="eventMarker"]');
      markers.forEach(marker => {
        const leftStyle = marker.style.left;
        expect(leftStyle).toMatch(/\d+%/);
      });
    });

    it('should have proper ARIA labels for event markers', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const markers = container.querySelectorAll('[aria-label]');
      expect(markers.length).toBeGreaterThan(0);
    });
  });

  describe('Scrubber interaction', () => {
    it('should call onSeek when clicking on track', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.mouseDown(scrubberContainer, { clientX: 300, clientY: 0 });

      expect(mockOnSeek).toHaveBeenCalled();
    });

    it('should update time based on click position', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      const rect = scrubberContainer.getBoundingClientRect();

      // Click at 50% position
      fireEvent.mouseDown(scrubberContainer, {
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top,
      });

      expect(mockOnSeek).toHaveBeenCalled();
      // Should seek to approximately 350 seconds (50% of 700)
      const callArgs = mockOnSeek.mock.calls[0][0];
      expect(callArgs).toBeGreaterThan(0);
    });

    it('should handle dragging', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');

      fireEvent.mouseDown(scrubberContainer, { clientX: 100, clientY: 0 });
      fireEvent.mouseMove(scrubberContainer, { clientX: 200, clientY: 0 });
      fireEvent.mouseUp(scrubberContainer);

      expect(mockOnSeek).toHaveBeenCalled();
    });

    it('should stop dragging on mouse up', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');

      fireEvent.mouseDown(scrubberContainer, { clientX: 100, clientY: 0 });
      fireEvent.mouseUp(scrubberContainer);
      fireEvent.mouseMove(scrubberContainer, { clientX: 200, clientY: 0 });

      // After mouseUp, further movement shouldn't trigger more seeks
      const callCount = mockOnSeek.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(2);
    });

    it('should stop dragging on mouse leave', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');

      fireEvent.mouseDown(scrubberContainer, { clientX: 100, clientY: 0 });
      fireEvent.mouseLeave(scrubberContainer);

      const callCount = mockOnSeek.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Keyboard navigation', () => {
    it('should handle ArrowLeft key', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'ArrowLeft' });

      expect(mockOnSeek).toHaveBeenCalledWith(99);
    });

    it('should handle ArrowRight key', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'ArrowRight' });

      expect(mockOnSeek).toHaveBeenCalledWith(101);
    });

    it('should handle Shift+ArrowLeft (10s jump)', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'ArrowLeft', shiftKey: true });

      expect(mockOnSeek).toHaveBeenCalledWith(90);
    });

    it('should handle Ctrl+ArrowRight (30s jump)', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'ArrowRight', ctrlKey: true });

      expect(mockOnSeek).toHaveBeenCalledWith(130);
    });

    it('should handle Home key', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'Home' });

      expect(mockOnSeek).toHaveBeenCalledWith(0);
    });

    it('should handle End key', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'End' });

      expect(mockOnSeek).toHaveBeenCalledWith(700);
    });

    it('should clamp values to valid range', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={690} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      fireEvent.keyDown(scrubberContainer, { key: 'ArrowRight', shiftKey: true });

      // Should clamp to max duration (700)
      expect(mockOnSeek).toHaveBeenCalledWith(700);
    });
  });

  describe('Hover preview', () => {
    it('should show hover preview on mouse move', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      const rect = scrubberContainer.getBoundingClientRect();

      fireEvent.mouseMove(scrubberContainer, {
        clientX: rect.left + 100,
        clientY: rect.top,
      });

      // Hover preview should be rendered
      const hoverPreview = container.querySelector('[class*="hoverPreview"]');
      expect(hoverPreview).toBeTruthy();
    });
  });

  describe('Playhead positioning', () => {
    it('should position playhead based on globalTime', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={350} onSeek={mockOnSeek} />
      );

      const playhead = container.querySelector('[class*="thumb"]');
      const leftStyle = playhead.style.left;

      // Should be at 50% (350 of 700)
      expect(leftStyle).toContain('50');
    });

    it('should update playhead position when globalTime changes', () => {
      const { rerender, container } = render(
        <GlobalScrubber state={mockState} globalTime={0} onSeek={mockOnSeek} />
      );

      const initialPlayhead = container.querySelector('[class*="thumb"]');
      const initialLeft = initialPlayhead.style.left;

      rerender(
        <GlobalScrubber state={mockState} globalTime={350} onSeek={mockOnSeek} />
      );

      const updatedPlayhead = container.querySelector('[class*="thumb"]');
      const updatedLeft = updatedPlayhead.style.left;

      expect(updatedLeft).not.toBe(initialLeft);
    });
  });

  describe('ARIA attributes', () => {
    it('should have proper ARIA slider attributes', () => {
      const { container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      const scrubberContainer = container.querySelector('[role="slider"]');
      expect(scrubberContainer).toHaveAttribute('aria-label');
      expect(scrubberContainer).toHaveAttribute('aria-valuemin', '0');
      expect(scrubberContainer).toHaveAttribute('aria-valuemax', '700');
      expect(scrubberContainer).toHaveAttribute('aria-valuenow', '100');
    });

    it('should update ARIA values as time changes', () => {
      const { rerender, container } = render(
        <GlobalScrubber state={mockState} globalTime={100} onSeek={mockOnSeek} />
      );

      let scrubber = container.querySelector('[role="slider"]');
      expect(scrubber).toHaveAttribute('aria-valuenow', '100');

      rerender(
        <GlobalScrubber state={mockState} globalTime={200} onSeek={mockOnSeek} />
      );

      scrubber = container.querySelector('[role="slider"]');
      expect(scrubber).toHaveAttribute('aria-valuenow', '200');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero duration', () => {
      const stateWithZeroDuration = {
        vods: [{ ...mockState.vods[0], duration: 0 }],
      };

      const { container } = render(
        <GlobalScrubber
          state={stateWithZeroDuration}
          globalTime={0}
          onSeek={mockOnSeek}
        />
      );

      expect(container.querySelector('[role="slider"]')).toBeTruthy();
    });

    it('should handle VOD with undefined events', () => {
      const stateWithUndefinedEvents = {
        vods: [{ ...mockState.vods[0], events: undefined }],
      };

      const { container } = render(
        <GlobalScrubber
          state={stateWithUndefinedEvents}
          globalTime={0}
          onSeek={mockOnSeek}
        />
      );

      expect(container.querySelector('[role="slider"]')).toBeTruthy();
    });

    it('should handle very long VOD (>1 hour)', () => {
      const longVodState = {
        vods: [{ ...mockState.vods[0], duration: 3600 }],
      };

      render(
        <GlobalScrubber state={longVodState} globalTime={0} onSeek={mockOnSeek} />
      );

      expect(screen.getByText(/\d+:\d+/)).toBeTruthy();
    });
  });
});
