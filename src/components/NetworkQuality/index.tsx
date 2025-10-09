import React, { useState, useEffect } from 'react';
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
import { useStreamingContext } from '../../hooks/useStreamingContext';
import { ConnectionQuality } from '../../types/streaming.types';
import './index.css';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Unified network quality data structure
export interface NetworkStats {
  providerType?: string;
  timestamp?: number;
  connectionQuality?: ConnectionQuality | null;
  localNetwork?: {
    uplinkNetworkQuality: number;
    downlinkNetworkQuality: number;
  };
  connection?: {
    roundTripTime: number;
    packetLossRate: number;
  };
  video?: {
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
    sendFrameRate?: number;
    sendResolutionWidth?: number;
    sendResolutionHeight?: number;
    sendBitrate?: number;
    jitterBufferDelay?: number;
  };
  audio?: {
    codecType?: string;
    transportDelay?: number;
    end2EndDelay?: number;
    receiveDelay?: number;
    receiveBitrate?: number;
    packetLossRate?: number;
    receiveLevel?: number;
    sendBitrate?: number;
    sampleRate?: number;
    totalFreezeTime?: number;
    freezeRate?: number;
  };
  // Optional detailed stats that may be available from some providers
  detailedStats?: {
    video?: {
      codec?: string;
      bitrate?: number;
      frameRate?: number;
      resolution?: { width: number; height: number };
      packetLoss?: number;
      rtt?: number;
    };
    audio?: {
      codec?: string;
      bitrate?: number;
      packetLoss?: number;
      volume?: number;
      rtt?: number;
    };
    network?: {
      rtt?: number;
      packetLoss?: number;
    };
  };
}

interface NetworkQualityProps {
  // Optional prop for backward compatibility, but component will use context by default
  stats?: NetworkStats;
}

interface LatencyDataPoint {
  timestamp: number;
  video: number;
  audio: number;
  index: number;
}

