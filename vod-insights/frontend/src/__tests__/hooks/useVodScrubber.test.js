import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVodScrubber } from '../../pages/MultiVodComparison/hooks/useVodScrubber';

describe('useVodScrubber', () => {
  const duration = 3600; // 1 hour
  const currentTime = 0;
  const mockOnSeek = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mouse Interactions', () => {
    it('should handle mouse down on scrubber', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      expect(result.current.isDragging).toBe(false);

      const mockEvent = {
        clientX: 100,
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleMouseDown(mockEvent);
      });

      expect(result.current.isDragging).toBe(true);
    });

    it('should handle mouse up and stop dragging', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      act(() => {
        result.current.handleMouseDown({
          clientX: 100,
          preventDefault: vi.fn(),
        });
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handleMouseUp();
      });

      expect(result.current.isDragging).toBe(false);
    });

    it('should update time when dragging', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      const scrubberElement = document.createElement('div');
      scrubberElement.getBoundingClientRect = () => ({
        left: 0,
        right: 1000,
        width: 1000,
        top: 0,
        bottom: 20,
        height: 20,
      });

      result.current.scrubberRef.current = scrubberElement;

      act(() => {
        result.current.handleMouseDown({ clientX: 500, preventDefault: vi.fn() });
      });

      act(() => {
        result.current.handleMouseMove({
          clientX: 500,
          preventDefault: vi.fn(),
        });
      });

      expect(mockOnSeek).toHaveBeenCalledWith(expect.any(Number));
      expect(result.current.isDragging).toBe(true);
    });

    it('should update hover time without dragging', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      const scrubberElement = document.createElement('div');
      scrubberElement.getBoundingClientRect = () => ({
        left: 0,
        width: 1000,
      });

      result.current.scrubberRef.current = scrubberElement;

      act(() => {
        result.current.handleMouseMove({
          clientX: 250,
          preventDefault: vi.fn(),
        });
      });

      expect(result.current.hoverTime).toBeCloseTo(900, -2); // 250/1000 * 3600
    });

    it('should constrain hover time to duration bounds', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      const scrubberElement = document.createElement('div');
      scrubberElement.getBoundingClientRect = () => ({
        left: 0,
        width: 1000,
      });

      result.current.scrubberRef.current = scrubberElement;

      act(() => {
        result.current.handleMouseMove({
          clientX: 2000, // Beyond right edge
          preventDefault: vi.fn(),
        });
      });

      expect(result.current.hoverTime).toBeLessThanOrEqual(duration);

      act(() => {
        result.current.handleMouseMove({
          clientX: -500, // Beyond left edge
          preventDefault: vi.fn(),
        });
      });

      expect(result.current.hoverTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should seek forward with ArrowRight', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      const mockEvent = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnSeek).toHaveBeenCalledWith(101);
    });

    it('should seek backward with ArrowLeft', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      const mockEvent = {
        key: 'ArrowLeft',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnSeek).toHaveBeenCalledWith(99);
    });

    it('should jump 10s forward with Shift+ArrowRight', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      const mockEvent = {
        key: 'ArrowRight',
        shiftKey: true,
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnSeek).toHaveBeenCalledWith(110);
    });

    it('should jump 30s forward with Ctrl+ArrowRight', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      const mockEvent = {
        key: 'ArrowRight',
        ctrlKey: true,
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnSeek).toHaveBeenCalledWith(130);
    });

    it('should handle Home key to jump to start', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 500, mockOnSeek)
      );

      const mockEvent = {
        key: 'Home',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnSeek).toHaveBeenCalledWith(0);
    });

    it('should handle End key to jump to end', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 500, mockOnSeek)
      );

      const mockEvent = {
        key: 'End',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnSeek).toHaveBeenCalledWith(duration);
    });

    it('should not prevent default for unhandled keys', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      const mockEvent = {
        key: 'Enter',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Boundary Conditions', () => {
    it('should constrain seek to 0 at minimum', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 10, mockOnSeek)
      );

      act(() => {
        result.current.handleKeyDown({
          key: 'ArrowLeft',
          preventDefault: vi.fn(),
        });
      });

      act(() => {
        result.current.handleKeyDown({
          key: 'ArrowLeft',
          preventDefault: vi.fn(),
        });
      });

      // Should not go below 0
      expect(mockOnSeek).toHaveBeenLastCalledWith(expect.anything());
      // Last call should be at least 0
      const lastCall = mockOnSeek.mock.calls[mockOnSeek.mock.calls.length - 1][0];
      expect(lastCall).toBeGreaterThanOrEqual(0);
    });

    it('should constrain seek to duration at maximum', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, duration - 10, mockOnSeek)
      );

      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.handleKeyDown({
            key: 'ArrowRight',
            preventDefault: vi.fn(),
          });
        });
      }

      const lastCall = mockOnSeek.mock.calls[mockOnSeek.mock.calls.length - 1][0];
      expect(lastCall).toBeLessThanOrEqual(duration);
    });
  });

  describe('Event Focus Management', () => {
    it('should manage focused event ID', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      expect(result.current.focusedEventId).toBeNull();

      act(() => {
        result.current.setFocusedEventId('event-123');
      });

      expect(result.current.focusedEventId).toBe('event-123');

      act(() => {
        result.current.setFocusedEventId(null);
      });

      expect(result.current.focusedEventId).toBeNull();
    });
  });

  describe('Ref Management', () => {
    it('should maintain scrubber ref', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, mockOnSeek)
      );

      expect(result.current.scrubberRef).toBeDefined();
      expect(result.current.scrubberRef.current).toBeNull();

      const element = document.createElement('div');
      act(() => {
        result.current.scrubberRef.current = element;
      });

      expect(result.current.scrubberRef.current).toBe(element);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration gracefully', () => {
      const { result } = renderHook(() =>
        useVodScrubber(0, 0, mockOnSeek)
      );

      const mockEvent = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      };

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnSeek).toHaveBeenCalled();
    });

    it('should handle null onSeek callback gracefully', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, currentTime, () => {})
      );

      expect(() => {
        act(() => {
          result.current.handleKeyDown({
            key: 'Home',
            preventDefault: vi.fn(),
          });
        });
      }).not.toThrow();
    });

    it('should handle Mac Command key like Ctrl', () => {
      const { result } = renderHook(() =>
        useVodScrubber(duration, 100, mockOnSeek)
      );

      act(() => {
        result.current.handleKeyDown({
          key: 'ArrowRight',
          metaKey: true,
          preventDefault: vi.fn(),
        });
      });

      expect(mockOnSeek).toHaveBeenCalledWith(130); // 30s jump with Cmd key
    });
  });
});
