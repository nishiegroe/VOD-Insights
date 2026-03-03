import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic functionality', () => {
    it('should call function after delay', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should only call function once despite multiple calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('call1');
      debouncedFn('call2');
      debouncedFn('call3');

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    it('should reset timer on each call', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('call1');
      vi.advanceTimersByTime(200);
      expect(mockFn).not.toHaveBeenCalled();

      debouncedFn('call2');
      vi.advanceTimersByTime(200);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call2');
    });

    it('should respect custom delay values', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn('test');
      vi.advanceTimersByTime(400);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe('Arguments and context', () => {
    it('should pass all arguments to the debounced function', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('arg1', 'arg2', 'arg3');
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should use last set of arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn(1, 2);
      debouncedFn(3, 4);
      debouncedFn(5, 6);

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledWith(5, 6);
    });

    it('should handle no arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn();
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith();
    });

    it('should handle complex objects as arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      const obj = { key: 'value', nested: { data: 123 } };
      debouncedFn(obj);

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledWith(obj);
    });

    it('should handle arrays as arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      const arr = [1, 2, 3, 4];
      debouncedFn(arr);

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledWith(arr);
    });
  });

  describe('Return value', () => {
    it('should return undefined immediately', () => {
      const mockFn = vi.fn(() => 'result');
      const debouncedFn = debounce(mockFn, 300);

      const result = debouncedFn('test');
      expect(result).toBeUndefined();
    });

    it('should not wait for debounced function result', () => {
      const mockFn = vi.fn(() => 'async result');
      const debouncedFn = debounce(mockFn, 300);

      const result = debouncedFn();
      expect(result).not.toBe('async result');
    });
  });

  describe('Cancellation (if supported)', () => {
    it('should support cancellation via cancel method', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('test');

      if (typeof debouncedFn.cancel === 'function') {
        debouncedFn.cancel();
        vi.advanceTimersByTime(300);
        expect(mockFn).not.toHaveBeenCalled();
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle zero delay', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 0);

      debouncedFn('test');
      vi.runAllTimers();

      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should handle very large delays', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 999999);

      debouncedFn('test');
      vi.advanceTimersByTime(999998);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle null arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn(null, null);
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith(null, null);
    });

    it('should handle undefined arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn(undefined);
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith(undefined);
    });

    it('should handle function as argument', () => {
      const mockFn = vi.fn();
      const callback = () => 'test';
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn(callback);
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith(callback);
    });
  });

  describe('Multiple debounced functions', () => {
    it('should work independently', () => {
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();

      const debounced1 = debounce(mockFn1, 300);
      const debounced2 = debounce(mockFn2, 300);

      debounced1('fn1-call');
      debounced2('fn2-call');

      vi.advanceTimersByTime(300);

      expect(mockFn1).toHaveBeenCalledWith('fn1-call');
      expect(mockFn2).toHaveBeenCalledWith('fn2-call');
    });

    it('should not interfere with each other', () => {
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();

      const debounced1 = debounce(mockFn1, 100);
      const debounced2 = debounce(mockFn2, 300);

      debounced1('fn1');
      debounced2('fn2');

      vi.advanceTimersByTime(100);
      expect(mockFn1).toHaveBeenCalled();
      expect(mockFn2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(mockFn2).toHaveBeenCalled();
    });
  });

  describe('Performance considerations', () => {
    it('should not call function for rapid successive calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      // Simulate rapid calls
      for (let i = 0; i < 100; i++) {
        debouncedFn(`call-${i}`);
        vi.advanceTimersByTime(10);
      }

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle many different argument combinations', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn({ a: 1, b: 2 });
      debouncedFn([1, 2, 3]);
      debouncedFn('string', 42, true);

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('string', 42, true);
    });
  });

  describe('Integration with VOD comparison', () => {
    it('should be useful for seek debouncing', () => {
      const mockSeek = vi.fn();
      const debouncedSeek = debounce(mockSeek, 100);

      // Simulate user scrubbing scrubber
      for (let i = 0; i < 10; i++) {
        debouncedSeek(i * 10);
        vi.advanceTimersByTime(50);
      }

      // Should only call once after scrubbing stops
      vi.advanceTimersByTime(100);
      expect(mockSeek).toHaveBeenCalledTimes(1);
      expect(mockSeek).toHaveBeenCalledWith(90);
    });

    it('should be useful for offset updates', () => {
      const mockUpdateOffset = vi.fn();
      const debouncedUpdateOffset = debounce(mockUpdateOffset, 200);

      // User adjusts offset multiple times
      debouncedUpdateOffset(1, 5); // vodIndex, offset
      debouncedUpdateOffset(1, 10);
      debouncedUpdateOffset(1, 15);

      vi.advanceTimersByTime(200);
      expect(mockUpdateOffset).toHaveBeenCalledTimes(1);
      expect(mockUpdateOffset).toHaveBeenCalledWith(1, 15);
    });
  });
});
