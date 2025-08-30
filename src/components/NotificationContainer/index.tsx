import React from 'react';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { Notification } from '../../types/notification';
import './styles.css';

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRemove }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`notification notification--${notification.type}`}>
      <div className="notification__icon">{getIcon()}</div>
      <div className="notification__content">
        {notification.title && <div className="notification__title">{notification.title}</div>}
        <div className="notification__message">{notification.message}</div>
      </div>
      <button className="notification__close" onClick={() => onRemove(notification.id)} aria-label="Close notification">
        ×
      </button>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotificationContext();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRemove={removeNotification} />
      ))}
    </div>
  );
};
