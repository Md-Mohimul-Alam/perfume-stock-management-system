import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, DollarSign, Package } from 'lucide-react';

const NotificationsPanel = ({ lowStockMaterials, lowStockBottles, dueSales }) => {
  const notifications = [];

  // Low stock materials
  lowStockMaterials.forEach((m) => {
    notifications.push({
      id: `mat-${m._id}`,
      type: 'warning',
      icon: Package,
      message: `Material "${m.name}" is low (${m.currentStockMl} ml)`,
      link: `/inventory/materials`,
    });
  });

  // Low stock bottles
  lowStockBottles.forEach((b) => {
    notifications.push({
      id: `bottle-${b._id}`,
      type: 'warning',
      icon: Package,
      message: `Bottle ${b.sizeMl}ml (${b.type}) low (${b.currentStock} pcs)`,
      link: `/inventory/bottles`,
    });
  });

  // Due sales
  dueSales.forEach((sale) => {
    notifications.push({
      id: `sale-${sale._id}`,
      type: 'due',
      icon: DollarSign,
      message: `Due payment of ৳${sale.totalAmount.toFixed(2)} for invoice ${sale.invoiceNo}`,
      link: `/sales?paymentStatus=due`,
    });
  });

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
        ✅ All clear – no alerts
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 font-semibold flex items-center gap-2">
        <AlertCircle size={18} className="text-amber-500" />
        Notifications
        <span className="ml-auto text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
          {notifications.length}
        </span>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {notifications.map((n) => (
          <Link
            key={n.id}
            to={n.link}
            className="block p-3 hover:bg-gray-50 transition flex items-start gap-3"
          >
            <div className={`p-1.5 rounded-full ${n.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
              <n.icon size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">{n.message}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPanel;