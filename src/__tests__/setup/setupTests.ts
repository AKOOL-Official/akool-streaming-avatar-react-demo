import { vi, beforeAll, afterEach } from 'vitest';
import { setupEventBusMocks } from './mockEventBus';

// Setup global mocks before all tests
beforeAll(() => {
  setupEventBusMocks();
});

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebRTC APIs
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          kind: 'audio',
          stop: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      ],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'Default - Microphone',
        groupId: 'default',
      },
      {
        deviceId: 'default',
        kind: 'videoinput',
        label: 'Default - Camera',
        groupId: 'default',
      },
    ]),
    getDisplayMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          kind: 'video',
          stop: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      ],
    }),
  },
});

// Mock window.speechSynthesis for voice features
Object.defineProperty(global.window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn().mockReturnValue([
      {
        name: 'Test Voice',
        lang: 'en-US',
        localService: true,
        default: true,
      },
    ]),
    speaking: false,
    pending: false,
    paused: false,
  },
});

// Mock URL.createObjectURL for media handling
Object.defineProperty(global.URL, 'createObjectURL', {
  writable: true,
  value: vi.fn().mockReturnValue('blob:mock-url'),
});

Object.defineProperty(global.URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
});

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
    getRandomValues: vi.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(''),
  blob: vi.fn().mockResolvedValue(new Blob()),
});

// Mock console methods to avoid noise in tests (while preserving error logging)
const originalError = console.error;
// Suppress console warnings in tests

console.log = vi.fn();
console.info = vi.fn();
console.debug = vi.fn();
console.warn = vi.fn();
console.error = vi.fn().mockImplementation((...args) => {
  // Only show actual errors, not React warnings
  if (args[0] && !args[0].toString().includes('Warning:')) {
    originalError(...args);
  }
});

// Restore original console methods after tests if needed
afterEach(() => {
  // Reset console mocks but keep them mocked
  vi.mocked(console.log).mockClear();
  vi.mocked(console.info).mockClear();
  vi.mocked(console.debug).mockClear();
  vi.mocked(console.warn).mockClear();
  vi.mocked(console.error).mockClear();
});
