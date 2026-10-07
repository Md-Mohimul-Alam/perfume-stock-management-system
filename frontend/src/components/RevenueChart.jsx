import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useTheme } from '../context/ThemeContext';

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const money = (value) =>
  `৳${toNumber(
    value
  ).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
    }
  );
};

const RevenueTooltip = ({
  active,
  payload,
  label,
}) => {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="
        rounded-xl
        border
        border-gray-200
        bg-white
        px-3
        py-2
        shadow-xl
        dark:border-slate-700
        dark:bg-slate-800
      "
    >
      <p
        className="
          mb-1
          text-xs
          text-gray-500
          dark:text-gray-400
        "
      >
        {formatDate(label)}
      </p>

      <p
        className="
          text-sm
          font-semibold
          text-brand-primary
          dark:text-brand-secondary
        "
      >
        {money(
          payload[0]?.value
        )}
      </p>
    </div>
  );
};

const RevenueChart = ({
  data = [],
}) => {
  const { theme } =
    useTheme();

  const isDark =
    theme === 'dark';

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return (
      <p
        className="
          py-12
          text-center
          text-sm
          text-gray-400
          dark:text-gray-500
        "
      >
        No revenue data available
      </p>
    );
  }

  const tickColor =
    isDark
      ? '#94a3b8'
      : '#6b7280';

  const gridColor =
    isDark
      ? '#334155'
      : '#d1d5db';

  const brandColor =
    '#b8860b';

  return (
    <div
      className="
        h-[240px]
        w-full
        sm:h-[300px]
      "
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <ComposedChart
          data={data}
          margin={{
            top: 5,
            right: 5,
            left: -15,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient
              id="revenueGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={
                  brandColor
                }
                stopOpacity={
                  isDark
                    ? 0.35
                    : 0.25
                }
              />

              <stop
                offset="95%"
                stopColor={
                  brandColor
                }
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={gridColor}
            opacity={0.55}
          />

          <XAxis
            dataKey="date"
            tickFormatter={
              formatDate
            }
            interval="preserveStartEnd"
            minTickGap={30}
            tick={{
              fontSize: 10,
              fill: tickColor,
            }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            width={60}
            tickFormatter={(
              value
            ) => {
              const number =
                toNumber(value);

              if (
                Math.abs(number) >=
                1000000
              ) {
                return `৳${(
                  number / 1000000
                ).toFixed(1)}M`;
              }

              if (
                Math.abs(number) >=
                1000
              ) {
                return `৳${(
                  number / 1000
                ).toFixed(0)}k`;
              }

              return `৳${number}`;
            }}
            tick={{
              fontSize: 10,
              fill: tickColor,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={
              <RevenueTooltip />
            }
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="none"
            fill="url(#revenueGradient)"
          />

          <Line
            type="monotone"
            dataKey="revenue"
            stroke={brandColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{
              r: 5,
              fill: brandColor,
              stroke:
                isDark
                  ? '#0f172a'
                  : '#ffffff',
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
