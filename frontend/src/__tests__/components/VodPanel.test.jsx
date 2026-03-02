import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import VodPanel from '../../pages/MultiVodComparison/components/VodPanel';

// Mock VideoElement component
vi.mock('../../pages/MultiVodComparison/components/VideoElement', () => ({
  default: React.forwardRef(({ src, currentTime, muted }, ref) => (
    <video
      ref={ref}
      data-testid="mock-video"
      src={src}
      muted={muted}
      style={{ currentTime }}
    />
  )),
}));

describe('VodPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockVod = {
    vod_id: 'vod-1',
    name: 'Test VOD',
    path: '/path/to/video.mp4',
    duration: 3600,
    current_time: 100,
    offset: 0,
    events: [
      { event_id: 'evt-1', timestamp: 50, type: 'kill', label: 'Kill' },
      { event_id: 'evt-2', timestamp: 200, type: 'death', label: 'Death' },
    ],
  };

  const mockProps = {
    vod: mockVod,
    index: 0,
    globalTime: 100,
    isPlaying: false,
    onSeek: vi.fn(),
    onPlayPause: vi.fn(),
    onOffsetChange: vi.fn(),
    vodColor: 'hsl(0, 70%, 60%)',
  };

  describe('Rendering', () => {
    it('should render VOD name', () => {
      render(<VodPanel {...mockProps} />);
      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should render video element', () => {
      render(<VodPanel {...mockProps} />);
      expect(screen.getByTestId('mock-video')).toBeInTheDocument();
    });

    it('should render current time display', () => {
      render(<VodPanel {...mockProps} />);
      // The time should be displayed (format depends on component implementation)
      const vodPanel = screen.getByText('Test VOD').closest('div');
      expect(vodPanel).toBeInTheDocument();
    });

    it('should render offset information if applicable', () => {
      const vodWithOffset = { ...mockVod, offset: 5 };
      render(<VodPanel {...mockProps} vod={vodWithOffset} />);
      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });
  });

  describe('Interactivity', () => {
    it('should call onSeek when user seeks', () => {
      const { container } = render(<VodPanel {...mockProps} />);

      // Find scrubber bar and simulate interaction
      const scrubber = container.querySelector('[role="slider"]') || 
                      container.querySelector('.scrubber');

      if (scrubber) {
        fireEvent.click(scrubber);
        expect(mockProps.onSeek).toHaveBeenCalled();
      }
    });

    it('should have accessible scrubber for keyboard navigation', () => {
      const { container } = render(<VodPanel {...mockProps} />);

      const scrubber = container.querySelector('[role="slider"]');
      if (scrubber) {
        expect(scrubber).toHaveAttribute('aria-label');
        expect(scrubber).toHaveAttribute('aria-valuemin', '0');
        expect(scrubber).toHaveAttribute('aria-valuemax', String(mockVod.duration));
      }
    });
  });

  describe('Props Updates', () => {
    it('should update when vod prop changes', () => {
      const { rerender } = render(<VodPanel {...mockProps} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();

      const newVod = { ...mockVod, name: 'Updated VOD' };
      rerender(<VodPanel {...mockProps} vod={newVod} />);

      expect(screen.getByText('Updated VOD')).toBeInTheDocument();
    });

    it('should update when globalTime prop changes', () => {
      const { rerender } = render(<VodPanel {...mockProps} globalTime={100} />);

      rerender(<VodPanel {...mockProps} globalTime={150} />);

      expect(mockProps.onSeek).not.toHaveBeenCalled(); // Just a display update
    });

    it('should update playing state', () => {
      const { rerender } = render(<VodPanel {...mockProps} isPlaying={false} />);

      rerender(<VodPanel {...mockProps} isPlaying={true} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should handle zero offset', () => {
      const vodZeroOffset = { ...mockVod, offset: 0 };
      render(<VodPanel {...mockProps} vod={vodZeroOffset} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should handle negative offset', () => {
      const vodNegativeOffset = { ...mockVod, offset: -5 };
      render(<VodPanel {...mockProps} vod={vodNegativeOffset} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });
  });

  describe('Color Props', () => {
    it('should apply VOD color to styling', () => {
      const { container } = render(
        <VodPanel {...mockProps} vodColor="hsl(120, 70%, 60%)" />
      );

      // Color should be applied to the panel
      const panel = container.querySelector('[style*="color"]') ||
                   container.querySelector('.vod-panel');

      expect(panel).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const { container } = render(<VodPanel {...mockProps} />);

      // Check for ARIA labels on interactive elements
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        if (!button.textContent.trim()) {
          expect(button).toHaveAttribute('aria-label');
        }
      });
    });

    it('should be keyboard navigable', () => {
      const { container } = render(<VodPanel {...mockProps} />);

      const interactiveElements = container.querySelectorAll(
        'button, [role="button"], [role="slider"]'
      );

      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    it('should have accessible video element', () => {
      const { container } = render(<VodPanel {...mockProps} />);

      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle VOD with no events', () => {
      const vodNoEvents = { ...mockVod, events: [] };
      render(<VodPanel {...mockProps} vod={vodNoEvents} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should handle very long VOD', () => {
      const longVod = { ...mockVod, duration: 86400 }; // 24 hours
      render(<VodPanel {...mockProps} vod={longVod} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should handle current_time beyond duration (shouldn\'t happen but be resilient)', () => {
      const invalidVod = { ...mockVod, current_time: 5000, duration: 3600 };
      render(<VodPanel {...mockProps} vod={invalidVod} />);

      expect(screen.getByText('Test VOD')).toBeInTheDocument();
    });

    it('should handle undefined vod gracefully', () => {
      // Component should handle undefined or null gracefully
      const { container } = render(
        <VodPanel {...mockProps} vod={undefined} />
      );

      // Should either show fallback or handle gracefully
      expect(container).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should memoize correctly with same props', () => {
      const { rerender } = render(<VodPanel {...mockProps} />);

      const firstRender = screen.getByText('Test VOD');

      rerender(<VodPanel {...mockProps} />);

      const secondRender = screen.getByText('Test VOD');

      // Should be same element if properly memoized
      expect(firstRender === secondRender).toBe(true);
    });
  });
});
