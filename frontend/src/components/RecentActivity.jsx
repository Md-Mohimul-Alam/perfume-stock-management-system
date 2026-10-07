import { Link } from 'react-router-dom';

import {
  ShoppingBag,
  ShoppingCart,
  Wallet,
  Trash2,
  TrendingUp,
} from 'lucide-react';

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const money = (value) =>
  `৳${Math.abs(
    toNumber(value)
  ).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const RecentActivity = ({
  activities = [],
}) => {
  const getIcon = (type) => {
    switch (type) {
      case 'sale':
        return (
          <ShoppingBag
            className="
              h-4
              w-4
              text-blue-500
              dark:text-blue-400
            "
          />
        );

      case 'purchase':
        return (
          <ShoppingCart
            className="
              h-4
              w-4
              text-orange-500
              dark:text-orange-400
            "
          />
        );

      case 'expense':
        return (
          <Wallet
            className="
              h-4
              w-4
              text-rose-500
              dark:text-rose-400
            "
          />
        );

      case 'wastage':
        return (
          <Trash2
            className="
              h-4
              w-4
              text-red-500
              dark:text-red-400
            "
          />
        );

      default:
        return (
          <TrendingUp
            className="
              h-4
              w-4
              text-gray-500
              dark:text-gray-400
            "
          />
        );
    }
  };

  const getLink = (activity) => {
    switch (activity?.type) {
      case 'sale':
        return '/sales';

      case 'purchase':
        return '/purchases';

      case 'expense':
        return '/expenses';

      case 'wastage':
        return '/wastage';

      default:
        return '/';
    }
  };

  const getIconBackground = (type) => {
    switch (type) {
      case 'sale':
        return 'bg-blue-50 dark:bg-blue-900/30';

      case 'purchase':
        return 'bg-orange-50 dark:bg-orange-900/30';

      case 'expense':
        return 'bg-rose-50 dark:bg-rose-900/30';

      case 'wastage':
        return 'bg-red-50 dark:bg-red-900/30';

      default:
        return 'bg-gray-100 dark:bg-slate-700';
    }
  };

  if (
    !Array.isArray(activities) ||
    activities.length === 0
  ) {
    return (
      <div className="py-8 text-center">
        <TrendingUp
          className="
            mx-auto
            h-6
            w-6
            text-gray-300
            dark:text-gray-600
          "
        />

        <p
          className="
            mt-2
            text-sm
            text-gray-400
            dark:text-gray-500
          "
        >
          No recent activity
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities
        .slice(0, 10)
        .map((item, index) => {
          const amount =
            item.amount !== undefined
              ? toNumber(item.amount)
              : null;

          const itemKey =
            item.id ||
            `${item.type}-${index}`;

          return (
            <Link
              key={itemKey}
              to={getLink(item)}
              className="
                group
                flex
                items-center
                justify-between
                gap-3
                rounded-xl
                p-3
                transition-colors
                hover:bg-gray-50
                active:bg-gray-100
                dark:hover:bg-slate-700/60
                dark:active:bg-slate-700
              "
            >
              <div
                className="
                  flex
                  min-w-0
                  items-center
                  gap-3
                "
              >
                <div
                  className={`
                    flex
                    h-9
                    w-9
                    flex-shrink-0
                    items-center
                    justify-center
                    rounded-full
                    ${getIconBackground(
                      item.type
                    )}
                  `}
                >
                  {getIcon(
                    item.type
                  )}
                </div>

                <div className="min-w-0">
                  <p
                    className="
                      truncate
                      text-sm
                      font-medium
                      text-gray-700
                      transition-colors
                      group-hover:text-gray-900
                      dark:text-gray-200
                      dark:group-hover:text-white
                    "
                  >
                    {item.title ||
                      'Activity'}
                  </p>

                  {item.time && (
                    <p
                      className="
                        mt-0.5
                        truncate
                        text-xs
                        text-gray-400
                        dark:text-gray-500
                      "
                    >
                      {item.time}
                    </p>
                  )}
                </div>
              </div>

              {amount !== null && (
                <span
                  className={`
                    ml-2
                    flex-shrink-0
                    whitespace-nowrap
                    text-xs
                    font-semibold
                    sm:text-sm
                    ${
                      amount > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : amount < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-gray-600 dark:text-gray-300'
                    }
                  `}
                >
                  {amount > 0
                    ? '+'
                    : amount < 0
                      ? '−'
                      : ''}

                  {money(amount)}
                </span>
              )}
            </Link>
          );
        })}
    </div>
  );
};

export default RecentActivity;
