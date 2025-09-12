export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // in milliseconds, 0 means persistent
  timestamp: number;
  dismissed?: boolean;
}

export interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  showInfo: (message: string, title?: string, duration?: number) => string;
  showSuccess: (message: string, title?: string, duration?: number) => string;
  showWarning: (message: string, title?: string, duration?: number) => string;
  showError: (message: string, title?: string, duration?: number) => string;
}
