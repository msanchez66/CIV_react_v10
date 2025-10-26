import React, { useRef } from 'react';
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
import { Line } from 'react-chartjs-2';

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

interface CumulativeChartProps {
  data: number[];
  maxX?: number;
}

const CumulativeChart: React.FC<CumulativeChartProps> = ({ data, maxX = 400 }) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  const xValues = Array.from({ length: data.length }, (_, i) => i * (maxX / data.length));
  
  const chartData = {
    labels: xValues.map(x => x.toFixed(0)),
    datasets: [
      {
        label: 'Segments with Length > L',
        data: data,
        borderColor: '#3498db',
        backgroundColor: 'rgba(255, 165, 0, 0.2)', // Light orange
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Segments: ${context.parsed.y.toLocaleString()}`;
          },
          title: function(context: any) {
            return `Length: ${context[0].label}m`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Length L (m)',
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          font: {
            size: 12,
          },
        },
        grid: {
          color: 'rgba(192, 192, 192, 0.3)',
        },
        max: maxX,
      },
      y: {
        title: {
          display: true,
          text: 'Number of Segments with Length > L',
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return value.toLocaleString();
          },
        },
        grid: {
          color: 'rgba(192, 192, 192, 0.3)',
        },
      },
    },
  };

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default CumulativeChart;
