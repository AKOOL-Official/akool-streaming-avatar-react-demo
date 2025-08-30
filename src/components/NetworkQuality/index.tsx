import { useState, useEffect } from 'react';
import { NetworkQuality as AgoraNetworkQuality, RemoteVideoTrackStats, RemoteAudioTrackStats } from 'agora-rtc-sdk-ng';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './index.css';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Unified network quality interface
export interface UnifiedNetworkQuality {
  uplinkNetworkQuality: number;
  downlinkNetworkQuality: number;
}

// Unified video stats interface
export interface UnifiedVideoStats {
  codecType?: string;
  transportDelay?: number;
  end2EndDelay?: number;
  receiveDelay?: number;
  receiveFrameRate?: number;
  receiveResolutionWidth?: number;
  receiveResolutionHeight?: number;
  receiveBitrate?: number;
  packetLossRate?: number;
  totalFreezeTime?: number;
  freezeRate?: number;
}

// Unified audio stats interface
export interface UnifiedAudioStats {
  codecType?: string;
  transportDelay?: number;
  end2EndDelay?: number;
  receiveDelay?: number;
  receiveBitrate?: number;
  packetLossRate?: number;
  receiveLevel?: number;
}

// Unified network stats interface supporting all providers
export interface NetworkStats {
  providerType: 'agora' | 'livekit' | 'trtc';
  localNetwork?: UnifiedNetworkQuality;
  remoteNetwork?: UnifiedNetworkQuality;
  video?: UnifiedVideoStats;
  audio?: UnifiedAudioStats;
}

// Legacy interface for backward compatibility
export interface LegacyNetworkStats {
  localNetwork: AgoraNetworkQuality;
  remoteNetwork: AgoraNetworkQuality;
  video: RemoteVideoTrackStats;
  audio: RemoteAudioTrackStats;
}

interface NetworkQualityProps {
  stats: NetworkStats | null;
  streamType: 'agora' | 'livekit' | 'trtc';
}

interface LatencyDataPoint {
  timestamp: number;
  video: number;
  audio: number;
  index: number;
}

