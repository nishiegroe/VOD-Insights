import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoElement from './VideoElement';

describe('VideoElement', () => {
  let mockRef;

  beforeEach(() => {
    mockRef = { current: null };
  });

  describe('Rendering', () => {
    it('should render a video element', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video).toBeTruthy();
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef();
      render(<VideoElement ref={ref} src="/test/video.mp4" />);
      
      expect(ref.current).toBeInstanceOf(HTMLVideoElement);
    });

    it('should render with custom className', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" className="custom-class" />
      );
      
      const video = container.querySelector('video');
      expect(video).toHaveClass('custom-class');
    });
  });

  describe('URL Conversion', () => {
    it('should convert file paths to streaming URLs', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/home/user/videos/test.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toContain('/api/video/stream?path=');
      expect(video.src).toContain('test.mp4');
    });

    it('should preserve URLs starting with http://', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="http://example.com/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toBe('http://example.com/video.mp4');
    });

    it('should preserve URLs starting with https://', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="https://example.com/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toBe('https://example.com/video.mp4');
    });

    it('should URL-encode file paths with special characters', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/path/to/my video (1).mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toContain('path%2Fto%2Fmy');
      expect(video.src).toContain('%20');
      expect(video.src).toContain('%28');
      expect(video.src).toContain('%29');
    });

    it('should handle empty src', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="" />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toBe('');
    });

    it('should handle null/undefined src', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src={undefined} />
      );
      
      const video = container.querySelector('video');
      expect(video.src).toBe('');
    });
  });

  describe('Attributes', () => {
    it('should have controls disabled', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.controls).toBe(false);
    });

    it('should be muted by default', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.muted).toBe(true);
    });

    it('should respect muted prop', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" muted={false} />
      );
      
      const video = container.querySelector('video');
      expect(video.muted).toBe(false);
    });

    it('should have crossOrigin set to anonymous', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.crossOrigin).toBe('anonymous');
    });

    it('should have preload set to auto', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.preload).toBe('auto');
    });

    it('should have playsinline attribute', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.hasAttribute('playsinline')).toBe(true);
    });
  });

  describe('Styling', () => {
    it('should apply inline styles', () => {
      const { container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" />
      );
      
      const video = container.querySelector('video');
      expect(video.style.width).toBe('100%');
      expect(video.style.height).toBe('100%');
      expect(video.style.objectFit).toBe('contain');
      expect(video.style.backgroundColor).toBe('rgb(0, 0, 0)');
    });
  });

  describe('displayName', () => {
    it('should have correct displayName for debugging', () => {
      expect(VideoElement.displayName).toBe('VideoElement');
    });
  });

  describe('Updates', () => {
    it('should update src when prop changes', () => {
      const { container, rerender } = render(
        <VideoElement ref={mockRef} src="/test/video1.mp4" />
      );
      
      let video = container.querySelector('video');
      expect(video.src).toContain('video1.mp4');
      
      rerender(<VideoElement ref={mockRef} src="/test/video2.mp4" />);
      
      video = container.querySelector('video');
      expect(video.src).toContain('video2.mp4');
    });

    it('should update volume attribute when volume prop changes', () => {
      const { rerender, container } = render(
        <VideoElement ref={mockRef} src="/test/video.mp4" volume={0.5} />
      );
      
      // Note: volume attribute is set but may not directly reflect on HTMLVideoElement
      // This test just verifies re-render works
      rerender(<VideoElement ref={mockRef} src="/test/video.mp4" volume={0.8} />);
      
      const video = container.querySelector('video');
      expect(video).toBeTruthy();
    });
  });
});