const NetworkQualityDisplay: React.FC<NetworkQualityProps> = ({ stats: propStats }) => {
  const { state } = useStreamingContext();
  const TIME_WINDOW = 120;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [latencyData, setLatencyData] = useState<LatencyDataPoint[]>([]);

  // Use context data by default, fallback to props for backward compatibility
  const networkQuality = state?.networkQuality || propStats?.connectionQuality;
  const detailedStats = state?.detailedNetworkStats || propStats?.detailedStats;

  const getQualityClass = (quality: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (quality) {
      case 'excellent':
      case 'good':
        return 'quality-good';
      case 'fair':
        return 'quality-fair';
      case 'poor':
        return 'quality-poor';
      default:
        return 'quality-poor';
    }
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

  useEffect(() => {
    if (!networkQuality) return;

    const now = Date.now();

    setLatencyData((prevData) => {
      // Use detailed stats RTT values if available, otherwise fall back to networkQuality RTT
      const videoRtt = detailedStats?.video?.rtt ?? networkQuality.rtt ?? 0;
      const audioRtt = detailedStats?.audio?.rtt ?? networkQuality.rtt ?? 0;

      const newDataPoint = {
        timestamp: now,
        video: videoRtt,
        audio: audioRtt,
        index: prevData.length + 1,
      };

      const timeWindowMs = TIME_WINDOW * 1000;
      const oneWindowAgo = now - timeWindowMs;
      const filteredData = [...prevData, newDataPoint]
        .filter((point) => point.timestamp > oneWindowAgo)
        .map((point, idx) => ({ ...point, index: idx + 1 }));
      return filteredData;
    });
  }, [networkQuality, detailedStats]);

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
    maintainAspectRatio: false,
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

  // Don't render if no network quality data is available
  if (!networkQuality) {
    return null;
  }

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
          <div className="quality-section">
            <div title="Upload Quality">
              <span>Upload</span>
              <span className={`quality-indicator ${getQualityClass(networkQuality.uplink)}`}></span>
            </div>
            <div title="Download Quality">
              <span>Download</span>
              <span className={`quality-indicator ${getQualityClass(networkQuality.downlink)}`}></span>
            </div>
          </div>
          {!isMinimized && (
            <>
              <div className="quality-section">
                <div title="Connection Score">
                  <span>Score</span>
                  <span className="score-value">{networkQuality.score}/100</span>
                </div>
                <div title="Round Trip Time">
                  <span>RTT</span>
                  <span className="rtt-value">{networkQuality.rtt.toFixed(0)}ms</span>
                </div>
              </div>
              <div className="latency-chart">
                <Line data={chartData} options={chartOptions} />
              </div>
              <div className="stats-section">
                <div className="connection-stats">
                  <h4>Connection</h4>
                  <StatRow label="Score" value={`${networkQuality.score}/100`} />
                  <StatRow label="Upload" value={networkQuality.uplink} />
                  <StatRow label="Download" value={networkQuality.downlink} />
                  <StatRow label="RTT" value={`${networkQuality.rtt.toFixed(1)}ms`} />
                  <StatRow label="Loss" value={`${networkQuality.packetLoss.toFixed(2)}%`} />
                </div>
                {detailedStats && (
                  <>
                    {detailedStats.video && (
                      <div className="video-stats">
                        <h4>Video</h4>
                        {detailedStats.video.codec && detailedStats.video.codec !== '0' && (
                          <StatRow label="Codec" value={detailedStats.video.codec} />
                        )}
                        {detailedStats.video.bitrate && detailedStats.video.bitrate > 0 && (
                          <StatRow label="Bitrate" value={formatBitrate(detailedStats.video.bitrate)} />
                        )}
                        {detailedStats.video.frameRate && detailedStats.video.frameRate > 0 && (
                          <StatRow label="FPS" value={`${detailedStats.video.frameRate.toFixed(1)}`} />
                        )}
                        {detailedStats.video.resolution &&
                          detailedStats.video.resolution.width > 0 &&
                          detailedStats.video.resolution.height > 0 && (
                            <StatRow
                              label="Res"
                              value={`${detailedStats.video.resolution.width}x${detailedStats.video.resolution.height}`}
                            />
                          )}
                        {detailedStats.video.packetLoss !== undefined && detailedStats.video.packetLoss !== null && (
                          <StatRow label="Loss" value={`${detailedStats.video.packetLoss.toFixed(2)}%`} />
                        )}
                        {detailedStats.video.rtt && detailedStats.video.rtt > 0 && (
                          <StatRow label="RTT" value={`${detailedStats.video.rtt.toFixed(1)}ms`} />
                        )}
                      </div>
                    )}
                    {detailedStats.audio && (
                      <div className="audio-stats">
                        <h4>Audio</h4>
                        {detailedStats.audio.codec && detailedStats.audio.codec !== '0' && (
                          <StatRow label="Codec" value={detailedStats.audio.codec} />
                        )}
                        {detailedStats.audio.bitrate && detailedStats.audio.bitrate > 0 && (
                          <StatRow label="Bitrate" value={formatBitrate(detailedStats.audio.bitrate)} />
                        )}
                        {detailedStats.audio.packetLoss !== undefined && detailedStats.audio.packetLoss !== null && (
                          <StatRow label="Loss" value={`${detailedStats.audio.packetLoss.toFixed(2)}%`} />
                        )}
                        {detailedStats.audio.volume !== undefined && detailedStats.audio.volume !== null && (
                          <StatRow label="Vol" value={`${detailedStats.audio.volume.toFixed(0)}`} />
                        )}
                        {detailedStats.audio.rtt && detailedStats.audio.rtt > 0 && (
                          <StatRow label="RTT" value={`${detailedStats.audio.rtt.toFixed(1)}ms`} />
                        )}
                      </div>
                    )}
                  </>
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
