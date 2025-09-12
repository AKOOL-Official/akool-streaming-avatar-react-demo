import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Notification, NotificationContextValue, NotificationType } from '../types/notification.types';
import { logger } from '../core/Logger';

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
  defaultDuration?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children, defaultDuration = 5000 }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>): string => {
      const id = generateId();
      const newNotification: Notification = {
        ...notification,
        id,
        timestamp: Date.now(),
        duration: notification.duration ?? defaultDuration,
      };

      setNotifications((prev) => [...prev, newNotification]);

      // Log notification for debugging
      logger.info('Notification added', {
        type: newNotification.type,
        message: newNotification.message,
        title: newNotification.title,
      });

      // Auto-remove notification after duration (if not persistent)
      if (newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, newNotification.duration);
      }

      return id;
    },
    [generateId, defaultDuration, removeNotification],
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showInfo = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addNotification({ type: NotificationType.INFO, message, title, duration });
    },
    [addNotification],
  );

  const showSuccess = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addNotification({ type: NotificationType.SUCCESS, message, title, duration });
    },
    [addNotification],
  );

  const showWarning = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addNotification({ type: NotificationType.WARNING, message, title, duration });
    },
    [addNotification],
  );

  const showError = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addNotification({ type: NotificationType.ERROR, message, title, duration });
    },
    [addNotification],
  );

  // Cleanup old notifications periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) =>
        prev.filter((notification) => {
          if (notification.duration === 0) return true; // persistent notifications
          if (!notification.duration) return true; // handle undefined duration
          return now - notification.timestamp < notification.duration + 1000; // keep a bit longer for animation
        }),
      );
    }, 10000); // cleanup every 10 seconds

    return () => clearInterval(cleanup);
  }, []);

  const value: NotificationContextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showInfo,
    showSuccess,
    showWarning,
    showError,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
