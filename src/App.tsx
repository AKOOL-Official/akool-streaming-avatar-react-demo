import { VideoChat } from "./components/video-chat"
import { VideoChatProvider } from "./contexts/VideoChatContext"

const App = () => {
  return (
    <VideoChatProvider>
      <VideoChat />
    </VideoChatProvider>
  )
}

export default App