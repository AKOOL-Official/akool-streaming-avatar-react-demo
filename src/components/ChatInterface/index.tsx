import React, { useCallback, useEffect, useRef, useState } from 'react';
// Removed Agora-specific imports - now using provider-agnostic streaming context
import {
  useMessageState,
  SystemEventType,
  UserTriggeredEventType,
  MessageSender,
  MessageType,
  Message,
} from '../../hooks/useMessageState';
import { useStreamingContext } from '../../hooks/useStreamingContext';
import './styles.css';

interface ChatInterfaceProps {
  connected: boolean;
  micEnabled: boolean;
  setMicEnabled: (enabled: boolean) => void;
  toggleMic?: () => Promise<void>;
  cameraEnabled: boolean;
  toggleCamera: () => Promise<void>;
  cameraError?: string | null;
  noiseReductionEnabled: boolean;
  toggleNoiseReduction: () => Promise<void>;
  isDumping: boolean;
  dumpAudio: () => Promise<void>;
  onSystemEvent?: (type: UserTriggeredEventType, message: string) => void;
  onSystemMessageCallback?: (
    callback: (messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void,
  ) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  connected,
  micEnabled,
  setMicEnabled,
  toggleMic,
  cameraEnabled,
  toggleCamera,
  cameraError,
  noiseReductionEnabled,
  toggleNoiseReduction,
  isDumping,
  dumpAudio,
  onSystemMessageCallback,
}) => {
  // Check if debug features should be shown (default: false)
  const showDebugFeatures = import.meta.env.VITE_DEBUG_FEATURES === 'true';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendInterrupt } = useStreamingContext();

  // Add state for resizable height
  const [chatHeight, setChatHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  // Tooltip state
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  // Tooltip component
  const Tooltip = ({
    content,
    position,
    visible,
  }: {
    content: string;
    position: { x: number; y: number };
    visible: boolean;
  }) => {
    if (!visible || !content) return null;

    return (
      <div
        className="tooltip"
        style={{
          position: 'fixed',
          left: position.x + 10,
          top: position.y - 10,
          zIndex: 9999,
        }}
      >
        <div className="tooltip-content">
          <pre>{content}</pre>
        </div>
      </div>
    );
  };

  const {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    addSystemMessage,
    addChatMessage,
    clearMessages,
    formatTime,
    shouldShowTimeSeparator,
  } = useMessageState({
    connected,
  });

  // Listen for received messages from the provider
  const { onSystemMessage, onChatMessage, onCommand } = useStreamingContext();

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log('Resize handle clicked!', e.clientY);
      e.preventDefault();
      setIsResizing(true);
      setStartY(e.clientY);
      setStartHeight(chatHeight);
    },
    [chatHeight],
  );

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = startY - e.clientY;
      const maxHeight = window.innerHeight - 40; // Leave some margin from top
      const newHeight = Math.max(200, Math.min(maxHeight, startHeight + deltaY));
      console.log('Resizing:', { deltaY, newHeight, maxHeight, startY: e.clientY });
      setChatHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startY, startHeight]);

  // Handle window resize to adjust max height
  useEffect(() => {
    const handleWindowResize = () => {
      const maxHeight = window.innerHeight - 40;
      if (chatHeight > maxHeight) {
        setChatHeight(maxHeight);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [chatHeight]);

  // Tooltip event handlers
  const handleMessageMouseEnter = useCallback((e: React.MouseEvent, message: Message) => {
    if (message.systemType === SystemEventType.SET_PARAMS && message.metadata?.fullParams) {
      console.log('Showing tooltip for set-params message:', message.metadata.fullParams);
      const paramsStr = JSON.stringify(message.metadata.fullParams, null, 2);
      setTooltipContent(paramsStr);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
      setShowTooltip(true);
    }
  }, []);

  const handleMessageMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Stream message handling is now done by the provider's messaging controller
  // This removes the direct Agora client dependency

  // Stream message listening is now handled by the provider's event system
  // No direct client listener setup needed

  // Avatar speaking state is now managed by the provider

  // Set up system message callback
  useEffect(() => {
    if (onSystemMessageCallback) {
      onSystemMessageCallback((messageId, text, systemType, metadata) => {
        addSystemMessage(messageId, text, systemType as SystemEventType, metadata);
      });
    }
  }, [onSystemMessageCallback, addSystemMessage]);

  // Note: onMessageReceived is handled by onChatMessage below to avoid duplicates

  // Listen for system messages from the provider
  useEffect(() => {
    const unsubscribe = onSystemMessage((event) => {
      // Convert SystemMessageEvent to Message format and add to state
      addSystemMessage(event.messageId, event.text, event.eventType as SystemEventType, event.metadata);
    });

    return unsubscribe;
  }, [onSystemMessage, addSystemMessage]);

  // Listen for chat messages from the provider (alternative to onMessageReceived)
  useEffect(() => {
    const unsubscribe = onChatMessage((event) => {
      // Convert ChatMessageEvent to Message format and add to state
      addChatMessage(event.messageId, event.text, event.from === 'avatar' ? MessageSender.AVATAR : MessageSender.USER);
    });

    return unsubscribe;
  }, [onChatMessage, addChatMessage]);

  // Listen for command events from the provider
  useEffect(() => {
    const unsubscribe = onCommand((event) => {
      // Convert CommandEvent to system message format
      const commandText =
        event.success !== undefined
          ? `${event.success ? '✅' : '❌'} ${event.command}${event.message ? `: ${event.message}` : ''}`
          : `📤 ${event.command}${event.data ? ` with data: ${JSON.stringify(event.data)}` : ''}`;

      addSystemMessage(
        `cmd_${Date.now()}`,
        commandText,
        event.command === 'interrupt' ? SystemEventType.INTERRUPT : SystemEventType.SET_PARAMS,
        event.data,
      );
    });

    return unsubscribe;
  }, [onCommand, addSystemMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add effect to clear messages when connection is lost
  useEffect(() => {
    if (!connected) {
      clearMessages();
    }
  }, [connected, clearMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleMicInternal = async () => {
    if (toggleMic) {
      // Add system message for user audio state change (before toggle)
      if (micEnabled) {
        addSystemMessage(`mic_${Date.now()}`, '🔇 User microphone disabled', SystemEventType.MIC_END);
      } else {
        addSystemMessage(`mic_${Date.now()}`, '🎤 User microphone enabled', SystemEventType.MIC_START);
      }
      await toggleMic();
      return;
    }

    // Fallback implementation if toggleMic is not provided
    if (!micEnabled) {
      setMicEnabled(true);
      addSystemMessage(`mic_${Date.now()}`, '🎤 User microphone enabled', SystemEventType.MIC_START);
    } else {
      setMicEnabled(false);
      addSystemMessage(`mic_${Date.now()}`, '🔇 User microphone disabled', SystemEventType.MIC_END);
    }
  };

  const toggleCameraInternal = async () => {
    if (!connected) return;

    try {
      // Add system message for video state change (before toggle)
      if (cameraEnabled) {
        addSystemMessage(`camera_${Date.now()}`, '📷 User camera disabled', SystemEventType.CAMERA_END);
      } else {
        addSystemMessage(`camera_${Date.now()}`, '📹 User camera enabled', SystemEventType.CAMERA_START);
      }

      // Toggle the camera
      await toggleCamera();
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  };

  return (
    <div className={`chat-window ${isResizing ? 'resizing' : ''}`} style={{ height: `${chatHeight}px` }}>
      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
        title={`Drag to resize chat window (current height: ${chatHeight}px)`}
      >
        <div className="resize-indicator"></div>
        <div className="resize-dots">
          <span>•</span>
          <span>•</span>
          <span>•</span>
        </div>
        <div className="resize-text">↕ Drag to resize</div>
      </div>
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
      <Tooltip content={tooltipContent} position={tooltipPosition} visible={showTooltip} />
      <div className="chat-input">
        <button
          onClick={toggleMicInternal}
          disabled={!connected}
          className={`icon-button ${!connected ? 'disabled' : ''}`}
          title={micEnabled ? 'Disable microphone' : 'Enable microphone'}
        >
          <span className="material-icons">{micEnabled ? 'mic' : 'mic_off'}</span>
        </button>
        {showDebugFeatures && (
          <button
            onClick={toggleNoiseReduction}
            disabled={!connected || !micEnabled}
            className={`icon-button noise-reduction ${!connected || !micEnabled ? 'disabled' : ''} ${noiseReductionEnabled ? 'active' : ''}`}
            title={
              !micEnabled
                ? 'Enable microphone first to use noise reduction'
                : noiseReductionEnabled
                  ? 'Disable noise reduction'
                  : 'Enable noise reduction'
            }
          >
            <span className="material-icons">{noiseReductionEnabled ? 'noise_control_off' : 'noise_aware'}</span>
          </button>
        )}
        {showDebugFeatures && (
          <button
            onClick={dumpAudio}
            disabled={!connected || !micEnabled || isDumping}
            className={`icon-button audio-dump ${!connected || !micEnabled || isDumping ? 'disabled' : ''} ${isDumping ? 'dumping' : ''}`}
            title={isDumping ? 'Dumping audio data...' : 'Dump audio data for analysis (downloads 9 files)'}
          >
            <span className="material-icons">{isDumping ? 'download' : 'file_download'}</span>
          </button>
        )}
        <button
          onClick={toggleCameraInternal}
          disabled={!connected}
          className={`icon-button ${!connected ? 'disabled' : ''} ${cameraError ? 'error' : ''}`}
          title={cameraError || (cameraEnabled ? 'Disable camera' : 'Enable camera')}
        >
          <span className="material-icons">{cameraEnabled ? 'videocam' : 'videocam_off'}</span>
        </button>
        {!micEnabled && (
          <>
            <input
              type="text"
              placeholder={'Type a message...'}
              disabled={!connected}
              className={!connected ? 'disabled' : ''}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={!connected}
              className={`icon-button ${!connected ? 'disabled' : ''}`}
              title="Send message"
            >
              <span className="material-icons">send</span>
            </button>
            <button
              onClick={async () => {
                // Add system message for interrupt
                addSystemMessage(`interrupt_${Date.now()}`, '🛑 User interrupted response', SystemEventType.INTERRUPT);
                try {
                  await sendInterrupt();
                } catch (error) {
                  console.error('Failed to send interrupt:', error);
                }
              }}
              disabled={!connected}
              className={`icon-button ${!connected ? 'disabled' : ''}`}
              title="Interrupt response"
            >
              <span className="material-icons">stop</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
