import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingBag,
  Wallet,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  FileText,
  Users,
  Percent,
  Building2,
} from 'lucide-react';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // State for data
  const [stockReport, setStockReport] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [investorProfit, setInvestorProfit] = useState(null);
  const [availableCash, setAvailableCash] = useState(0);

  // Loading states for each tab
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [loadingInvestor, setLoadingInvestor] = useState(false);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    setLoading(true);
    await Promise.all([
      fetchStockReport(),
      fetchSalesReport(),
      fetchProfitReport(),
      fetchInvestorReport(),
      fetchAvailableCash(),
    ]);
    setLoading(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAllReports();
    setRefreshing(false);
    toast.success('Reports refreshed');
  };

  const fetchStockReport = async () => {
    setLoadingStock(true);
    try {
      const { data } = await API.get('/reports/stock');
      setStockReport(data);
    } catch (err) {
      console.error('Stock report error:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchSalesReport = async () => {
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const { data } = await API.get(`/reports/sales?${params}`);
      setSalesReport(data);
    } catch (err) {
      console.error('Sales report error:', err);
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchProfitReport = async () => {
    setLoadingProfit(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const { data } = await API.get(`/reports/profit?${params}`);
      setProfitReport(data);
    } catch (err) {
      console.error('Profit report error:', err);
    } finally {
      setLoadingProfit(false);
    }
  };

  const fetchInvestorReport = async () => {
    setLoadingInvestor(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const { data } = await API.get(`/reports/investor-profit?${params}`);
      setInvestorProfit(data);
    } catch (err) {
      console.error('Investor report error:', err);
    } finally {
      setLoadingInvestor(false);
    }
  };

  const fetchAvailableCash = async () => {
    try {
      const { data } = await API.get('/reports/available-cash');
      setAvailableCash(data.availableCash || 0);
    } catch (err) {
      console.error('Available cash error:', err);
    }
  };

  const handleDateChange = async () => {
    await Promise.all([
      fetchSalesReport(),
      fetchProfitReport(),
      fetchInvestorReport(),
    ]);
    toast.success('Reports updated with new date range');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `৳${(amount || 0).toFixed(2)}`;
  };

  // Format number
  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };

  // Tabs configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'profit', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'investors', label: 'Investors', icon: Users },
  ];

  // ----- Loading State -----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
          <p className="text-gray-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Comprehensive business analytics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <button
          onClick={handleDateChange}
          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
        >
          Apply
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-amber-600 border-b-2 border-amber-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* ============================================================
            OVERVIEW TAB
            ============================================================ */}
        {activeTab === 'overview' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Available Cash</p>
                  <DollarSign size={18} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(availableCash)}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Inventory Value</p>
                  <Package size={18} className="text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {stockReport ? formatCurrency(stockReport.summary?.totalInventoryValue) : '—'}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
                  <TrendingUp size={18} className="text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {profitReport ? formatCurrency(profitReport.totalRevenue) : '—'}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Net Profit</p>
                  <TrendingUp size={18} className="text-amber-600" />
                </div>
                <p className={`text-2xl font-bold ${(profitReport?.netProfit || 0) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {profitReport ? formatCurrency(profitReport.netProfit) : '—'}
                </p>
              </div>
            </div>

            {/* Business Value */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Business Value</p>
                  <p className="text-3xl font-bold text-amber-700">
                    {profitReport && stockReport
                      ? formatCurrency(profitReport.netProfit + (stockReport.summary?.totalInventoryValue || 0))
                      : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Building2 size={18} />
                  <span>Cash + Inventory</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <ShoppingBag size={16} className="text-amber-600" />
                  Sales Summary
                </h3>
                {profitReport ? (
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Revenue</span>
                      <span className="font-semibold">{formatCurrency(profitReport.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Total Sales</span>
                      <span className="font-semibold">{formatNumber(salesReport?.sales?.length || 0)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Total Units Sold</span>
                      <span className="font-semibold">{formatNumber(salesReport?.totalUnits || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No sales data available</p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Package size={16} className="text-blue-600" />
                  Inventory Summary
                </h3>
                {stockReport ? (
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Raw Materials Value</span>
                      <span className="font-semibold">{formatCurrency(stockReport.summary?.totalMaterialValue)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Bottles Value</span>
                      <span className="font-semibold">{formatCurrency(stockReport.summary?.totalBottleValue)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500 font-medium">Total Inventory</span>
                      <span className="font-bold text-blue-600">{formatCurrency(stockReport.summary?.totalInventoryValue)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No inventory data available</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============================================================
            STOCK TAB
            ============================================================ */}
        {activeTab === 'stock' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Inventory Stock Report</h3>
              <p className="text-sm text-gray-500">Current stock levels and values</p>
            </div>
            {loadingStock ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : stockReport ? (
              <div className="p-5">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Raw Materials</p>
                    <p className="text-xl font-bold text-amber-700">{formatCurrency(stockReport.summary?.totalMaterialValue)}</p>
                    <p className="text-xs text-gray-400">{stockReport.materials?.length || 0} materials</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Bottles</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(stockReport.summary?.totalBottleValue)}</p>
                    <p className="text-xs text-gray-400">{stockReport.bottles?.length || 0} bottle types</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Inventory</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(stockReport.summary?.totalInventoryValue)}</p>
                  </div>
                </div>

                {/* Materials Table */}
                <h4 className="font-semibold text-gray-700 mb-3">Raw Materials</h4>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock (ml)</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Per ml Cost</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stockReport.materials?.slice(0, 10).map((m) => (
                        <tr key={m._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{m.name}</td>
                          <td className="px-4 py-2 text-sm">{m.sku}</td>
                          <td className="px-4 py-2 text-sm text-right">{m.currentStockMl}</td>
                          <td className="px-4 py-2 text-sm text-right">{m.avgCostPerMl?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{(m.currentStockMl * m.avgCostPerMl).toFixed(2)}</td>
                        </tr>
                      ))}
                      {stockReport.materials?.length > 10 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-2 text-center text-sm text-gray-400">
                            + {stockReport.materials.length - 10} more materials
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottles Table */}
                <h4 className="font-semibold text-gray-700 mb-3">Bottles</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Cost</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stockReport.bottles?.slice(0, 10).map((b) => (
                        <tr key={b._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{b.sizeMl} ml</td>
                          <td className="px-4 py-2 text-sm capitalize">{b.type}</td>
                          <td className="px-4 py-2 text-sm text-right">{b.currentStock}</td>
                          <td className="px-4 py-2 text-sm text-right">{b.avgCostPerUnit?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{(b.currentStock * b.avgCostPerUnit).toFixed(2)}</td>
                        </tr>
                      ))}
                      {stockReport.bottles?.length > 10 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-2 text-center text-sm text-gray-400">
                            + {stockReport.bottles.length - 10} more bottles
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">No stock data available</div>
            )}
          </div>
        )}

        {/* ============================================================
            SALES TAB
            ============================================================ */}
        {activeTab === 'sales' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Sales Report</h3>
              <p className="text-sm text-gray-500">
                {dateRange.start && dateRange.end
                  ? `${new Date(dateRange.start).toLocaleDateString()} – ${new Date(dateRange.end).toLocaleDateString()}`
                  : 'All time'}
              </p>
            </div>
            {loadingSales ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : salesReport ? (
              <div className="p-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-xl font-bold text-purple-700">{formatCurrency(salesReport.totalRevenue)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Units Sold</p>
                    <p className="text-xl font-bold text-blue-700">{formatNumber(salesReport.totalUnits)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Sales</p>
                    <p className="text-xl font-bold text-emerald-700">{formatNumber(salesReport.sales?.length || 0)}</p>
                  </div>
                </div>

                {/* By Channel */}
                {salesReport.byChannel && Object.keys(salesReport.byChannel).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3">Revenue by Channel</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Object.entries(salesReport.byChannel).map(([channel, data]) => (
                        <div key={channel} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500">{channel}</p>
                          <p className="text-sm font-semibold">{formatCurrency(data.revenue)}</p>
                          <p className="text-xs text-gray-400">{formatNumber(data.units)} units</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Sales Table */}
                <h4 className="font-semibold text-gray-700 mb-3">Recent Sales</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {salesReport.sales?.slice(0, 20).map((sale) => (
                        <tr key={sale._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium">{sale.invoiceNo}</td>
                          <td className="px-4 py-2 text-sm">{sale.channel}</td>
                          <td className="px-4 py-2 text-sm">{new Date(sale.saleDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-sm text-right font-semibold">{formatCurrency(sale.totalAmount)}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sale.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {sale.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {salesReport.sales?.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-gray-400">No sales in this period</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">No sales data available</div>
            )}
          </div>
        )}

        {/* ============================================================
            PROFIT & LOSS TAB
            ============================================================ */}
        {activeTab === 'profit' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Profit & Loss Statement</h3>
              <p className="text-sm text-gray-500">Revenue, expenses, and net profit</p>
            </div>
            {loadingProfit ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : profitReport ? (
              <div className="p-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(profitReport.totalRevenue)}</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Expenses</p>
                    <p className="text-xl font-bold text-rose-700">{formatCurrency(profitReport.totalExpense)}</p>
                  </div>
                  <div className={`rounded-xl p-4 border ${
                    profitReport.netProfit >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                  }`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Net Profit</p>
                    <p className={`text-xl font-bold ${profitReport.netProfit >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                      {formatCurrency(profitReport.netProfit)}
                    </p>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Revenue Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-600">Total Sales Revenue</span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(profitReport.totalRevenue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Expense Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-600">Total Purchases</span>
                        <span className="font-semibold text-rose-600">{formatCurrency(profitReport.totalPurchaseCost)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-600">Total Expenses</span>
                        <span className="font-semibold text-rose-600">{formatCurrency(profitReport.totalExpense)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600 font-medium">Total Costs</span>
                        <span className="font-bold text-rose-600">
                          {formatCurrency((profitReport.totalPurchaseCost || 0) + (profitReport.totalExpense || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-800">Net Profit</span>
                      <span className={`text-2xl font-bold ${profitReport.netProfit >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                        {formatCurrency(profitReport.netProfit)}
                      </span>
                    </div>
                    {profitReport.netProfit >= 0 ? (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp size={16} /> Positive profit margin
                      </p>
                    ) : (
                      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                        <TrendingDown size={16} /> Loss – review expenses
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">No profit data available</div>
            )}
          </div>
        )}

        {/* ============================================================
            INVESTORS TAB
            ============================================================ */}
        {activeTab === 'investors' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Investor Profit Distribution</h3>
              <p className="text-sm text-gray-500">Share of profits based on investment</p>
            </div>
            {loadingInvestor ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : investorProfit ? (
              <div className="p-5">
                {/* Summary */}
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mb-6">
                  <p className="text-sm text-gray-600">Total Net Profit Available for Distribution</p>
                  <p className="text-3xl font-bold text-amber-700">{formatCurrency(investorProfit.netProfit)}</p>
                </div>

                {/* Distribution Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Investor</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {investorProfit.distribution?.map((inv, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{inv.name}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {inv.sharePercentage.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(inv.amount)}
                          </td>
                        </tr>
                      ))}
                      {(!investorProfit.distribution || investorProfit.distribution.length === 0) && (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-gray-400">No investors found</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-right">Total Distributed</td>
                        <td className="px-4 py-3 text-right">100%</td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          {formatCurrency(investorProfit.distribution?.reduce((sum, inv) => sum + inv.amount, 0) || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Note */}
                <p className="text-xs text-gray-400 mt-4">
                  * Distribution is calculated based on each investor's net contribution share.
                  <br />
                  <Link to="/investors" className="text-amber-600 hover:underline">Manage investors →</Link>
                </p>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">No investor data available</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;