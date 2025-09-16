import React from 'react';
import { RemoteVideoStrategyFactory } from '../../../providers/common/strategies';
import { StreamProviderType } from '../../../types/streaming.types';

export interface RemoteVideoProps {
  isVisible: boolean;
  className?: string;
  style?: React.CSSProperties;
  providerType?: StreamProviderType;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  isVisible,
  className = '',
  style = {},
  providerType = 'agora', // Default to agora for backward compatibility
}) => {
  const strategy = RemoteVideoStrategyFactory.getStrategy(providerType);

  return strategy.createElement({
    isVisible,
    className,
    style,
  });
};

export default RemoteVideo;
