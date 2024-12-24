import { useVideoChat } from "@/contexts/VideoChatContext";
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Slider } from "./ui/slider"
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";


export function SettingsPanel() {
    const { resolution,
         updateResolution,
         openapiHost,
         setOpenapiHost,
         openapiToken,
         setOpenapiToken,
         avatarId,
         setAvatarId,
         language,
         setLanguage,
         voiceId,
         setVoiceId,
         useGptChat,
         setUseGptChat,
         botPersonality,
         setBotPersonality,
         gptToken,
         setGptToken 
    } = useVideoChat();

    return (
        <div className="w-1/4 p-4 bg-gray-100 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="resolution-width">Resolution Width</Label>
                    <Slider
                        id="resolution-width"
                        min={320}
                        max={1920}
                        step={1}
                        value={[resolution.width]}
                        onValueChange={(value) => updateResolution(value[0], resolution.height)}
                    />
                    <span className="text-sm text-gray-500">{resolution.width}px</span>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="resolution-height">Resolution Height</Label>
                    <Slider
                        id="resolution-height"
                        min={240}
                        max={1080}
                        step={1}
                        value={[resolution.height]}
                        onValueChange={(value) => updateResolution(resolution.width, value[0])}
                    />
                    <span className="text-sm text-gray-500">{resolution.height}px</span>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="openapi-host">OpenAPI Host</Label>
                    <Input
                        id="openapi-host"
                        value={openapiHost}
                        onChange={(e) => setOpenapiHost(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="openapi-token">OpenAPI Token</Label>
                    <Input
                        id="openapi-token"
                        value={openapiToken}
                        onChange={(e) => setOpenapiToken(e.target.value)}
                        type="password"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="avatar-id">Avatar ID</Label>
                    <Input
                        id="avatar-id"
                        value={avatarId}
                        onChange={(e) => setAvatarId(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input
                        id="language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="voice-id">Voice ID</Label>
                    <Input
                        id="voice-id"
                        value={voiceId}
                        onChange={(e) => setVoiceId(e.target.value)}
                    />
                </div>
                <div className="border-t border-gray-300 my-4"></div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="use-gpt-chat"
                        checked={useGptChat}
                        onCheckedChange={(checked) => {
                            setUseGptChat(!!checked);
                        }}
                    />
                    <Label htmlFor="use-gpt-chat">Use GPT Chat</Label>
                </div>
                {useGptChat && <div className="space-y-2">
                    <Label htmlFor="gpt-token">GPT Token</Label>
                    <Input
                        id="gpt-token"
                        type="password"
                        value={gptToken}
                        onChange={(e) => setGptToken(e.target.value)}
                    />
                </div>}     
                {useGptChat && <div className="space-y-2">
                    <Label htmlFor="bot-personality">Bot's Personality</Label>
                    <Textarea
                        id="bot-personality"
                        value={botPersonality}
                        onChange={(e) => setBotPersonality(e.target.value)}
                    />
                </div>}
            </div>
        </div>
    )
} 