
import { useEffect, useState, useCallback } from 'react';
import API from '../../api/axios';

import {
  Droplet,
  SprayCan,
  BarChart3,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import toast from 'react-hot-toast';

const OIL_SIZES = [3.5, 6, 15, 30];
const SPRAY_SIZES = [6, 15, 30, 50, 100];

const createSizeMap = (sizes) => {
  const map = {};

  sizes.forEach((size) => {
    map[size] = {
      qty: 0,
      revenue: 0,
    };
  });

  return map;
};

const getNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const getProductType = (item) => {
  const product = item.product;

  // Supports both populated product objects and direct type fields.
  if (product && typeof product === 'object') {
    return String(
      product.type ||
      product.category ||
      product.productType ||
      ''
    ).toLowerCase();
  }

  return String(
    item.productType ||
    item.type ||
    item.category ||
    ''
  ).toLowerCase();
};

const getItemRevenue = (item) => {
  const quantity = getNumber(item.quantity);

  // Use line total when available to preserve discounts.
  const lineTotal =
    item.totalPrice ??
    item.subtotal ??
    item.lineTotal;

  if (
    lineTotal !== undefined &&
    lineTotal !== null &&
    Number.isFinite(Number(lineTotal))
  ) {
    return getNumber(lineTotal);
  }

  return getNumber(item.unitPrice) * quantity;
};

const SalesCount = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [data, setData] = useState({
    oil: {},
    spray: {},
    other: {
      qty: 0,
      revenue: 0,
    },
    totalOilQty: 0,
    totalSprayQty: 0,
    totalOtherQty: 0,
    totalRevenue: 0,
    totalItems: 0,
    totalSales: 0,
  });

  const fetchSalesCount = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await API.get('/sales');

      const sales = Array.isArray(response.data)
        ? response.data
        : [];

      const oilMap = createSizeMap(OIL_SIZES);
      const sprayMap = createSizeMap(SPRAY_SIZES);

      const other = {
        qty: 0,
        revenue: 0,
      };

      let totalOilQty = 0;
      let totalSprayQty = 0;
      let totalOtherQty = 0;
      let totalRevenue = 0;
      let totalItems = 0;

      sales.forEach((sale) => {
        const items = Array.isArray(sale.items)
          ? sale.items
          : [];

        items.forEach((item) => {
          if (!item) return;

          const quantity = getNumber(item.quantity);

          if (quantity <= 0) return;

          const revenue = getItemRevenue(item);
          const type = getProductType(item);

          const size = getNumber(item.sizeMl);

          totalRevenue += revenue;
          totalItems += quantity;

          if (
            type === 'roll-on' ||
            type.includes('roll-on') ||
            type === 'oil' ||
            type.includes('oil')
          ) {
            const sizeKey = size || 'Other';

            if (!oilMap[sizeKey]) {
              oilMap[sizeKey] = {
                qty: 0,
                revenue: 0,
              };
            }

            oilMap[sizeKey].qty += quantity;
            oilMap[sizeKey].revenue += revenue;

            totalOilQty += quantity;
          } else if (
            type === 'spray' ||
            type.includes('spray') ||
            type === 'perfume'
          ) {
            const sizeKey = size || 'Other';

            if (!sprayMap[sizeKey]) {
              sprayMap[sizeKey] = {
                qty: 0,
                revenue: 0,
              };
            }

            sprayMap[sizeKey].qty += quantity;
            sprayMap[sizeKey].revenue += revenue;

            totalSprayQty += quantity;
          } else {
            // Other product categories are included in total revenue.
            // This also prevents empty bottle sales from disappearing
            // from the overall revenue total.
            other.qty += quantity;
            other.revenue += revenue;

            totalOtherQty += quantity;
          }
        });
      });

      setData({
        oil: oilMap,
        spray: sprayMap,
        other,
        totalOilQty,
        totalSprayQty,
        totalOtherQty,
        totalRevenue,
        totalItems,
        totalSales: sales.length,
      });
    } catch (error) {
      console.error('Failed to load sales data:', error);

      toast.error(
        error.response?.data?.message ||
          'Failed to load sales data'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesCount();
  }, [fetchSalesCount]);

  // CHART DATA
  const oilChartData = Object.entries(data.oil)
    .map(([size, value]) => ({
      size: `${size}ml`,
      qty: value.qty,
    }))
    .sort(
      (a, b) =>
        parseFloat(a.size) - parseFloat(b.size)
    );

  const sprayChartData = Object.entries(data.spray)
    .map(([size, value]) => ({
      size: `${size}ml`,
      qty: value.qty,
    }))
    .sort(
      (a, b) =>
        parseFloat(a.size) - parseFloat(b.size)
    );

  // FORMATTERS
  const formatCurrency = (amount) => {
    return `৳${getNumber(amount).toLocaleString('en-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getTotalRevenue = (map) => {
    return Object.values(map).reduce(
      (sum, value) => sum + getNumber(value.revenue),
      0
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Sales Count
          </h1>

          <p className="text-gray-500 text-sm">
            Units sold by product type and size
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSalesCount}
          disabled={refreshing}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'animate-spin' : ''}
          />

          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />

            <p className="text-gray-500">
              Loading sales data...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Droplet className="w-6 h-6 text-amber-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Oil Sold
                </p>

                <p className="text-xl font-bold text-gray-800">
                  {data.totalOilQty} units
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <SprayCan className="w-6 h-6 text-blue-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Spray Sold
                </p>

                <p className="text-xl font-bold text-gray-800">
                  {data.totalSprayQty} units
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Total Sales Revenue
                </p>

                <p className="text-xl font-bold text-gray-800">
                  {formatCurrency(data.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          {/* CHARTS AND TABLES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OIL SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Droplet className="w-5 h-5 text-amber-600" />
                Oil (Roll-on)
              </h2>

              {/* BAR CHART */}
              <div className="h-52 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oilChartData}>
                    <XAxis
                      dataKey="size"
                      tick={{ fontSize: 12 }}
                    />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="qty"
                      name="Units Sold"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Size (ml)
                      </th>

                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Units Sold
                      </th>

                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Revenue
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(data.oil)
                      .sort(
                        (a, b) =>
                          parseFloat(a[0]) - parseFloat(b[0])
                      )
                      .map(([size, value]) => (
                        <tr
                          key={size}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-2 text-sm">
                            {size}
                          </td>

                          <td className="px-4 py-2 text-sm text-right font-semibold">
                            {value.qty}
                          </td>

                          <td className="px-4 py-2 text-sm text-right text-gray-600">
                            {formatCurrency(value.revenue)}
                          </td>
                        </tr>
                      ))}

                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">
                        Total
                      </td>

                      <td className="px-4 py-2 text-sm text-right">
                        {data.totalOilQty}
                      </td>

                      <td className="px-4 py-2 text-sm text-right">
                        {formatCurrency(
                          getTotalRevenue(data.oil)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SPRAY SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <SprayCan className="w-5 h-5 text-blue-600" />
                Spray (Perfume)
              </h2>

              {/* BAR CHART */}
              <div className="h-52 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sprayChartData}>
                    <XAxis
                      dataKey="size"
                      tick={{ fontSize: 12 }}
                    />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="qty"
                      name="Units Sold"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Size (ml)
                      </th>

                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Units Sold
                      </th>

                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Revenue
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(data.spray)
                      .sort(
                        (a, b) =>
                          parseFloat(a[0]) - parseFloat(b[0])
                      )
                      .map(([size, value]) => (
                        <tr
                          key={size}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-2 text-sm">
                            {size}
                          </td>

                          <td className="px-4 py-2 text-sm text-right font-semibold">
                            {value.qty}
                          </td>

                          <td className="px-4 py-2 text-sm text-right text-gray-600">
                            {formatCurrency(value.revenue)}
                          </td>
                        </tr>
                      ))}

                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">
                        Total
                      </td>

                      <td className="px-4 py-2 text-sm text-right">
                        {data.totalSprayQty}
                      </td>

                      <td className="px-4 py-2 text-sm text-right">
                        {formatCurrency(
                          getTotalRevenue(data.spray)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* OTHER PRODUCTS */}
          {data.totalOtherQty > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mt-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Other Products
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Other Units Sold
                  </p>

                  <p className="text-xl font-bold text-gray-800">
                    {data.totalOtherQty} units
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Other Product Revenue
                  </p>

                  <p className="text-xl font-bold text-gray-800">
                    {formatCurrency(data.other.revenue)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesCount;
