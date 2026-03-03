import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncIndicators from './SyncIndicators';

describe('SyncIndicators', () => {
  const defaultState = {
    videoId: 1,
    currentFrame: 1000,
    expectedFrame: 1000,
    driftFrames: 0,
    driftMs: 0,
    fps: 60,
    status: 'synced'
  };

  const defaultProps = {
    videoId: 1,
    state: defaultState,
    offset: 0,
    onOffsetChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<SyncIndicators {...defaultProps} {...props} />);
  };

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      renderComponent();
      
      expect(document.querySelector('.sync-indicators')).toBeInTheDocument();
    });

    it('should render placeholder when no state provided', () => {
      renderComponent({ state: undefined });
      
      expect(screen.getByText(/Waiting for video/)).toBeInTheDocument();
    });

    it('should render placeholder with correct video id', () => {
      renderComponent({ state: undefined, videoId: 42 });
      
      expect(screen.getByText(/Waiting for video 42/)).toBeInTheDocument();
    });

    it('should render healthy status when synced', () => {
      renderComponent({
        state: { ...defaultState, driftMs: 0, driftFrames: 0 }
      });
      
      const indicator = document.querySelector('.sync-indicators.healthy');
      expect(indicator).toBeInTheDocument();
    });

    it('should render warning status when adjusting', () => {
      // isWarning when driftMs >= 16.67 (1 frame) AND < 33.34 (2 frames)
      renderComponent({
        state: { ...defaultState, driftMs: 20, driftFrames: 1 }
      });
      
      const indicator = document.querySelector('.sync-indicators.warning');
      expect(indicator).toBeInTheDocument();
    });

    it('should render critical status when out of sync', () => {
      // isCritical when driftMs >= 33.34 (2 frames)
      renderComponent({
        state: { ...defaultState, driftMs: 35, driftFrames: 2 }
      });
      
      const indicator = document.querySelector('.sync-indicators.critical');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Status Indicator', () => {
    it('should show "In Sync" when healthy', () => {
      // isHealthy when driftAbs < 16.67
      renderComponent({ state: { ...defaultState, driftMs: 10 } });
      
      expect(screen.getByText('In Sync')).toBeInTheDocument();
    });

    it('should show "Adjusting" when warning', () => {
      // isWarning when driftAbs >= 16.67 AND < 33.34
      renderComponent({ state: { ...defaultState, driftMs: 20 } });
      
      expect(screen.getByText('Adjusting')).toBeInTheDocument();
    });

    it('should show "Out of Sync" when critical', () => {
      // isCritical when driftAbs >= 33.34
      renderComponent({ state: { ...defaultState, driftMs: 50 } });
      
      expect(screen.getByText('Out of Sync')).toBeInTheDocument();
    });

    it('should render green LED when healthy', () => {
      renderComponent({ state: { ...defaultState, driftMs: 0 } });
      
      const led = document.querySelector('.led.green');
      expect(led).toBeInTheDocument();
    });

    it('should render yellow LED when warning', () => {
      renderComponent({ state: { ...defaultState, driftMs: 20 } });
      
      const led = document.querySelector('.led.yellow');
      expect(led).toBeInTheDocument();
    });

    it('should render red LED when critical', () => {
      renderComponent({ state: { ...defaultState, driftMs: 50 } });
      
      const led = document.querySelector('.led.red');
      expect(led).toBeInTheDocument();
    });
  });

  describe('Drift Display', () => {
    it('should display drift in milliseconds', () => {
      renderComponent({ state: { ...defaultState, driftMs: 16.67 } });
      
      expect(screen.getByText('16.7')).toBeInTheDocument();
      expect(screen.getByText('ms')).toBeInTheDocument();
    });

    it('should display absolute drift value', () => {
      renderComponent({ state: { ...defaultState, driftMs: -16.67 } });
      
      expect(screen.getByText('16.7')).toBeInTheDocument();
    });

    it('should display zero drift correctly', () => {
      renderComponent({ state: { ...defaultState, driftMs: 0 } });
      
      expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('should show drift direction indicator when ahead', () => {
      // driftFrames > 0 means ahead
      renderComponent({ state: { ...defaultState, driftFrames: 2, driftMs: 33.34 } });
      
      const direction = document.querySelector('.drift-direction');
      expect(direction?.textContent).toBe('↑');
    });

    it('should show drift direction indicator when behind', () => {
      // driftFrames < 0 means behind
      renderComponent({ state: { ...defaultState, driftFrames: -2, driftMs: -33.34 } });
      
      const direction = document.querySelector('.drift-direction');
      expect(direction?.textContent).toBe('↓');
    });

    it('should show current and expected frames', () => {
      renderComponent({
        state: { ...defaultState, currentFrame: 1500, expectedFrame: 1500 }
      });
      
      expect(screen.getByText(/Frame 1500 \/ 1500/)).toBeInTheDocument();
    });

    it('should show frame delta', () => {
      renderComponent({
        state: { ...defaultState, currentFrame: 1502, expectedFrame: 1500, driftFrames: 2 }
      });
      
      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it('should show negative frame delta', () => {
      renderComponent({
        state: { ...defaultState, currentFrame: 1498, expectedFrame: 1500, driftFrames: -2 }
      });
      
      expect(screen.getByText(/-2/)).toBeInTheDocument();
    });
  });

  describe('Offset Adjustment', () => {
    it('should render offset slider', () => {
      renderComponent();
      
      const slider = document.getElementById('offset-slider-1');
      expect(slider).toBeInTheDocument();
    });

    it('should show current offset value', () => {
      renderComponent({ offset: 5 });
      
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should show negative offset correctly', () => {
      renderComponent({ offset: -5 });
      
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should show zero offset correctly', () => {
      renderComponent({ offset: 0 });
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should call onOffsetChange when slider changes', async () => {
      const onOffsetChange = vi.fn();
      renderComponent({ onOffsetChange });
      
      const slider = document.getElementById('offset-slider-1');
      fireEvent.change(slider!, { target: { value: '10' } });
      
      expect(onOffsetChange).toHaveBeenCalledWith(10);
    });

    it('should show reset button when offset is not zero', () => {
      renderComponent({ offset: 5 });
      
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should not show reset button when offset is zero', () => {
      renderComponent({ offset: 0 });
      
      const resetButtons = screen.queryAllByText('Reset');
      expect(resetButtons).toHaveLength(0);
    });

    it('should reset offset when reset button clicked', async () => {
      const onOffsetChange = vi.fn();
      renderComponent({ offset: 5, onOffsetChange });
      
      const resetButton = screen.getByText('Reset');
      await userEvent.click(resetButton);
      
      expect(onOffsetChange).toHaveBeenCalledWith(0);
    });

    it('should have slider range from -30 to 30', () => {
      renderComponent();
      
      const slider = document.getElementById('offset-slider-1') as HTMLInputElement;
      expect(slider.min).toBe('-30');
      expect(slider.max).toBe('30');
    });

    it('should have slider step of 1', () => {
      renderComponent();
      
      const slider = document.getElementById('offset-slider-1') as HTMLInputElement;
      expect(slider.step).toBe('1');
    });
  });

  describe('Detailed Metrics (showDetails)', () => {
    it('should not show detailed metrics by default', () => {
      renderComponent({ showDetails: false });
      
      const metrics = document.querySelector('.detailed-metrics');
      expect(metrics).toBeFalsy();
    });

    it('should show detailed metrics when showDetails is true', () => {
      renderComponent({ showDetails: true });
      
      const metrics = document.querySelector('.detailed-metrics');
      expect(metrics).toBeInTheDocument();
    });

    it('should display status in detailed metrics', () => {
      renderComponent({ showDetails: true });
      
      expect(screen.getByText(/Status:/)).toBeInTheDocument();
    });

    it('should display FPS in detailed metrics', () => {
      renderComponent({ showDetails: true });
      
      expect(screen.getByText(/FPS:/)).toBeInTheDocument();
    });

    it('should display drift direction in detailed metrics', () => {
      renderComponent({ showDetails: true });
      
      expect(screen.getByText(/Drift Direction:/)).toBeInTheDocument();
    });

    it('should display tolerance in detailed metrics', () => {
      renderComponent({ showDetails: true });
      
      expect(screen.getByText(/Tolerance:/)).toBeInTheDocument();
    });
  });

  describe('Adjustment Hint', () => {
    it('should show hint when video is ahead', () => {
      renderComponent({ state: { ...defaultState, driftFrames: 2 } });
      
      const hint = document.querySelector('.adjustment-hint');
      expect(hint?.textContent).toContain('ahead');
    });

    it('should show hint when video is behind', () => {
      renderComponent({ state: { ...defaultState, driftFrames: -2 } });
      
      const hint = document.querySelector('.adjustment-hint');
      expect(hint?.textContent).toContain('behind');
    });

    it('should not show hint when drift is zero', () => {
      renderComponent({ state: { ...defaultState, driftFrames: 0 } });
      
      const hint = document.querySelector('.adjustment-hint');
      expect(hint).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper label for offset slider', () => {
      renderComponent();
      
      const label = document.querySelector('label[for="offset-slider-1"]');
      expect(label).toBeInTheDocument();
    });

    it('should have accessible status text', () => {
      renderComponent();
      
      const statusText = document.querySelector('.status-text');
      expect(statusText).toBeInTheDocument();
    });

    it('should have reset button with title', () => {
      renderComponent({ offset: 5 });
      
      const resetButton = document.querySelector('.reset-offset');
      expect(resetButton?.getAttribute('title')).toBe('Reset offset to 0');
    });

    it('should have slider with title', () => {
      renderComponent();
      
      const slider = document.getElementById('offset-slider-1');
      expect(slider?.getAttribute('title')).toContain('offset');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large drift values', () => {
      renderComponent({ state: { ...defaultState, driftMs: 10000 } });
      
      expect(screen.getByText('10000.0')).toBeInTheDocument();
    });

    it('should handle very large negative drift values', () => {
      renderComponent({ state: { ...defaultState, driftMs: -10000 } });
      
      expect(screen.getByText('10000.0')).toBeInTheDocument();
    });

    it('should handle very large offset values', () => {
      renderComponent({ offset: 1000 });
      
      expect(screen.getByText('+1000')).toBeInTheDocument();
    });

    it('should handle floating point drift values', () => {
      renderComponent({ state: { ...defaultState, driftMs: 16.666666 } });
      
      expect(screen.getByText('16.7')).toBeInTheDocument();
    });

    it('should handle different FPS values', () => {
      renderComponent({ state: { ...defaultState, fps: 30 } });
      renderComponent({ state: { ...defaultState, fps: 59.94 } });
      renderComponent({ state: { ...defaultState, fps: 144 } });
      
      // Just ensure no crashes
      expect(document.querySelector('.sync-indicators')).toBeInTheDocument();
    });

    it('should handle missing optional state properties', () => {
      renderComponent({
        state: {
          videoId: 1,
          currentFrame: 1000,
          expectedFrame: 1000
        } as any
      });
      
      expect(document.querySelector('.sync-indicators')).toBeInTheDocument();
    });

    it('should handle different video IDs', () => {
      renderComponent({ videoId: 1 });
      renderComponent({ videoId: 999 });
      renderComponent({ videoId: -5 } as any);
      
      // All should render without crashes
      const indicators = document.querySelectorAll('.sync-indicators');
      expect(indicators.length).toBe(3);
    });
  });

  describe('Local State Management', () => {
    it('should update local offset when slider changes', async () => {
      const onOffsetChange = vi.fn();
      renderComponent({ offset: 0, onOffsetChange });
      
      const slider = document.getElementById('offset-slider-1') as HTMLInputElement;
      // Simulate slider change
      fireEvent.change(slider, { target: { value: '10' } });
      
      // Check that offset display updates
      expect(screen.getByText('+10')).toBeInTheDocument();
    });

    it('should maintain local offset independently of prop', () => {
      // Note: The component uses local state for offset, so it doesn't auto-sync with prop changes
      // This is a known behavior - the local state persists until changed by user interaction
      const { rerender } = renderComponent({ offset: 5 });
      
      // Initial offset shows as +5
      expect(screen.getByText('+5')).toBeInTheDocument();
      
      // After rerender with new prop, local state still shows old value
      // This is expected behavior (component doesn't sync local state with prop)
      rerender(<SyncIndicators {...defaultProps} offset={10} />);
      
      // Local offset should still be 5 (not synced with prop 10)
      const offsetValue = document.querySelector('.offset-value');
      expect(offsetValue?.textContent).toBe('+5');
    });
  });
});
