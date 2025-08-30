import { useCallback } from 'react';
import { useNotificationContext } from '../contexts/NotificationContext';
import { NotificationType } from '../types/notification';

export interface NotificationOptions {
  title?: string;
  duration?: number;
}

export const useNotifications = () => {
  const { addNotification, removeNotification, clearAll, notifications } = useNotificationContext();

  const showNotification = useCallback(
    (type: NotificationType, message: string, options?: NotificationOptions) => {
      return addNotification({
        type,
        message,
        title: options?.title,
        duration: options?.duration,
      });
    },
    [addNotification],
  );

  const showSuccess = useCallback(
    (message: string, options?: NotificationOptions) => {
      return showNotification('success', message, options);
    },
    [showNotification],
  );

  const showError = useCallback(
    (message: string, options?: NotificationOptions) => {
      return showNotification('error', message, { ...options, duration: 0 }); // Errors don't auto-dismiss
    },
    [showNotification],
  );

  const showWarning = useCallback(
    (message: string, options?: NotificationOptions) => {
      return showNotification('warning', message, options);
    },
    [showNotification],
  );

  const showInfo = useCallback(
    (message: string, options?: NotificationOptions) => {
      return showNotification('info', message, options);
    },
    [showNotification],
  );

  return {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAll,
  };
};
