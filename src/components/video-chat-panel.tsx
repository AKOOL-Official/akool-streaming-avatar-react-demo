import { useVideoChat } from "@/contexts/VideoChatContext"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"

export function VideoChatPanel() {
  const { isVideoSubed, isJoined, connected, sending, messages, inputMessage, setInputMessage, startStreaming, closeStreaming, sendMessage } = useVideoChat();
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 h-[80%]">
        <div className="relative h-full">
          <video
            id="placeholder-video"
            hidden={isVideoSubed}
            src="https://static.website-files.org/assets/videos/avatar/live/Alina_loop-1.mp4"
            loop
            muted
            playsInline
            autoPlay
            className={`w-full h-full object-cover ${isVideoSubed ? "hidden" : ""}`}
          ></video>
          <video
            id="remote-video"
            hidden={!isVideoSubed}
            className={`w-full h-full object-cover ${isVideoSubed ? "" : "hidden"}`}
          ></video>
          <div className="absolute bottom-4 right-4 space-x-2">
            <Button variant="outline" onClick={startStreaming} disabled={isJoined}>
              Start Streaming
            </Button>
            <Button variant="outline" onClick={closeStreaming} disabled={!isJoined}>
              Close Streaming
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white h-[20%]">
        <ScrollArea className="h-[calc(100%-40px)] w-full rounded-md border p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-2 ${message.isSentByMe ? "text-right" : "text-left"}`}
            >
              <span
                className={`inline-block p-2 rounded-lg ${
                  message.isSentByMe
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {message.text}
              </span>
            </div>
          ))}
        </ScrollArea>
        <div className="flex space-x-2 mt-2">
          <Input
            type="text"
            placeholder={connected ? "Type a message..." : "Disconnected"}
            disabled={sending || !connected}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyUp={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button onClick={sendMessage} disabled={sending || !connected}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
} 