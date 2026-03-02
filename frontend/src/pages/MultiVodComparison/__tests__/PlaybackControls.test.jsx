import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaybackControls from '../components/PlaybackControls';

describe('PlaybackControls Component', () => {
  const defaultProps = {
    isPlaying: false,
    onPlayPause: vi.fn(),
    onSyncModeChange: vi.fn(),
    currentSyncMode: 'global',
  };

  beforeEach(() => {
    defaultProps.onPlayPause.mockClear();
    defaultProps.onSyncModeChange.mockClear();
  });

  describe('Render', () => {
    it('should render play button when not playing', () => {
      render(<PlaybackControls {...defaultProps} isPlaying={false} />);

      expect(screen.getByText(/play/i)).toBeInTheDocument();
    });

    it('should render pause button when playing', () => {
      render(<PlaybackControls {...defaultProps} isPlaying={true} />);

      expect(screen.getByText(/pause/i)).toBeInTheDocument();
    });

    it('should render sync mode dropdown', () => {
      render(<PlaybackControls {...defaultProps} />);

      expect(screen.getByLabelText(/sync mode/i)).toBeInTheDocument();
    });

    it('should render help text', () => {
      render(<PlaybackControls {...defaultProps} currentSyncMode="global" />);

      expect(screen.getByText(/syncs all 3 vods/i)).toBeInTheDocument();
    });
  });

  describe('Play/Pause Button', () => {
    it('should call onPlayPause with "pause" when playing', async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} isPlaying={true} />);

      const button = screen.getByRole('button', { name: /pause/i });
      await user.click(button);

      expect(defaultProps.onPlayPause).toHaveBeenCalledWith('pause');
    });

    it('should call onPlayPause with "play" when paused', async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} isPlaying={false} />);

      const button = screen.getByRole('button', { name: /play/i });
      await user.click(button);

      expect(defaultProps.onPlayPause).toHaveBeenCalledWith('play');
    });

    it('should have correct aria-pressed attribute', () => {
      const { rerender } = render(<PlaybackControls {...defaultProps} isPlaying={false} />);
      let button = screen.getByRole('button', { name: /play/i });
      expect(button).toHaveAttribute('aria-pressed', 'false');

      rerender(<PlaybackControls {...defaultProps} isPlaying={true} />);
      button = screen.getByRole('button', { name: /pause/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Sync Mode Dropdown', () => {
    it('should display current sync mode', () => {
      render(<PlaybackControls {...defaultProps} currentSyncMode="global" />);

      const select = screen.getByLabelText(/sync mode/i);
      expect(select).toHaveValue('global');
    });

    it('should call onSyncModeChange when selection changes', async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} currentSyncMode="global" />);

      const select = screen.getByLabelText(/sync mode/i);
      await user.selectOptions(select, 'independent');

      expect(defaultProps.onSyncModeChange).toHaveBeenCalledWith('independent');
    });

    it('should have both sync mode options', () => {
      render(<PlaybackControls {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent(/global/i);
      expect(options[1]).toHaveTextContent(/independent/i);
    });

    it('should update help text when sync mode changes', () => {
      const { rerender } = render(
        <PlaybackControls {...defaultProps} currentSyncMode="global" />
      );

      expect(screen.getByText(/syncs all 3 vods/i)).toBeInTheDocument();

      rerender(<PlaybackControls {...defaultProps} currentSyncMode="independent" />);

      expect(screen.getByText(/each vod scrubber moves independently/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      render(<PlaybackControls {...defaultProps} />);

      const playButton = screen.getByRole('button', { name: /play/i });
      expect(playButton).toHaveAttribute('aria-label');

      const syncSelect = screen.getByLabelText(/sync mode/i);
      expect(syncSelect).toBeInTheDocument();
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} isPlaying={false} />);

      const button = screen.getByRole('button', { name: /play/i });
      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(defaultProps.onPlayPause).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks', async () => {
      const user = userEvent.setup();
      render(<PlaybackControls {...defaultProps} isPlaying={false} />);

      const button = screen.getByRole('button', { name: /play/i });

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(defaultProps.onPlayPause).toHaveBeenCalledTimes(3);
    });

    it('should handle unknown sync modes gracefully', () => {
      render(
        <PlaybackControls
          {...defaultProps}
          currentSyncMode="unknown"
        />
      );

      expect(screen.getByLabelText(/sync mode/i)).toBeInTheDocument();
    });
  });
});
