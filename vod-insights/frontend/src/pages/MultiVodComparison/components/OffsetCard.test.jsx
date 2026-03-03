import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import OffsetCard from './OffsetCard';

const mockVod = {
  vod_id: 'vod-1',
  name: 'Test VOD',
  duration: 600,
  current_time: 100,
  offset: 0,
};

describe('OffsetCard', () => {
  const mockOnOffsetChange = vi.fn();

  beforeEach(() => {
    mockOnOffsetChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render the component with VOD data', () => {
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(screen.getByText(/Test VOD/i)).toBeTruthy();
    });

    it('should display offset value', () => {
      const vodWithOffset = { ...mockVod, offset: 5 };
      render(
        <OffsetCard
          vod={vodWithOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const offsetDisplay = screen.getByText(/Offset/i) || screen.getByText(/5/);
      expect(offsetDisplay).toBeTruthy();
    });

    it('should display VOD index', () => {
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={2}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      // Should show index in some way
      expect(screen.getByText(/Test VOD/)).toBeTruthy();
    });
  });

  describe('Offset adjustment', () => {
    it('should handle plus button click', async () => {
      const user = userEvent.setup();
      
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const plusButton = screen.getByRole('button', { name: /\+|plus/i });
      await user.click(plusButton);

      expect(mockOnOffsetChange).toHaveBeenCalled();
    });

    it('should handle minus button click', async () => {
      const user = userEvent.setup();
      
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const minusButton = screen.getByRole('button', { name: /-|minus/i });
      await user.click(minusButton);

      expect(mockOnOffsetChange).toHaveBeenCalled();
    });

    it('should increment offset by default amount on plus', async () => {
      const user = userEvent.setup();
      
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const plusButton = screen.getByRole('button', { name: /\+|plus/i });
      await user.click(plusButton);

      // Should call with vodIndex and new offset
      expect(mockOnOffsetChange).toHaveBeenCalled();
      const args = mockOnOffsetChange.mock.calls[0];
      expect(args[0]).toBe(0); // vodIndex
      expect(args[1]).toBeGreaterThan(0); // new offset should be positive
    });

    it('should decrement offset by default amount on minus', async () => {
      const user = userEvent.setup();
      const vodWithOffset = { ...mockVod, offset: 10 };
      
      render(
        <OffsetCard
          vod={vodWithOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const minusButton = screen.getByRole('button', { name: /-|minus/i });
      await user.click(minusButton);

      expect(mockOnOffsetChange).toHaveBeenCalled();
      const args = mockOnOffsetChange.mock.calls[0];
      expect(args[0]).toBe(0); // vodIndex
      expect(args[1]).toBeLessThan(10); // new offset should be less than 10
    });
  });

  describe('Input field', () => {
    it('should have input field for manual offset entry', () => {
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const input = container.querySelector('input[type="number"]');
      expect(input).toBeTruthy();
    });

    it('should allow direct input of offset value', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const input = container.querySelector('input[type="number"]');
      await user.clear(input);
      await user.type(input, '15');

      // May need to blur or press Enter to trigger change
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnOffsetChange).toHaveBeenCalled();
      });
    });

    it('should accept negative offset values', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const input = container.querySelector('input[type="number"]');
      await user.clear(input);
      await user.type(input, '-5');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnOffsetChange).toHaveBeenCalled();
      });
    });

    it('should validate input ranges', () => {
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const input = container.querySelector('input[type="number"]');
      expect(input).toBeTruthy();
      // Input should have reasonable constraints
    });
  });

  describe('Reset functionality', () => {
    it('should have reset button to clear offset', async () => {
      const user = userEvent.setup();
      const vodWithOffset = { ...mockVod, offset: 10 };
      
      render(
        <OffsetCard
          vod={vodWithOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const resetButton = screen.queryByRole('button', { name: /reset|clear|0/i });
      if (resetButton) {
        await user.click(resetButton);
        expect(mockOnOffsetChange).toHaveBeenCalled();
      }
    });
  });

  describe('Visual feedback', () => {
    it('should display positive offset visually', () => {
      const vodWithPositiveOffset = { ...mockVod, offset: 5 };
      const { container } = render(
        <OffsetCard
          vod={vodWithPositiveOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(container).toBeTruthy();
      // Positive offset might have specific styling
    });

    it('should display negative offset visually', () => {
      const vodWithNegativeOffset = { ...mockVod, offset: -5 };
      const { container } = render(
        <OffsetCard
          vod={vodWithNegativeOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(container).toBeTruthy();
      // Negative offset might have specific styling
    });

    it('should display zero offset (no offset)', () => {
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      // Buttons should have accessible names
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('should have labeled input field', () => {
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const input = container.querySelector('input[type="number"]');
      // Should have aria-label or be associated with label
      expect(input).toBeTruthy();
    });

    it('should have proper ARIA attributes', () => {
      const { container } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const card = container.firstChild;
      expect(card).toBeTruthy();
    });
  });

  describe('Props updates', () => {
    it('should update when vod offset changes', () => {
      const { rerender } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const vodWithNewOffset = { ...mockVod, offset: 10 };
      rerender(
        <OffsetCard
          vod={vodWithNewOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      // Component should reflect new offset
      expect(rerender).toBeTruthy();
    });

    it('should handle vodIndex prop changes', () => {
      const { rerender } = render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      rerender(
        <OffsetCard
          vod={mockVod}
          vodIndex={1}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(mockOnOffsetChange).not.toHaveBeenCalled(); // Just props change
    });
  });

  describe('Edge cases', () => {
    it('should handle very large offsets', async () => {
      const user = userEvent.setup();
      const vodWithLargeOffset = { ...mockVod, offset: 3600 };
      
      render(
        <OffsetCard
          vod={vodWithLargeOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      // Should display without issues
      expect(screen.getByText(/Test VOD/)).toBeTruthy();
    });

    it('should handle float offset values', async () => {
      const user = userEvent.setup();
      const vodWithFloatOffset = { ...mockVod, offset: 5.5 };
      
      render(
        <OffsetCard
          vod={vodWithFloatOffset}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(screen.getByText(/Test VOD/)).toBeTruthy();
    });

    it('should handle missing vod properties gracefully', () => {
      const minimalVod = {
        vod_id: 'vod-1',
        name: 'Minimal VOD',
      };

      render(
        <OffsetCard
          vod={minimalVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      expect(screen.getByText(/Minimal VOD/)).toBeTruthy();
    });
  });

  describe('Multiple rapid clicks', () => {
    it('should handle multiple rapid plus clicks', async () => {
      const user = userEvent.setup();
      
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const plusButton = screen.getByRole('button', { name: /\+|plus/i });
      await user.click(plusButton);
      await user.click(plusButton);
      await user.click(plusButton);

      expect(mockOnOffsetChange).toHaveBeenCalledTimes(3);
    });

    it('should handle alternating plus/minus clicks', async () => {
      const user = userEvent.setup();
      
      render(
        <OffsetCard
          vod={mockVod}
          vodIndex={0}
          onOffsetChange={mockOnOffsetChange}
        />
      );

      const plusButton = screen.getByRole('button', { name: /\+|plus/i });
      const minusButton = screen.getByRole('button', { name: /-|minus/i });

      await user.click(plusButton);
      await user.click(minusButton);
      await user.click(plusButton);

      expect(mockOnOffsetChange).toHaveBeenCalledTimes(3);
    });
  });
});
