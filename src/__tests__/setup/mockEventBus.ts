import { vi } from 'vitest';

// Mock EventBus for testing
export const setupEventBusMocks = () => {
  // Mock the EventBus class
  vi.mock('../../core/EventBus', () => {
    const mockSubscriptions = new Map<string, Set<{ callback: Function; once: boolean }>>();

    return {
      EventBus: vi.fn().mockImplementation(() => ({
        subscribe: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (!mockSubscriptions.has(event)) {
            mockSubscriptions.set(event, new Set());
          }

          const subscription = { callback, once: false };
          mockSubscriptions.get(event)!.add(subscription);

          // Return unsubscribe function
          return () => {
            mockSubscriptions.get(event)?.delete(subscription);
          };
        }),

        once: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (!mockSubscriptions.has(event)) {
            mockSubscriptions.set(event, new Set());
          }

          const subscription = { callback, once: true };
          mockSubscriptions.get(event)!.add(subscription);

          // Return unsubscribe function
          return () => {
            mockSubscriptions.get(event)?.delete(subscription);
          };
        }),

        publish: vi.fn().mockImplementation((event: string, data: unknown) => {
          const eventListeners = mockSubscriptions.get(event);
          if (!eventListeners) return;

          const subscriptions = Array.from(eventListeners);
          const toRemove: { callback: Function; once: boolean }[] = [];

          subscriptions.forEach((subscription) => {
            try {
              subscription.callback(data);

              if (subscription.once) {
                toRemove.push(subscription);
              }
            } catch (error) {
              // Silently handle errors in test environment
            }
          });

          // Remove one-time subscriptions
          toRemove.forEach((subscription) => {
            eventListeners.delete(subscription);
          });
        }),

        clear: vi.fn().mockImplementation(() => {
          mockSubscriptions.clear();
        }),

        getEventCount: vi.fn().mockImplementation(() => mockSubscriptions.size),

        getListenerCount: vi.fn().mockImplementation((event?: string) => {
          if (event) {
            return mockSubscriptions.get(event)?.size || 0;
          }

          let total = 0;
          mockSubscriptions.forEach((listeners) => {
            total += listeners.size;
          });
          return total;
        }),

        hasListeners: vi.fn().mockImplementation((event: string) => {
          const listeners = mockSubscriptions.get(event);
          return listeners ? listeners.size > 0 : false;
        }),

        getEvents: vi.fn().mockImplementation(() => Array.from(mockSubscriptions.keys())),
      })),

      globalEventBus: {
        subscribe: vi.fn(),
        once: vi.fn(),
        publish: vi.fn(),
        clear: vi.fn(),
        getEventCount: vi.fn().mockReturnValue(0),
        getListenerCount: vi.fn().mockReturnValue(0),
        hasListeners: vi.fn().mockReturnValue(false),
        getEvents: vi.fn().mockReturnValue([]),
      },
    };
  });
};

// Helper to create a mock EventBus instance for tests
export const createMockEventBus = () => {
  const mockSubscriptions = new Map<string, Set<{ callback: Function; once: boolean }>>();

  return {
    subscribe: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (!mockSubscriptions.has(event)) {
        mockSubscriptions.set(event, new Set());
      }

      const subscription = { callback, once: false };
      mockSubscriptions.get(event)!.add(subscription);

      return () => {
        mockSubscriptions.get(event)?.delete(subscription);
      };
    }),

    once: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (!mockSubscriptions.has(event)) {
        mockSubscriptions.set(event, new Set());
      }

      const subscription = { callback, once: true };
      mockSubscriptions.get(event)!.add(subscription);

      return () => {
        mockSubscriptions.get(event)?.delete(subscription);
      };
    }),

    publish: vi.fn().mockImplementation((event: string, data: unknown) => {
      const eventListeners = mockSubscriptions.get(event);
      if (!eventListeners) return;

      const subscriptions = Array.from(eventListeners);
      const toRemove: { callback: Function; once: boolean }[] = [];

      subscriptions.forEach((subscription) => {
        try {
          subscription.callback(data);

          if (subscription.once) {
            toRemove.push(subscription);
          }
        } catch (error) {
          // Silently handle errors in test environment
        }
      });

      toRemove.forEach((subscription) => {
        eventListeners.delete(subscription);
      });
    }),

    clear: vi.fn().mockImplementation(() => {
      mockSubscriptions.clear();
    }),

    getEventCount: vi.fn().mockImplementation(() => mockSubscriptions.size),
    getListenerCount: vi.fn().mockImplementation((event?: string) => {
      if (event) {
        return mockSubscriptions.get(event)?.size || 0;
      }

      let total = 0;
      mockSubscriptions.forEach((listeners) => {
        total += listeners.size;
      });
      return total;
    }),

    hasListeners: vi.fn().mockImplementation((event: string) => {
      const listeners = mockSubscriptions.get(event);
      return listeners ? listeners.size > 0 : false;
    }),

    getEvents: vi.fn().mockImplementation(() => Array.from(mockSubscriptions.keys())),
  };
};
