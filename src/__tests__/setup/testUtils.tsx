import React from 'react';
import { vi } from 'vitest';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { StreamingContextProvider } from '../../contexts/StreamingContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { StreamProviderType } from '../../types/streaming.types';
import { createMockStreamingProvider, createMockEventHandlers } from './mockProviders';

// Custom render options interface
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  providerType?: StreamProviderType;
  providerProps?: Record<string, unknown>;
  withNotifications?: boolean;
  withAgoraProvider?: boolean;
  withStreamingProvider?: boolean;
  initialCredentials?: Record<string, unknown>;
  mockEventHandlers?: boolean;
}

// Provider wrapper component
interface ProviderWrapperProps {
  children: React.ReactNode;
  options: CustomRenderOptions;
}

const ProviderWrapper: React.FC<ProviderWrapperProps> = ({ children, options }) => {
  const { providerType = 'agora', withNotifications = true, withStreamingProvider = true } = options;

  let wrappedChildren = children;

  // Wrap with NotificationProvider if requested
  if (withNotifications) {
    wrappedChildren = <NotificationProvider>{wrappedChildren}</NotificationProvider>;
  }

  // Wrap with StreamingContextProvider if requested
  if (withStreamingProvider) {
    wrappedChildren = (
      <StreamingContextProvider defaultProvider={providerType}>{wrappedChildren}</StreamingContextProvider>
    );
  }

  return <>{wrappedChildren}</>;
};

// Main render function with providers
export const renderWithProviders = (ui: React.ReactElement, options: CustomRenderOptions = {}): RenderResult => {
  const renderOptions: RenderOptions = {
    wrapper: ({ children }) => <ProviderWrapper options={options}>{children}</ProviderWrapper>,
    ...options,
  };

  return render(ui, renderOptions);
};

// Specialized render functions for different contexts

// Render with only streaming provider
export const renderWithStreamingProvider = (
  ui: React.ReactElement,
  providerType: StreamProviderType = 'agora',
  additionalOptions: Omit<CustomRenderOptions, 'providerType'> = {},
): RenderResult => {
  return renderWithProviders(ui, {
    providerType,
    withAgoraProvider: false,
    withNotifications: false,
    ...additionalOptions,
  });
};

// Render with only Agora provider
export const renderWithAgoraProvider = (
  ui: React.ReactElement,
  providerProps: Record<string, unknown> = {},
  additionalOptions: Omit<CustomRenderOptions, 'providerProps'> = {},
): RenderResult => {
  return renderWithProviders(ui, {
    providerProps,
    withStreamingProvider: false,
    withNotifications: false,
    ...additionalOptions,
  });
};

// Render with only notification provider
export const renderWithNotificationProvider = (
  ui: React.ReactElement,
  additionalOptions: CustomRenderOptions = {},
): RenderResult => {
  return renderWithProviders(ui, {
    withAgoraProvider: false,
    withStreamingProvider: false,
    ...additionalOptions,
  });
};

// Render with all providers (default)
export const renderWithAllProviders = (ui: React.ReactElement, options: CustomRenderOptions = {}): RenderResult => {
  return renderWithProviders(ui, {
    withNotifications: true,
    withAgoraProvider: true,
    withStreamingProvider: true,
    ...options,
  });
};

// Render with minimal setup (no providers)
export const renderWithoutProviders = (ui: React.ReactElement, options: RenderOptions = {}): RenderResult => {
  return render(ui, options);
};

// Hook testing utilities
export { renderHook } from '@testing-library/react';

// Async testing utilities
export const waitForAsyncUpdates = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

export const waitForNextTick = () => {
  return new Promise((resolve) => process.nextTick(resolve));
};

// Mock data helpers
export const createMockElement = (tag: string = 'div', attributes: Record<string, string> = {}): HTMLElement => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
};

export const createMockVideoElement = (id: string = 'test-video'): HTMLVideoElement => {
  const video = document.createElement('video');
  video.id = id;
  video.muted = true;
  video.autoplay = true;

  // Mock video properties and methods
  Object.defineProperty(video, 'currentTime', {
    writable: true,
    value: 0,
  });

  Object.defineProperty(video, 'duration', {
    writable: true,
    value: 60,
  });

  Object.defineProperty(video, 'videoWidth', {
    writable: true,
    value: 1280,
  });

  Object.defineProperty(video, 'videoHeight', {
    writable: true,
    value: 720,
  });

  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();
  video.load = vi.fn();

  return video;
};

// Event simulation helpers
export const createMockEvent = (type: string, properties: Record<string, unknown> = {}): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
};

export const createMockMouseEvent = (type: string, properties: Record<string, unknown> = {}): MouseEvent => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...properties });
  return event;
};

export const createMockKeyboardEvent = (
  type: string,
  key: string,
  properties: Record<string, unknown> = {},
): KeyboardEvent => {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...properties });
  return event;
};

// Provider testing helpers
export const createTestProviderSetup = (providerType: StreamProviderType = 'agora') => {
  const mockProvider = createMockStreamingProvider(providerType);
  const credentials = {
    appId: 'test-app-id',
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
  };
  const eventHandlers = createMockEventHandlers();

  return {
    mockProvider,
    credentials,
    eventHandlers,
  };
};

// Async operation helpers
export const expectAsync = async (asyncFn: () => Promise<unknown>) => {
  let result: unknown;
  let error: Error | undefined;

  try {
    result = await asyncFn();
  } catch (e) {
    error = e as Error;
  }

  return {
    result,
    error,
    toResolve: () => expect(error).toBeUndefined(),
    toReject: () => expect(error).toBeDefined(),
    toResolveWith: (expectedValue: unknown) => {
      expect(error).toBeUndefined();
      expect(result).toEqual(expectedValue);
    },
    toRejectWith: (expectedError: string | Error) => {
      expect(error).toBeDefined();
      if (typeof expectedError === 'string') {
        expect(error?.message).toContain(expectedError);
      } else {
        expect(error).toEqual(expectedError);
      }
    },
  };
};

// Cleanup helpers
export const cleanupMocks = () => {
  // Clear all timers
  vi.clearAllTimers();

  // Clear localStorage
  localStorage.clear();

  // Clear sessionStorage
  sessionStorage.clear();

  // Clean up DOM
  document.body.innerHTML = '';

  // Reset URL
  window.history.replaceState({}, document.title, '/');
};

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => RenderResult) => {
  const startTime = performance.now();
  const result = renderFn();
  const endTime = performance.now();

  return {
    result,
    renderTime: endTime - startTime,
  };
};

// Accessibility testing helpers
export const expectAccessibleElement = (element: HTMLElement) => {
  return {
    toHaveAriaLabel: (label: string) => expect(element.getAttribute('aria-label')).toBe(label),
    toHaveAriaLabelledBy: (id: string) => expect(element.getAttribute('aria-labelledby')).toBe(id),
    toHaveAriaDescribedBy: (id: string) => expect(element.getAttribute('aria-describedby')).toBe(id),
    toHaveRole: (role: string) => expect(element.getAttribute('role')).toBe(role),
    toBeAccessible: () => {
      // Check for basic accessibility attributes
      const hasAccessibleName =
        element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby') || element.textContent?.trim();
      expect(hasAccessibleName).toBeTruthy();
    },
  };
};

// Re-export everything from testing library for convenience
export * from '@testing-library/react';
export { renderWithProviders as render };
