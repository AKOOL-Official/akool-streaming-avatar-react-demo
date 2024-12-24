
import { VideoChatProvider, useVideoChat } from '@/contexts/VideoChatContext';
import { SettingsPanel } from "./settings-panel";
import { VideoChatPanel } from "./video-chat-panel";

export function VideoChat() {

  return (
    <VideoChatProvider>
      <div className="flex h-screen">
        <SettingsPanel />
        <VideoChatPanel />
      </div>
    </VideoChatProvider>
  );
}

