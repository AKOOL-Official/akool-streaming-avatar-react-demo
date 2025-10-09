import React from 'react';
import { StreamProviderType } from '../../types/streaming.types';
import { useConfigurationStore } from '../../stores/configurationStore';
import { useStreamingContext } from '../../hooks/useStreamingContext';
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
    available: true,
  },
  {
    type: 'trtc',
    name: 'TRTC',
    available: true,
  },
];

interface ProviderSelectorProps {
  disabled?: boolean;
  onProviderChange?: (type: StreamProviderType) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ disabled = false, onProviderChange }) => {
  const { selectedProvider, setSelectedProvider } = useConfigurationStore();
  const { isLoading } = useStreamingContext();
  const { showWarning, showError } = useNotifications();

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = event.target.value as StreamProviderType;

    if (selectedType === selectedProvider || disabled || isLoading) {
      return;
    }

    const selectedProviderOption = PROVIDER_OPTIONS.find((p) => p.type === selectedType);

    if (!selectedProviderOption?.available) {
      showWarning(`${selectedProviderOption?.name} is not yet implemented.`, 'Provider Not Available');
      // Reset to current provider
      event.target.value = selectedProvider;
      return;
    }

    try {
      logger.info('Provider selection initiated', { from: selectedProvider, to: selectedType });
      // Update the configuration store first
      setSelectedProvider(selectedType);
      // Then notify the parent component
      onProviderChange?.(selectedType);
    } catch (error) {
      logger.error('Failed to switch provider', { error, selectedType });
      showError(
        `Failed to switch to ${selectedProviderOption?.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Provider Switch Failed',
      );
    }
  };

  return (
    <div className="provider-selector">
      <select
        value={selectedProvider}
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
    </div>
  );
};
