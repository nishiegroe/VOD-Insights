import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Create a proper mock for fetch
const mockFetch = vi.fn();
mockFetch.mockResolvedValue = function(value) {
  return mockFetch.mockReturnValueOnce(Promise.resolve(value));
};
mockFetch.mockRejectedValue = function(error) {
  return mockFetch.mockReturnValueOnce(Promise.reject(error));
};

global.fetch = mockFetch;

// Mock HTMLVideoElement.prototype properties that can't be read
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn(() => Promise.resolve()),
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLVideoElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
