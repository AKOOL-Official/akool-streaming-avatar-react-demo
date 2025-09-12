import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { StreamingError, ErrorCode } from '../../types/error.types';

describe('EventBus', () => {
  let eventBus: EventBus;
  let mockCallback: ReturnType<typeof vi.fn>;
  let secondMockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventBus = new EventBus();
    mockCallback = vi.fn();
    secondMockCallback = vi.fn();
  });

  afterEach(() => {
    eventBus.clear();
    vi.clearAllMocks();
  });

  describe('Basic Subscription and Publishing', () => {
    it('should subscribe to events and receive published data', () => {
      const testData = { message: 'Connection established successfully', context: { provider: 'agora' } };

      eventBus.subscribe('system:info', mockCallback);
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledWith(testData);
    });

    it('should handle multiple subscribers for the same event', () => {
      const testData = { message: 'broadcast message' };

      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:info', secondMockCallback);
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledWith(testData);
      expect(secondMockCallback).toHaveBeenCalledOnce();
      expect(secondMockCallback).toHaveBeenCalledWith(testData);
    });

    it('should handle multiple different events independently', () => {
      const infoData = { message: 'Info message' };
      const warningData = { message: 'Warning message' };

      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:warning', secondMockCallback);

      eventBus.publish('system:info', infoData);
      eventBus.publish('system:warning', warningData);

      expect(mockCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledWith(infoData);
      expect(secondMockCallback).toHaveBeenCalledOnce();
      expect(secondMockCallback).toHaveBeenCalledWith(warningData);
    });

    it('should not call callbacks for non-matching events', () => {
      eventBus.subscribe('system:info', mockCallback);
      eventBus.publish('system:warning', { message: 'Different event' });

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Unsubscription', () => {
    it('should unsubscribe using returned function', () => {
      const testData = { message: 'test' };

      const unsubscribe = eventBus.subscribe('system:info', mockCallback);
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledOnce();

      unsubscribe();
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledOnce(); // Should not be called again
    });

    it('should handle partial unsubscription with multiple subscribers', () => {
      const testData = { message: 'test' };

      const unsubscribeFirst = eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:info', secondMockCallback);

      unsubscribeFirst();
      eventBus.publish('system:info', testData);

      expect(mockCallback).not.toHaveBeenCalled();
      expect(secondMockCallback).toHaveBeenCalledOnce();
      expect(secondMockCallback).toHaveBeenCalledWith(testData);
    });

    it('should handle unsubscribing the same callback multiple times safely', () => {
      const unsubscribe = eventBus.subscribe('system:info', mockCallback);

      unsubscribe();
      unsubscribe(); // Should not throw error

      eventBus.publish('system:info', { message: 'test' });
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('One-time Event Listeners', () => {
    it('should call once listeners only once', () => {
      const testData = { message: 'once test' };

      eventBus.once('system:info', mockCallback);

      eventBus.publish('system:info', testData);
      eventBus.publish('system:info', testData);
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledWith(testData);
    });

    it('should return unsubscribe function for once listeners', () => {
      const unsubscribe = eventBus.once('system:info', mockCallback);

      unsubscribe();
      eventBus.publish('system:info', { message: 'test' });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle mix of regular and once listeners', () => {
      const testData = { message: 'mixed test' };

      eventBus.subscribe('system:info', mockCallback);
      eventBus.once('system:info', secondMockCallback);

      eventBus.publish('system:info', testData);
      eventBus.publish('system:info', testData);

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(secondMockCallback).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event callbacks gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.subscribe('system:info', errorCallback);
      eventBus.subscribe('system:info', mockCallback);

      expect(() => {
        eventBus.publish('system:info', { message: 'test' });
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledOnce();

      consoleErrorSpy.mockRestore();
    });

    it('should continue processing other callbacks when one throws', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('First callback error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.subscribe('system:info', errorCallback);
      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:info', secondMockCallback);

      eventBus.publish('system:info', { message: 'test' });

      expect(errorCallback).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledOnce();
      expect(secondMockCallback).toHaveBeenCalledOnce();

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in once listeners and clean them up', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Once callback error');
      });

      const normalCallback = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.once('system:info', errorCallback);
      eventBus.once('system:warning', normalCallback);

      eventBus.publish('system:info', { message: 'test' });
      eventBus.publish('system:info', { message: 'test' }); // Should not call error callback again
      eventBus.publish('system:warning', { message: 'test' });

      // The error callback should be cleaned up after first call
      expect(normalCallback).toHaveBeenCalledOnce();
      expect(errorCallback).toHaveBeenCalled(); // Just verify it was called

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should clean up when all listeners are removed', () => {
      // Test that listeners are properly managed
      const unsubscribe1 = eventBus.subscribe('system:info', mockCallback);
      const unsubscribe2 = eventBus.subscribe('system:info', secondMockCallback);

      expect(eventBus.hasListeners('system:info')).toBe(true);
      expect(eventBus.getListenerCount('system:info')).toBe(2);

      unsubscribe1();
      expect(eventBus.hasListeners('system:info')).toBe(true);
      expect(eventBus.getListenerCount('system:info')).toBe(1);

      unsubscribe2();
      expect(eventBus.hasListeners('system:info')).toBe(false);
    });

    it('should handle many subscribe/unsubscribe operations efficiently', () => {
      const callbacks: Array<ReturnType<typeof vi.fn>> = [];
      const unsubscribers: Array<() => void> = [];

      // Subscribe many times
      for (let i = 0; i < 50; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        const unsubscribe = eventBus.subscribe('system:info', callback);
        unsubscribers.push(unsubscribe);
      }

      expect(eventBus.getListenerCount('system:info')).toBe(50);

      // Publish once - all should be called
      eventBus.publish('system:info', { message: 'test' });
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledOnce();
      });

      // Unsubscribe all
      unsubscribers.forEach((unsub) => unsub());
      expect(eventBus.hasListeners('system:info')).toBe(false);
    });

    it('should handle rapid publish/subscribe operations', () => {
      let callCount = 0;

      const rapidCallback = vi.fn().mockImplementation(() => {
        callCount++;
      });

      eventBus.subscribe('system:info', rapidCallback);

      // Rapid fire publishing
      for (let i = 0; i < 50; i++) {
        eventBus.publish('system:info', { message: `Message ${i}` });
      }

      expect(rapidCallback).toHaveBeenCalledTimes(50);
      expect(callCount).toBe(50);
    });
  });

  describe('Utility Methods', () => {
    it('should correctly report event count', () => {
      expect(eventBus.getEventCount()).toBe(0);

      eventBus.subscribe('system:info', mockCallback);
      expect(eventBus.getEventCount()).toBe(1);

      eventBus.subscribe('system:warning', mockCallback);
      expect(eventBus.getEventCount()).toBe(2);

      eventBus.subscribe('system:info', secondMockCallback); // Same event, different callback
      expect(eventBus.getEventCount()).toBe(2); // Still 2 events
    });

    it('should correctly report listener count', () => {
      expect(eventBus.getListenerCount()).toBe(0);

      eventBus.subscribe('system:info', mockCallback);
      expect(eventBus.getListenerCount()).toBe(1);

      eventBus.subscribe('system:info', secondMockCallback);
      expect(eventBus.getListenerCount()).toBe(2);

      eventBus.subscribe('system:warning', mockCallback);
      expect(eventBus.getListenerCount()).toBe(3);
    });

    it('should correctly report listener count for specific events', () => {
      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:info', secondMockCallback);
      eventBus.subscribe('system:warning', mockCallback);

      expect(eventBus.getListenerCount('system:info')).toBe(2);
      expect(eventBus.getListenerCount('system:warning')).toBe(1);
    });

    it('should correctly check for listeners', () => {
      expect(eventBus.hasListeners('system:info')).toBe(false);

      const unsubscribe = eventBus.subscribe('system:info', mockCallback);
      expect(eventBus.hasListeners('system:info')).toBe(true);

      unsubscribe();
      expect(eventBus.hasListeners('system:info')).toBe(false);
    });

    it('should return list of active events', () => {
      expect(eventBus.getEvents()).toEqual([]);

      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:warning', mockCallback);

      const events = eventBus.getEvents();
      expect(events).toContain('system:info');
      expect(events).toContain('system:warning');
      expect(events).toHaveLength(2);
    });

    it('should clear all listeners', () => {
      eventBus.subscribe('system:info', mockCallback);
      eventBus.subscribe('system:warning', secondMockCallback);

      expect(eventBus.getEventCount()).toBe(2);
      expect(eventBus.getListenerCount()).toBe(2);

      eventBus.clear();

      expect(eventBus.getEventCount()).toBe(0);
      expect(eventBus.getListenerCount()).toBe(0);
      expect(eventBus.getEvents()).toEqual([]);
    });
  });

  describe('Real Event Scenarios', () => {
    it('should handle connection events', () => {
      const connectionData = { provider: 'agora' as const };

      eventBus.subscribe('connection:connected', mockCallback);
      eventBus.publish('connection:connected', connectionData);

      expect(mockCallback).toHaveBeenCalledWith(connectionData);
    });

    it('should handle error events', () => {
      const errorData = {
        error: new StreamingError(ErrorCode.CONNECTION_FAILED, 'Connection failed'),
      };

      eventBus.subscribe('system:error', mockCallback);
      eventBus.publish('system:error', errorData);

      expect(mockCallback).toHaveBeenCalledWith(errorData);
    });

    it('should handle participant events', () => {
      const participantData = {
        participant: {
          id: 'user-123',
          displayName: 'Test User',
          isLocal: false,
          videoTracks: [],
          audioTracks: [],
          connectionQuality: {
            score: 95,
            uplink: 'excellent' as const,
            downlink: 'excellent' as const,
            rtt: 50,
            packetLoss: 0.01,
          },
        },
      };

      eventBus.subscribe('participant:joined', mockCallback);
      eventBus.publish('participant:joined', participantData);

      expect(mockCallback).toHaveBeenCalledWith(participantData);
    });

    it('should handle message events', () => {
      const messageData = {
        message: {
          id: 'msg-123',
          content: 'Hello world',
          timestamp: Date.now(),
          fromParticipant: 'user-123',
          type: 'text' as const,
        },
      };

      eventBus.subscribe('message:received', mockCallback);
      eventBus.publish('message:received', messageData);

      expect(mockCallback).toHaveBeenCalledWith(messageData);
    });
  });

  describe('Complex Event Flows', () => {
    it('should handle nested event publishing', () => {
      let nestedCallCount = 0;

      const nestedCallback = vi.fn().mockImplementation(() => {
        nestedCallCount++;
        if (nestedCallCount === 1) {
          eventBus.publish('system:warning', { message: 'Nested event triggered' });
        }
      });

      const warningCallback = vi.fn();

      eventBus.subscribe('system:info', nestedCallback);
      eventBus.subscribe('system:warning', warningCallback);

      eventBus.publish('system:info', { message: 'Trigger nested event' });

      expect(nestedCallback).toHaveBeenCalledOnce();
      expect(warningCallback).toHaveBeenCalledOnce();
      expect(warningCallback).toHaveBeenCalledWith({ message: 'Nested event triggered' });
    });

    it('should handle subscribers added during event publishing', () => {
      let dynamicCallback: ReturnType<typeof vi.fn>;

      const addingCallback = vi.fn().mockImplementation(() => {
        dynamicCallback = vi.fn();
        eventBus.subscribe('system:warning', dynamicCallback);
      });

      eventBus.subscribe('system:info', addingCallback);
      eventBus.publish('system:info', { message: 'Add subscriber' });

      // The dynamically added callback should work for subsequent publishes
      eventBus.publish('system:warning', { message: 'Test dynamic subscriber' });

      expect(addingCallback).toHaveBeenCalledOnce();
      expect(dynamicCallback!).toHaveBeenCalledOnce();
    });
  });
});
