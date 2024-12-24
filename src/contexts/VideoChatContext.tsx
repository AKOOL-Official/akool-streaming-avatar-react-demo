import React, { createContext, useContext, useState, useCallback } from 'react';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";
import { sendGptMessage } from '@/utils/openai';
import { GPT_TOKEN, OPENAPI_TOKEN } from '@/utils/constants';

interface VideoChatContextProps {
  isVideoSubed: boolean;
  resolution: { width: number; height: number };
  isJoined: boolean;
  messages: { text: string; isSentByMe: boolean }[];
  inputMessage: string;
  sending: boolean;
  connected: boolean;
  language: string;
  voiceId: string;
  openapiHost: string;
  avatarId: string;
  openapiToken: string;
  session: SessionData | null;
  messageSendTo: string;
  updateResolution: (width: number, height: number) => Promise<void>;
  joinChannel: (appid: string, channel: string, token: string, uid: number) => Promise<void>;
  leaveChannel: () => Promise<void>;
  startStreaming: () => Promise<void>;
  closeStreaming: () => Promise<void>;
  sendMessage: () => Promise<void>;
  setInputMessage: React.Dispatch<React.SetStateAction<string>>;
  setOpenapiHost: React.Dispatch<React.SetStateAction<string>>;
  setOpenapiToken: React.Dispatch<React.SetStateAction<string>>;
  setAvatarId: React.Dispatch<React.SetStateAction<string>>;
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
  setVoiceId: React.Dispatch<React.SetStateAction<string>>;
  useGptChat: boolean;
  setUseGptChat: React.Dispatch<React.SetStateAction<boolean>>;
  botPersonality: string;
  setBotPersonality: React.Dispatch<React.SetStateAction<string>>;
  gptToken: string;
  setGptToken: React.Dispatch<React.SetStateAction<string>>;
}

interface SessionData {
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

const VideoChatContext = createContext<VideoChatContextProps | undefined>(undefined);

const client: IAgoraRTCClient = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8",
});

type GptMessage = {
  role: "user" | "assistant" | "system";
  content: string;
}

