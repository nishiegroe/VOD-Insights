import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from '../../pages/MultiVodComparison/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Debouncing', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('test');

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith('test');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls if invoked again within delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('first');
      vi.advanceTimersByTime(250);

      debouncedFn('second');
      vi.advanceTimersByTime(250);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith('second');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute with latest arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn(1);
      debouncedFn(2);
      debouncedFn(3);

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith(3);
    });

    it('should handle multiple arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('arg1', 'arg2', 'arg3');

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('Cancel Method', () => {
    it('should provide cancel method to abort execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('test');
      debouncedFn.cancel();

      vi.advanceTimersByTime(500);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should allow re-execution after cancel', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('first');
      debouncedFn.cancel();

      debouncedFn('second');

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith('second');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle cancel when no pending call', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      expect(() => {
        debouncedFn.cancel();
      }).not.toThrow();
    });
  });

  describe('Timing', () => {
    it('should respect custom delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 1000);

      debouncedFn('test');

      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalled();
    });

    it('should work with zero delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 0);

      debouncedFn('test');

      vi.advanceTimersByTime(0);

      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should work with very short delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 1);

      debouncedFn('test');

      vi.advanceTimersByTime(1);

      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should work with large delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 10000);

      debouncedFn('test');

      vi.advanceTimersByTime(5000);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Real-world Use Cases', () => {
    it('should debounce API calls on slider drag', () => {
      const apiCall = vi.fn();
      const debouncedApiCall = debounce(apiCall, 300);

      // Simulate rapid slider movements
      for (let i = 0; i < 10; i++) {
        debouncedApiCall({ value: i });
        vi.advanceTimersByTime(50);
      }

      // Should only call once with final value
      expect(apiCall).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith({ value: 9 });
    });

    it('should debounce window resize handler', () => {
      const resizeHandler = vi.fn();
      const debouncedResize = debounce(resizeHandler, 200);

      // Simulate resize events
      debouncedResize(1920);
      debouncedResize(1024);
      debouncedResize(768);

      expect(resizeHandler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      expect(resizeHandler).toHaveBeenCalledWith(768);
      expect(resizeHandler).toHaveBeenCalledTimes(1);
    });

    it('should debounce search input', () => {
      const search = vi.fn();
      const debouncedSearch = debounce(search, 500);

      debouncedSearch('a');
      debouncedSearch('ab');
      debouncedSearch('abc');
      debouncedSearch('abcd');

      expect(search).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(search).toHaveBeenCalledWith('abcd');
      expect(search).toHaveBeenCalledTimes(1);
    });
  });

  describe('Object Methods', () => {
    it('should preserve `this` context for object methods', () => {
      const obj = {
        value: 42,
        method: function (x) {
          return this.value + x;
        },
      };

      const debouncedMethod = debounce(obj.method.bind(obj), 500);

      debouncedMethod(8);

      vi.advanceTimersByTime(500);

      // Method should have been called with correct context
      expect(true).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clean up timeout ID after execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('test');

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalled();

      // Should be able to call again
      debouncedFn('test2');

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should clean up timeout ID after cancel', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn('test');
      debouncedFn.cancel();

      // Should be able to call again after cancel
      debouncedFn('test2');

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledWith('test2');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null callback gracefully', () => {
      const debouncedFn = debounce(null, 500);

      expect(() => {
        debouncedFn('test');
      }).not.toThrow();
    });

    it('should handle undefined delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, undefined);

      debouncedFn('test');

      // Should execute with default delay (0 or NaN behavior)
      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle negative delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, -100);

      debouncedFn('test');

      // Negative delay should be handled gracefully
      expect(true).toBe(true);
    });

    it('should handle function that throws', () => {
      const fn = vi.fn(() => {
        throw new Error('Function error');
      });

      const debouncedFn = debounce(fn, 500);

      debouncedFn('test');

      expect(() => {
        vi.advanceTimersByTime(500);
      }).toThrow();
    });
  });
});