const NetworkQualityDisplay = ({ stats, streamType }: NetworkQualityProps) => {
  // Create default stats when none are provided
  const defaultStats: NetworkStats = {
    providerType: streamType,
    // No detailed stats available initially
  };

  // Use provided stats or default to basic stats
  const currentStats = stats || defaultStats;
  const TIME_WINDOW = 120;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [latencyData, setLatencyData] = useState<LatencyDataPoint[]>([]);

  const getQualityClass = (quality: number) => {
    // Fix inverted scale: higher numbers = better quality (0-6 scale)
    if (quality >= 5) return 'quality-good'; // 5-6 = excellent (green)
    if (quality >= 3) return 'quality-fair'; // 3-4 = fair (yellow)
    return 'quality-poor'; // 0-2 = poor (red)
  };

  const formatBitrate = (bitrate: number) => {
    if (bitrate < 1000) return `${bitrate.toFixed(0)} bps`;
    if (bitrate < 1000000) return `${(bitrate / 1000).toFixed(1)} Kbps`;
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  };

  const StatRow = ({ label, value }: { label: string; value: string | number }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  // Helper function to safely get numeric value
  const getSafeValue = (value: number | undefined, defaultValue: number = 0): number => {
    return typeof value === 'number' ? value : defaultValue;
  };

  // Helper function to format value with fallback
  const formatValue = (value: number | string | undefined, unit: string = '', fallback: string = 'N/A'): string => {
    if (value === undefined || value === null) return fallback;
    return `${value}${unit}`;
  };

  useEffect(() => {
    // Only update latency data if we have video or audio stats
    if (!currentStats.video && !currentStats.audio) return;

    const now = Date.now();

    setLatencyData((prevData) => {
      const newDataPoint = {
        timestamp: now,
        video: getSafeValue(currentStats.video?.end2EndDelay),
        audio: getSafeValue(currentStats.audio?.end2EndDelay),
        index: prevData.length + 1,
      };

      const timeWindowMs = TIME_WINDOW * 1000;
      const oneWindowAgo = now - timeWindowMs;
      const filteredData = [...prevData, newDataPoint]
        .filter((point) => point.timestamp > oneWindowAgo)
        .map((point, idx) => ({ ...point, index: idx + 1 }));
      return filteredData;
    });
  }, [currentStats]);

  const chartData = {
    labels: latencyData.map((d) => d.index),
    datasets: [
      {
        label: 'Video Latency',
        data: latencyData.map((d) => d.video),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Audio Latency',
        data: latencyData.map((d) => d.audio),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    animation: {
      duration: 0,
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
        title: {
          display: true,
          text: 'Latency (ms)',
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          callback: function (tickValue: number | string) {
            return Number(tickValue);
          },
        },
        title: {
          display: true,
          text: `Last ${TIME_WINDOW} Seconds`,
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
      title: {
        display: true,
        text: 'Network Latency',
        color: 'rgba(255, 255, 255, 0.9)',
      },
    },
  };

  return (
    <>
      <button
        className="network-quality-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Hide network stats' : 'Show network stats'}
      >
        <span className="material-icons">{isOpen ? 'insights' : 'bar_chart'}</span>
      </button>

      {isOpen && (
        <div
          className={`network-quality ${isMinimized ? 'minimized' : ''}`}
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="provider-info">
            <span>Provider: {currentStats.providerType.toUpperCase()}</span>
          </div>

          {currentStats.localNetwork && (
            <div className="quality-section">
              <div title="Local Upload Quality">
                <span>Local Upload</span>
                <span
                  className={`quality-indicator ${getQualityClass(currentStats.localNetwork.uplinkNetworkQuality)}`}
                ></span>
              </div>
              <div title="Local Download Quality">
                <span>Local Download</span>
                <span
                  className={`quality-indicator ${getQualityClass(currentStats.localNetwork.downlinkNetworkQuality)}`}
                ></span>
              </div>
            </div>
          )}

          {!isMinimized && (
            <>
              {currentStats.remoteNetwork && (
                <div className="quality-section">
                  <div title="Remote Download Quality">
                    <span>Remote Download</span>
                    <span
                      className={`quality-indicator ${getQualityClass(currentStats.remoteNetwork.downlinkNetworkQuality)}`}
                    ></span>
                  </div>
                  <div title="Remote Upload Quality">
                    <span>Remote Upload</span>
                    <span
                      className={`quality-indicator ${getQualityClass(currentStats.remoteNetwork.uplinkNetworkQuality)}`}
                    ></span>
                  </div>
                </div>
              )}
              {(currentStats.video || currentStats.audio) && latencyData.length > 0 && (
                <div className="latency-chart">
                  <Line data={chartData} options={chartOptions} />
                </div>
              )}

              <div className="stats-section">
                {currentStats.video && (
                  <div className="video-stats">
                    <h4>Video Statistics</h4>
                    <StatRow label="Codec" value={formatValue(currentStats.video.codecType)} />
                    <StatRow
                      label="Transport Delay"
                      value={formatValue(currentStats.video.transportDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="End-to-End Delay"
                      value={formatValue(currentStats.video.end2EndDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="Receive Delay"
                      value={formatValue(currentStats.video.receiveDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="Frame Rate"
                      value={formatValue(currentStats.video.receiveFrameRate?.toFixed(1), ' fps')}
                    />
                    {currentStats.video.receiveResolutionWidth && currentStats.video.receiveResolutionHeight && (
                      <StatRow
                        label="Resolution"
                        value={`${currentStats.video.receiveResolutionWidth}x${currentStats.video.receiveResolutionHeight}`}
                      />
                    )}
                    <StatRow
                      label="Bitrate"
                      value={
                        currentStats.video.receiveBitrate ? formatBitrate(currentStats.video.receiveBitrate) : 'N/A'
                      }
                    />
                    <StatRow
                      label="Packet Loss"
                      value={formatValue(currentStats.video.packetLossRate?.toFixed(2), '%')}
                    />
                    {currentStats.video.totalFreezeTime !== undefined && (
                      <StatRow label="Total Freeze Time" value={`${currentStats.video.totalFreezeTime}s`} />
                    )}
                    {currentStats.video.freezeRate !== undefined && (
                      <StatRow
                        label="Freeze Rate"
                        value={formatValue(currentStats.video.freezeRate?.toFixed(2), '%')}
                      />
                    )}
                  </div>
                )}

                {currentStats.audio && (
                  <div className="audio-stats">
                    <h4>Audio Statistics</h4>
                    <StatRow label="Codec" value={formatValue(currentStats.audio.codecType)} />
                    <StatRow
                      label="Transport Delay"
                      value={formatValue(currentStats.audio.transportDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="End-to-End Delay"
                      value={formatValue(currentStats.audio.end2EndDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="Receive Delay"
                      value={formatValue(currentStats.audio.receiveDelay?.toFixed(1), 'ms')}
                    />
                    <StatRow
                      label="Bitrate"
                      value={
                        currentStats.audio.receiveBitrate ? formatBitrate(currentStats.audio.receiveBitrate) : 'N/A'
                      }
                    />
                    <StatRow
                      label="Packet Loss"
                      value={formatValue(currentStats.audio.packetLossRate?.toFixed(2), '%')}
                    />
                    <StatRow label="Volume Level" value={formatValue(currentStats.audio.receiveLevel?.toFixed(0))} />
                  </div>
                )}

                {!currentStats.video && !currentStats.audio && (
                  <div className="no-stats">
                    <p>⏳ Collecting detailed statistics...</p>
                  </div>
                )}

                {currentStats.video && !currentStats.audio && (
                  <div className="audio-note">
                    <p>💡 Audio statistics will appear when avatar is speaking</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default NetworkQualityDisplay;