export const VideoChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVideoSubed, setIsVideoSubed] = useState(false);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1080, height: 720 });
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState<{ text: string; isSentByMe: boolean }[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [language, setLanguage] = useState("en");
  const [voiceId, setVoiceId] = useState("Xb7hH8MSUJpSbSDYk0k2");
  const [openapiHost, setOpenapiHost] = useState("https://openapi.akool.com");
  const [avatarId, setAvatarId] = useState("dvp_Tristan_cloth2_1080P");
  const [openapiToken, setOpenapiToken] = useState(OPENAPI_TOKEN || '');
  const [session, setSession] = useState<SessionData | null>(null);
  const [messageSendTo, setMessageSendTo] = useState("");
  const [useGptChat, setUseGptChat] = useState(false);
  const [botPersonality, setBotPersonality] = useState("");
  const [gptToken, setGptToken] = useState(GPT_TOKEN || '');

  const updateResolution = useCallback(async (width: number, height: number) => {
    setResolution({ width, height });
  }, []);

  const joinChannel = useCallback(async (appid: string, channel: string, token: string, uid: number) => {
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
  }, [isJoined]);

  const leaveChannel = useCallback(async () => {
    setIsJoined(false);
    await client.leave();
  }, []);

  const onUserPublish = useCallback(async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
    if (mediaType === "video") {
      const remoteTrack = await client.subscribe(user, mediaType);
      remoteTrack.play("remote-video");
      setIsVideoSubed(true);
    }
    if (mediaType === "audio") {
      const remoteTrack = await client.subscribe(user, mediaType);
      remoteTrack.play();
    }
  }, []);

  const createSession = useCallback(async (avatar_id: string) => {
    const response = await fetch(`${openapiHost}/api/open/v3/liveAvatar/session/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openapiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stream_type: "agora",
        avatar_id,
      }),
    });
    const body = await response.json();
    if (body.code != 1000) {
      alert(body.msg);
      throw new Error(body.msg);
    }
    return body.data;
  }, [openapiHost, openapiToken]);

  const closeSession = useCallback(async (id: string) => {
    const response = await fetch(`${openapiHost}/api/open/v3/liveAvatar/session/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openapiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
      }),
    });
    const body = await response.json();
    if (body.code != 1000) {
      alert(body.msg);
      throw new Error(body.msg);
    }
    return body.data;
  }, [openapiHost, openapiToken]);

  const leaveChat = useCallback(() => {
    socket?.close();
  }, [socket]);

  const closeStreaming = useCallback(async () => {
    leaveChat();
    await leaveChannel();
    if (!session) {
      console.log("session not found");
      return;
    }
    await closeSession(session._id);
    setIsVideoSubed(false);
  }, [leaveChannel, leaveChat, closeSession, session]);

  const joinChat = useCallback((chatUrl: string) => {
    if (socket) {
      socket.close();
      setSocket(null);
    }

    const ws = new WebSocket(chatUrl);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message = event.data;
      const { type, payload } = JSON.parse(message);
      if (type === "chat") {
        const { answer } = JSON.parse(payload);

        setMessages((prevMessages) => [
          ...prevMessages,
          { text: answer, isSentByMe: false },
        ]);
      }
    };

    ws.onclose = () => {
      setSocket(null);
      setConnected(false);
    };

    setSocket(ws);
  }, [socket]);


  const startStreaming = useCallback(async () => {
    const data = await createSession(avatarId);
    setSession(data);

    const { uid, stream_urls } = data;
    const { agora_app_id, agora_channel, agora_token, client_chat_room_url, server_chat_room_url } = stream_urls;

    const parts = server_chat_room_url.split("/");
    const sendTo = parts[parts.length - 1].split(".")[0];

    setMessageSendTo(sendTo);

    await joinChannel(agora_app_id, agora_channel, agora_token, uid);
    joinChat(client_chat_room_url);
  }, [avatarId, createSession, joinChannel, joinChat]);

  
  console.log(`useGptChat: ${useGptChat}`);

  const sendMessage = useCallback(async () => {
    let q = inputMessage;
    if (socket && socket.readyState === WebSocket.OPEN) {
      setSending(true);

      

      setMessages((prevMessages) => [
        ...prevMessages,
        { text: inputMessage, isSentByMe: true },
      ]);
      console.log(`useGptChat: ${useGptChat}`);
      if (useGptChat) {
        const msgs = messages.map((m) => ({ 
          role: m.isSentByMe ? "user" : "assistant",
          content: m.text 
        } as GptMessage));
        msgs.push({ role: "user", content: inputMessage });
        const gptResponse = await sendGptMessage(gptToken, msgs, botPersonality);
        console.log(`gptResponse: ${gptResponse}`);
        q = gptResponse;
      }

      socket.send(
        JSON.stringify({
          type: "chat",
          to: messageSendTo,
          payload: JSON.stringify({
            message_id: `msg-${Date.now()}`,
            voice_id: voiceId,
            voice_url: "",
            language: language,
            mode_type: 1,
            prompt: { from: "url", content: "" },
            question: q,
          }),
        })
      );

      setInputMessage("");
      setSending(false);
    } else {
      console.error("WebSocket is not open");
    }
  }, [socket, inputMessage, messageSendTo, voiceId, language, useGptChat, gptToken, botPersonality, messages]);

  return (
    <VideoChatContext.Provider value={{
      isVideoSubed,
      resolution,
      isJoined,
      messages,
      inputMessage,
      sending,
      connected,
      language,
      voiceId,
      openapiHost,
      avatarId,
      openapiToken,
      session,
      messageSendTo,
      updateResolution,
      joinChannel,
      leaveChannel,
      startStreaming,
      closeStreaming,
      sendMessage,
      setInputMessage,
      setOpenapiHost,
      setOpenapiToken,
      setAvatarId,
      setLanguage,
      setVoiceId,
      useGptChat,
      setUseGptChat,
      botPersonality,
      setBotPersonality,
      gptToken,
      setGptToken,
    }}>
      {children}
    </VideoChatContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useVideoChat = () => {
  const context = useContext(VideoChatContext);
  if (!context) {
    throw new Error('useVideoChat must be used within a VideoChatProvider');
  }
  return context;
}; 