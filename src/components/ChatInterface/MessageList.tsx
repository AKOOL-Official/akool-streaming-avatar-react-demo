import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Message, MessageSender, MessageType, SystemEventType } from '../../hooks/useMessageState';
import { Tooltip } from '../shared';

interface MessageListProps {
  messages: Message[];
  formatTime: (timestamp: number) => string;
  shouldShowTimeSeparator: (message: Message, previousMessage?: Message) => boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, formatTime, shouldShowTimeSeparator }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tooltip state
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  // Tooltip event handlers
  const handleMessageMouseEnter = useCallback((e: React.MouseEvent, message: Message) => {
    if (message.systemType === SystemEventType.SET_PARAMS) {
      // Check for parameters in different metadata locations
      const params = message.metadata?.fullParams || message.metadata?.data || message.metadata;

      if (params && typeof params === 'object' && Object.keys(params).length > 0) {
        const paramsStr = JSON.stringify(params, null, 2);
        setTooltipContent(paramsStr);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
        setShowTooltip(true);
      }
    }
  }, []);

  const handleMessageMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <div className="chat-messages">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const showTimeSeparator = shouldShowTimeSeparator(message, previousMessage);
          const isFirstMessage = index === 0;

          return (
            <div key={message.id}>
              {(isFirstMessage || showTimeSeparator) && (
                <div className="time-separator">{formatTime(message.timestamp)}</div>
              )}
              <div
                className={`chat-message ${message.sender === MessageSender.USER ? 'sent' : 'received'} ${message.messageType === MessageType.SYSTEM ? `system ${message.systemType || ''}` : ''}`}
                onMouseEnter={(e) => handleMessageMouseEnter(e, message)}
                onMouseLeave={handleMessageMouseLeave}
              >
                {message.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <Tooltip content={tooltipContent} position={tooltipPosition} visible={showTooltip} variant="code" />
    </>
  );
};

export default MessageList;
