import { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Droplet,
  SprayCan,
  BarChart3,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';

const SalesCount = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    oil: {},   // map size -> {qty, revenue}
    spray: {}, // map size -> {qty, revenue}
    totalOilQty: 0,
    totalSprayQty: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchSalesCount();
  }, []);

  const fetchSalesCount = async () => {
    setRefreshing(true);
    try {
      const { data: sales } = await API.get('/sales');

      // Initialize with default sizes
      const oilSizes = [3.5, 6, 15, 30];
      const spraySizes = [6, 15, 30, 50, 100];
      const oilMap = {};
      const sprayMap = {};
      oilSizes.forEach(s => (oilMap[s] = { qty: 0, revenue: 0 }));
      spraySizes.forEach(s => (sprayMap[s] = { qty: 0, revenue: 0 }));

      let totalOilQty = 0;
      let totalSprayQty = 0;
      let totalRevenue = 0;

      sales.forEach(sale => {
        sale.items.forEach(item => {
          if (!item.product || !item.quantity) return;
          const size = item.sizeMl;
          const qty = item.quantity;
          const revenue = item.unitPrice * qty;

          if (item.product.type === 'roll-on') {
            if (!oilMap[size]) {
              oilMap[size] = { qty: 0, revenue: 0 };
            }
            oilMap[size].qty += qty;
            oilMap[size].revenue += revenue;
            totalOilQty += qty;
          } else if (item.product.type === 'spray') {
            if (!sprayMap[size]) {
              sprayMap[size] = { qty: 0, revenue: 0 };
            }
            sprayMap[size].qty += qty;
            sprayMap[size].revenue += revenue;
            totalSprayQty += qty;
          }
          totalRevenue += revenue;
        });
      });

      setData({
        oil: oilMap,
        spray: sprayMap,
        totalOilQty,
        totalSprayQty,
        totalRevenue,
      });
    } catch (error) {
      toast.error('Failed to load sales data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Prepare chart data
  const oilChartData = Object.entries(data.oil).map(([size, val]) => ({
    size: `${size}ml`,
    qty: val.qty,
  }));
  const sprayChartData = Object.entries(data.spray).map(([size, val]) => ({
    size: `${size}ml`,
    qty: val.qty,
  }));

  const formatCurrency = (amount) => `৳${(amount || 0).toFixed(2)}`;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales Count</h1>
          <p className="text-gray-500 text-sm">Units sold by product type and size</p>
        </div>
        <button
          onClick={fetchSalesCount}
          disabled={refreshing}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-gray-500">Loading sales data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Droplet className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Oil Sold</p>
                <p className="text-xl font-bold text-gray-800">{data.totalOilQty} units</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <SprayCan className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Spray Sold</p>
                <p className="text-xl font-bold text-gray-800">{data.totalSprayQty} units</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(data.totalRevenue)}</p>
              </div>
            </div>
          </div>

          {/* Charts and Tables Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Oil Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Droplet className="w-5 h-5 text-amber-600" />
                Oil (Roll‑on)
              </h2>

              {/* Bar Chart */}
              <div className="h-52 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oilChartData}>
                    <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(data.oil)
                      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      .map(([size, val]) => (
                        <tr key={size} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{size}</td>
                          <td className="px-4 py-2 text-sm text-right font-semibold">{val.qty}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(val.revenue)}</td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">Total</td>
                      <td className="px-4 py-2 text-sm text-right">{data.totalOilQty}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {formatCurrency(Object.values(data.oil).reduce((sum, v) => sum + v.revenue, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Spray Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <SprayCan className="w-5 h-5 text-blue-600" />
                Spray (Perfume)
              </h2>

              {/* Bar Chart */}
              <div className="h-52 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sprayChartData}>
                    <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(data.spray)
                      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      .map(([size, val]) => (
                        <tr key={size} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{size}</td>
                          <td className="px-4 py-2 text-sm text-right font-semibold">{val.qty}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(val.revenue)}</td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">Total</td>
                      <td className="px-4 py-2 text-sm text-right">{data.totalSprayQty}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {formatCurrency(Object.values(data.spray).reduce((sum, v) => sum + v.revenue, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesCount;