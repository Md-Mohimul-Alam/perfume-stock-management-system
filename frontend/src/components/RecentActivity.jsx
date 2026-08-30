// components/RecentActivity.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Wallet, Trash2, TrendingUp } from 'lucide-react';

const RecentActivity = ({ activities }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'sale': return <ShoppingBag className="w-4 h-4 text-blue-500" />;
      case 'purchase': return <ShoppingCart className="w-4 h-4 text-orange-500" />;
      case 'expense': return <Wallet className="w-4 h-4 text-rose-500" />;
      case 'wastage': return <Trash2 className="w-4 h-4 text-red-500" />;
      default: return <TrendingUp className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLink = (activity) => {
    switch (activity.type) {
      case 'sale': return `/sales/${activity.id}`;
      case 'purchase': return `/purchases/${activity.id}`;
      case 'expense': return `/expenses`;
      case 'wastage': return `/wastage`;
      default: return '#';
    }
  };

  if (activities.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">No recent activity</p>;
  }

  return (
    <div className="space-y-2">
      {activities.slice(0, 10).map((item, idx) => (
        <Link
          key={idx}
          to={getLink(item)}
          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-full bg-gray-100 flex-shrink-0">
              {getIcon(item.type)}
            </div>
            <div className="truncate">
              <p className="text-sm font-medium text-gray-700 truncate">{item.title}</p>
              <p className="text-xs text-gray-400 truncate">{item.time}</p>
            </div>
          </div>
          {item.amount && (
            <span className="text-sm font-semibold whitespace-nowrap ml-2">
              {item.amount > 0 ? '+' : ''}${item.amount.toFixed(2)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};

export default RecentActivity;