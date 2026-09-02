import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const RevenueChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No revenue data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12, fill: '#6b7280' }} 
          className="dark:fill-gray-400" 
        />
        <YAxis 
          tickFormatter={(val) => `৳${val}`} 
          tick={{ fill: '#6b7280' }} 
          className="dark:fill-gray-400" 
        />
        <Tooltip
          formatter={(val) => `৳${val.toFixed(2)}`}
          contentStyle={{
            backgroundColor: '#ffffff',
            borderColor: '#e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
          itemStyle={{ color: '#374151' }}
          labelStyle={{ color: '#6b7280' }}
          wrapperClassName="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
        />
        <Legend 
          wrapperStyle={{ color: '#6b7280' }} 
          className="dark:text-gray-400" 
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 4, fill: '#f59e0b' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RevenueChart;