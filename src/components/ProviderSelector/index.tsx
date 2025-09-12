import React from 'react';
import { StreamProviderType } from '../../types/streaming.types';
import { useStreamingContext } from '../../contexts/StreamingContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { logger } from '../../core/Logger';
import './styles.css';

interface ProviderOption {
  type: StreamProviderType;
  name: string;
  available: boolean;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    type: 'agora',
    name: 'Agora',
    available: true,
  },
  {
    type: 'livekit',
    name: 'LiveKit',
    available: false,
  },
  {
    type: 'trtc',
    name: 'TRTC',
    available: false,
  },
];

interface ProviderSelectorProps {
  disabled?: boolean;
  onProviderChange?: (type: StreamProviderType) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ disabled = false, onProviderChange }) => {
  const { providerType, isLoading } = useStreamingContext();
  const { showWarning, showError } = useNotifications();

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = event.target.value as StreamProviderType;

    if (selectedType === providerType || disabled || isLoading) {
      return;
    }

    const selectedProvider = PROVIDER_OPTIONS.find((p) => p.type === selectedType);

    if (!selectedProvider?.available) {
      showWarning(
        `${selectedProvider?.name} is not yet implemented. Only Agora is currently available.`,
        'Provider Not Available',
      );
      // Reset to current provider
      event.target.value = providerType;
      return;
    }

    try {
      logger.info('Provider selection initiated', { from: providerType, to: selectedType });
      onProviderChange?.(selectedType);
    } catch (error) {
      logger.error('Failed to switch provider', { error, selectedType });
      showError(
        `Failed to switch to ${selectedProvider?.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Provider Switch Failed',
      );
    }
  };

  return (
    <div className="provider-selector">
      <label>
        Provider:
        <select
          value={providerType}
          onChange={handleProviderChange}
          disabled={disabled || isLoading}
          className="provider-select"
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.type} value={option.type} disabled={!option.available}>
              {option.name}
              {!option.available ? ' (Coming Soon)' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
