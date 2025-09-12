import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationType } from '../../types/notification.types';
import './styles.css';

export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.SUCCESS:
        return '✓';
      case NotificationType.ERROR:
        return '✕';
      case NotificationType.WARNING:
        return '⚠';
      case NotificationType.INFO:
      default:
        return 'i';
    }
  };

  const handleClose = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    removeNotification(id);
  };

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <div className="notification__icon">{getNotificationIcon(notification.type)}</div>
          <div className="notification__content">
            {notification.title && <div className="notification__title">{notification.title}</div>}
            <div className="notification__message">{notification.message}</div>
          </div>
          <button
            className="notification__close"
            onClick={(e) => handleClose(notification.id, e)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
