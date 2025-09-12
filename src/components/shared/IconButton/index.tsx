import React from 'react';
import './styles.css';

export interface IconButtonProps {
  icon: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  title?: string;
  variant?: 'default' | 'noise-reduction' | 'audio-dump' | 'error';
  active?: boolean;
  loading?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  disabled = false,
  className = '',
  title,
  variant = 'default',
  active = false,
  loading = false,
}) => {
  const handleClick = async () => {
    if (disabled || loading) return;

    try {
      await onClick();
    } catch (error) {
      console.error('IconButton onClick error:', error);
    }
  };

  const buttonClasses = [
    'icon-button',
    variant !== 'default' && variant,
    active && 'active',
    loading && 'loading',
    disabled && 'disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button onClick={handleClick} disabled={disabled || loading} className={buttonClasses} title={title}>
      <span className="material-icons">{loading ? 'hourglass_empty' : icon}</span>
    </button>
  );
};

export default IconButton;
