import React, { useState, useEffect } from 'react';
import { NetworkQuality, RemoteVideoTrackStats, RemoteAudioTrackStats } from 'agora-rtc-sdk-ng';
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

export interface NetworkStats {
  localNetwork: NetworkQuality;
  remoteNetwork: NetworkQuality;
  video: RemoteVideoTrackStats;
  audio: RemoteAudioTrackStats;
}

interface NetworkQualityProps {
  stats: NetworkStats;
}

interface LatencyDataPoint {
  timestamp: number;
  video: number;
  audio: number;
  index: number;
}

const NetworkQualityDisplay: React.FC<NetworkQualityProps> = ({ stats }) => {
  const TIME_WINDOW = 120;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [latencyData, setLatencyData] = useState<LatencyDataPoint[]>([]);

  const getQualityClass = (quality: number) => {
    if (quality <= 2) return 'quality-good';
    if (quality <= 4) return 'quality-fair';
    return 'quality-poor';
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
    const now = Date.now();

    setLatencyData((prevData) => {
      const newDataPoint = {
        timestamp: now,
        video: stats.video.end2EndDelay || 0,
        audio: stats.audio.end2EndDelay || 0,
        index: prevData.length + 1,
      };

      const timeWindowMs = TIME_WINDOW * 1000;
      const oneWindowAgo = now - timeWindowMs;
      const filteredData = [...prevData, newDataPoint]
        .filter((point) => point.timestamp > oneWindowAgo)
        .map((point, idx) => ({ ...point, index: idx + 1 }));
      return filteredData;
    });
  }, [stats]);

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
          <div className="quality-section">
            <div title="Local Upload Quality">
              <span>Local Upload</span>
              <span className={`quality-indicator ${getQualityClass(stats.localNetwork.uplinkNetworkQuality)}`}></span>
            </div>
            <div title="Local Download Quality">
              <span>Local Download</span>
              <span
                className={`quality-indicator ${getQualityClass(stats.localNetwork.downlinkNetworkQuality)}`}
              ></span>
            </div>
          </div>
          {!isMinimized && (
            <>
              <div className="quality-section">
                <div title="Remote Download Quality">
                  <span>Remote Download</span>
                  <span
                    className={`quality-indicator ${getQualityClass(stats.remoteNetwork.downlinkNetworkQuality)}`}
                  ></span>
                </div>
                <div title="Remote Upload Quality">
                  <span>Remote Upload</span>
                  <span
                    className={`quality-indicator ${getQualityClass(stats.remoteNetwork.uplinkNetworkQuality)}`}
                  ></span>
                </div>
              </div>
              <div className="latency-chart">
                <Line data={chartData} options={chartOptions} />
              </div>
              <div className="stats-section">
                <div className="video-stats">
                  <h4>Video Statistics</h4>
                  <StatRow label="Codec" value={stats.video.codecType || 'N/A'} />
                  <StatRow label="Transport Delay" value={`${stats.video.transportDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="End-to-End Delay" value={`${stats.video.end2EndDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="Receive Delay" value={`${stats.video.receiveDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="Frame Rate" value={`${stats.video.receiveFrameRate?.toFixed(1) || 0} fps`} />
                  <StatRow
                    label="Resolution"
                    value={`${stats.video.receiveResolutionWidth}x${stats.video.receiveResolutionHeight}`}
                  />
                  <StatRow label="Bitrate" value={formatBitrate(stats.video.receiveBitrate)} />
                  <StatRow label="Packet Loss" value={`${stats.video.packetLossRate?.toFixed(2) || 0}%`} />
                  <StatRow label="Total Freeze Time" value={`${stats.video.totalFreezeTime}s`} />
                  <StatRow label="Freeze Rate" value={`${stats.video.freezeRate?.toFixed(2) || 0}%`} />
                </div>
                <div className="audio-stats">
                  <h4>Audio Statistics</h4>
                  <StatRow label="Codec" value={stats.audio.codecType || 'N/A'} />
                  <StatRow label="Transport Delay" value={`${stats.audio.transportDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="End-to-End Delay" value={`${stats.audio.end2EndDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="Receive Delay" value={`${stats.audio.receiveDelay?.toFixed(1) || 0}ms`} />
                  <StatRow label="Bitrate" value={formatBitrate(stats.audio.receiveBitrate)} />
                  <StatRow label="Packet Loss" value={`${stats.audio.packetLossRate?.toFixed(2) || 0}%`} />
                  <StatRow label="Volume Level" value={`${stats.audio.receiveLevel?.toFixed(0) || 0}`} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default NetworkQualityDisplay;
