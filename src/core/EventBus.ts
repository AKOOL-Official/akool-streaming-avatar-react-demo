import { EventBusInterface, EventCallback, StreamingEventMap, StreamingEventType } from '../types/event.types';
import { logger } from './Logger';

interface EventSubscription<T = unknown> {
  callback: EventCallback<T>;
  once: boolean;
}

export class EventBus implements EventBusInterface {
  private listeners = new Map<string, Set<EventSubscription<unknown>>>();

  subscribe<K extends StreamingEventType>(event: K, callback: EventCallback<StreamingEventMap[K]>): () => void {
    return this.addListener(event, callback, false);
  }

  once<K extends StreamingEventType>(event: K, callback: EventCallback<StreamingEventMap[K]>): () => void {
    return this.addListener(event, callback, true);
  }

  private addListener<K extends StreamingEventType>(
    event: K,
    callback: EventCallback<StreamingEventMap[K]>,
    once: boolean,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const subscription: EventSubscription<unknown> = {
      callback: callback as EventCallback<unknown>,
      once,
    };

    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      throw new Error(`Event listeners not found for event: ${event}`);
    }
    eventListeners.add(subscription);

    // Return unsubscribe function
    return () => {
      eventListeners.delete(subscription);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  publish<K extends StreamingEventType>(event: K, data: StreamingEventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      return;
    }

    // Convert to array to avoid issues with concurrent modifications
    const subscriptions = Array.from(eventListeners);
    const toRemove: EventSubscription<unknown>[] = [];

    subscriptions.forEach((subscription) => {
      try {
        subscription.callback(data);

        // Mark one-time subscriptions for removal
        if (subscription.once) {
          toRemove.push(subscription);
        }
      } catch (error) {
        // Use structured logging
        logger.error(`Error in event handler for ${event}`, { error });
      }
    });

    // Remove one-time subscriptions
    toRemove.forEach((subscription) => {
      eventListeners.delete(subscription);
    });

    // Clean up empty event listener sets
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  // Utility methods for debugging and monitoring
  getEventCount(): number {
    return this.listeners.size;
  }

  getListenerCount(event?: StreamingEventType): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }

    let total = 0;
    this.listeners.forEach((listeners) => {
      total += listeners.size;
    });
    return total;
  }

  hasListeners(event: StreamingEventType): boolean {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size > 0 : false;
  }

  getEvents(): StreamingEventType[] {
    return Array.from(this.listeners.keys()) as StreamingEventType[];
  }
}

// Global event bus instance
export const globalEventBus = new EventBus();
