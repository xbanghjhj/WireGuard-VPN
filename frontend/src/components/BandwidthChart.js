import { useEffect, useRef, useState } from 'react';
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
  Filler
} from 'chart.js';

// Đăng ký các thành phần biểu đồ cần thiết
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function BandwidthChart({ liveData }) {
  const [chartData, setChartData] = useState({
    labels: Array(10).fill(''),
    datasets: [
      {
        label: 'Tải Xuống (DL Speed)',
        data: Array(10).fill(0),
        borderColor: '#0284c7', // Sky 600
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2
      },
      {
        label: 'Tải Lên (UL Speed)',
        data: Array(10).fill(0),
        borderColor: '#38bdf8', // Sky 300
        backgroundColor: 'rgba(56, 189, 248, 0.05)',
        tension: 0.4,
        fill: true,
        pointRadius: 2
      }
    ]
  });

  const prevStats = useRef({ rx: 0, tx: 0, time: Date.now() });

  useEffect(() => {
    if (!liveData) return;

    let totalRx = 0;
    let totalTx = 0;
    liveData.peers.forEach(p => {
      if (p.enabled && p.online) {
        totalRx += p.rxBytes || 0;
        totalTx += p.txBytes || 0;
      }
    });

    const now = Date.now();
    const timeDelta = (now - prevStats.current.time) / 1000 || 2; // Giây

    // Tính tốc độ: KB/s
    const rxSpeed = Math.max(0, Math.round(((totalRx - prevStats.current.rx) / 1024) / timeDelta)) || 0;
    const txSpeed = Math.max(0, Math.round(((totalTx - prevStats.current.tx) / 1024) / timeDelta)) || 0;

    // Cập nhật giá trị lịch sử
    prevStats.current = { rx: totalRx, tx: totalTx, time: now };

    // Không vẽ tốc độ quá ảo nếu đây là lượt nhận gói đầu tiên (tốc độ ban đầu)
    const activeRxSpeed = totalRx === totalRx - prevStats.current.rx ? 0 : rxSpeed;
    const activeTxSpeed = totalTx === totalTx - prevStats.current.tx ? 0 : txSpeed;

    setChartData(prev => {
      const labels = [...prev.labels.slice(1), new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })];
      const dlData = [...prev.datasets[0].data.slice(1), activeRxSpeed];
      const ulData = [...prev.datasets[1].data.slice(1), activeTxSpeed];

      return {
        labels,
        datasets: [
          { ...prev.datasets[0], data: dlData },
          { ...prev.datasets[1], data: ulData }
        ]
      };
    });
  }, [liveData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#334155', // Slate 700
          font: {
            size: 11,
            family: 'system-ui'
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.raw} KB/s`;
          }
        }
      }
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        ticks: {
          color: '#64748b',
          callback: function (value) {
            return value + ' KB/s';
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          maxRotation: 0
        }
      }
    }
  };

  return (
    <div className="h-full w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
