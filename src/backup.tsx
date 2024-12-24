import { useState } from "react";
import "./App.css";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

const client: IAgoraRTCClient = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8",
});

function App() {
  const [isVideoSubed, setIsVideoSubed] = useState(false);
  const [resolution, setResolution] = useState<{
    width: number;
    height: number;
  }>({ width: 1080, height: 720 });

  const updateResolution = async (width: number, height: number) => {
    console.log("updateResolution", width, height);
    setResolution({ width, height });
  };

  const [isJoined, setIsJoined] = useState(false);

  const joinChannel = async (
    appid: string,
    channel: string,
    token: string,
    uid: number
  ) => {
    if (!channel) {
      channel = "react-room";
    }

    if (isJoined) {
      await leaveChannel();
    }

    client.on("user-published", onUserPublish);
    client.on("exception", console.log);

    await client.join(appid, channel, token || null, uid || null);

    setIsJoined(true);
  };

  const leaveChannel = async () => {
    setIsJoined(false);

    await client.leave();
  };

  const onUserPublish = async (
    user: IAgoraRTCRemoteUser,
    mediaType: "video" | "audio"
  ) => {
    console.log("onUserPublish", user, mediaType);
    if (mediaType === "video") {
      const remoteTrack = await client.subscribe(user, mediaType);
      remoteTrack.play("remote-video");
      setIsVideoSubed(true);
    }
    if (mediaType === "audio") {
      const remoteTrack = await client.subscribe(user, mediaType);
      remoteTrack.play();
    }
  };

  const [messages, setMessages] = useState<
    { text: string; isSentByMe: boolean }[]
  >([]);
  const [inputMessage, setInputMessage] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);

  const [language, setLanguage] = useState("en");
  const [voiceId, setVoiceId] = useState("Xb7hH8MSUJpSbSDYk0k2");

  const [openapiHost, setOpenapiHost] = useState("https://openapi.akool.com");
  const [avatarId, setAvatarId] = useState("dvp_Tristan_cloth2_1080P");
  const [openapiToken, setOpenapiToken] = useState("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NGQ5Y2Q0NzNhNjc3YjZiY2VlMzQwMSIsInVpZCI6NDc3MTU5NSwiZW1haWwiOiJyaW5rdUBha29vbC5jb20iLCJjcmVkZW50aWFsSWQiOiI2NzUwMDdkODNjYzUzNjZhNGM5MGE4ODYiLCJmaXJzdE5hbWUiOiJSaW5rdSIsImxhc3ROYW1lIjoiU2FtYW50YSIsInRlYW1faWQiOiI2NzRkOWNkNDUwNjNiZmFjMDdlNzA0YzgiLCJyb2xlX2FjdGlvbnMiOlsxLDIsMyw0LDUsNiw3LDgsOV0sImlzX2RlZmF1bHRfdGVhbSI6dHJ1ZSwiZnJvbSI6InRvTyIsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNzMzMjk4MjU2LCJleHAiOjIwNDQzMzgyNTZ9.i8SkYXBXMvNStDytrVK0ggsZ3u0LDlHgOmv6AgYrFGk");

  const createSession = async (avatar_id: string) => {
    const response = await fetch(
      `${openapiHost}/api/open/v3/liveAvatar/session/create`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openapiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stream_type: "agora",
          avatar_id,
        }),
      }
    );
    const body = await response.json();
    if (body.code != 1000) {
      alert(body.msg);
      throw new Error(body.msg);
    }
    return body.data;
  };

  const closeSession = async (id: string) => {
    const response = await fetch(
      `${openapiHost}/api/open/v3/liveAvatar/session/close`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openapiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      }
    );
    const body = await response.json();
    if (body.code != 1000) {
      alert(body.msg);
      throw new Error(body.msg);
    }
    return body.data;
  };

  interface Session {
    _id: string;
    uid: number;
    stream_urls: {
      agora_app_id: string;
      agora_channel: string;
      agora_token: string;
      client_chat_room_url: string;
      server_chat_room_url: string;
    };
  }

  const [session, setSession] = useState<Session | null>(null);
  const [messageSendTo, setMessageSendTo] = useState("");
  const startStreaming = async () => {
    const data = await createSession(avatarId);
    console.log(data);
    setSession(data);

    const { uid, stream_urls } = data;
    const {
      agora_app_id,
      agora_channel,
      agora_token,
      client_chat_room_url,
      server_chat_room_url,
    } = stream_urls;

    const parts = server_chat_room_url.split("/");
    const sendTo = parts[parts.length - 1].split(".")[0];

    setMessageSendTo(sendTo);

    await joinChannel(agora_app_id, agora_channel, agora_token, uid);
    console.log("client_chat_room_url", client_chat_room_url);
    joinChat(client_chat_room_url);
  };

  const closeStreaming = async () => {
    leaveChat();
    await leaveChannel();
    if (!session) {
      console.log("session not found");
      return;
    }
    await closeSession(session._id);
  };

  const joinChat = (chatUrl: string) => {
    if (socket) {
      socket.close();
      setSocket(null);
    }

    console.log("Start to connect WebSocket", chatUrl);
    const ws = new WebSocket(chatUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message = event.data;
      const { type, /*from, to,*/ payload } = JSON.parse(message);
      if (type === "chat") {
        const { answer } = JSON.parse(payload);

        setMessages((prevMessages) => [
          ...prevMessages,
          { text: answer, isSentByMe: false },
        ]);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setSocket(null);
      setConnected(false);
    };

    setSocket(ws);
  };

  const leaveChat = () => {
    socket?.close();
  };

  const sendMessage = async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setSending(true);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: inputMessage, isSentByMe: true },
      ]);

      

      /*
        If you need to utilize your own LLM service, perform an HTTP request here.
        Send the "inputMessage" to your backend and retrieve the response.
        Ensure to update "mode_type" to 1 afterward.

        Example:

        // Call openAI API
        

        try {
          const response = await fetch('https://your-backend-host/api/llm/answer', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: inputMessage,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            inputMessage = result.answer;
          } else {
            console.error("Failed to fetch from backend", response.statusText);
          }
        } catch (error) {
          console.error("Error during fetch operation", error);
        }
      */

      socket.send(
        JSON.stringify({
          type: "chat",
          to: messageSendTo,
          payload: JSON.stringify({
            message_id: `msg-${Date.now()}`,
            voice_id: voiceId,
            voice_url: "",
            language: language,
            // Mode type 1: Repeat mode, where the avatar repeats exactly what is sent to it.
            // Mode type 2: Akool LLM mode, where Akool generates responses based on the question provided.
            mode_type: 1,
            prompt: { from: "url", content: "" },
            question: inputMessage,
          }),
        })
      );

      setInputMessage("");
      setSending(false);
    } else {
      console.error("WebSocket is not open");
    }
  };

  return (
    <>
      <div className="left-side">
        <h3>Video Resolution</h3>
        <div>
          <label>
            Width:
            <input
              type="number"
              defaultValue={resolution.width}
              onChange={(e) => (resolution.width = Number(e.target.value))}
            />
          </label>
          <label>
            Height:
            <input
              type="number"
              defaultValue={resolution.height}
              onChange={(e) => (resolution.height = Number(e.target.value))}
            />
          </label>
        </div>
        <div>
          <button
            onClick={() =>
              updateResolution(resolution.width, resolution.height)
            }
          >
            Update Resolution
          </button>
        </div>
        <h3>Streaming</h3>
        <div>
          <label>
            Host:
            <input
              style={{ width: "50%" }}
              defaultValue={openapiHost}
              onChange={(e) => setOpenapiHost(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Token:
            <input
              style={{ width: "50%" }}
              defaultValue={openapiToken}
              onChange={(e) => setOpenapiToken(e.target.value)}
              placeholder="get your token from https://akool.com"
            />
          </label>
        </div>
        <div>
          <label>
            AvatarId:
            <input
              defaultValue={avatarId}
              onChange={(e) => setAvatarId(e.target.value)}
            />
          </label>
        </div>
        <h3>Chat</h3>
        <div>
          <label>
            Language:
            <input
              defaultValue={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </label>
          <label>
            Voice:
            <input
              defaultValue={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            />
          </label>
        </div>
        <div className="buttons">
          <button
            onClick={startStreaming}
            className={isJoined ? "button-on" : ""}
            disabled={isJoined}
          >
            Start Streaming
          </button>
          <button onClick={closeStreaming}>Close Streaming</button>
        </div>
      </div>
      <div className="right-side">
        <video
          id="placeholder-video"
          hidden={isVideoSubed}
          src="https://static.website-files.org/assets/videos/avatar/live/Alina_loop-1.mp4"
          loop
          muted
          playsInline
          autoPlay
          style={{
            width: `${resolution.width}px`,
            height: `${resolution.height}px`,
          }}
        ></video>
        <video
          id="remote-video"
          hidden={isVideoSubed ? false : true}
          style={{
            width: `${resolution.width}px`,
            height: `${resolution.height}px`,
          }}
        ></video>
        <div
          className="chat-window"
          style={{
            width: `${resolution.width}px`,
            height: `${resolution.height}px`,
          }}
        >
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat-message ${
                  message.isSentByMe ? "sent" : "received"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              placeholder={
                "Type a message... WebSocket: " +
                (connected ? "Connected" : "Disconnected")
              }
              disabled={sending}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyUp={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} disabled={sending}>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
