import React, { useState } from 'react';
import { useMessageState } from '../../hooks/useMessageState';
import { ResizableContainer } from '../shared';
import MessageList from './MessageList';
import ChatControls from './ChatControls';
import { useMessageHandlers } from './hooks/useMessageHandlers';
import './styles/index.css';

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
  // State for resizable height
  const [chatHeight, setChatHeight] = useState(400);

  // Initialize message state and handlers
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

  // Set up message event handlers
  useMessageHandlers({
    connected,
    onSystemMessageCallback,
    addSystemMessage,
    addChatMessage,
    clearMessages,
  });

  return (
    <ResizableContainer
      initialHeight={chatHeight}
      onHeightChange={setChatHeight}
      className="chat-window"
      showResizeText={true}
    >
      <MessageList messages={messages} formatTime={formatTime} shouldShowTimeSeparator={shouldShowTimeSeparator} />

      <ChatControls
        connected={connected}
        micEnabled={micEnabled}
        setMicEnabled={setMicEnabled}
        toggleMic={toggleMic}
        cameraEnabled={cameraEnabled}
        toggleCamera={toggleCamera}
        cameraError={cameraError}
        noiseReductionEnabled={noiseReductionEnabled}
        toggleNoiseReduction={toggleNoiseReduction}
        isDumping={isDumping}
        dumpAudio={dumpAudio}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        sendMessage={sendMessage}
        addSystemMessage={addSystemMessage}
      />
    </ResizableContainer>
  );
};

export default ChatInterface;
