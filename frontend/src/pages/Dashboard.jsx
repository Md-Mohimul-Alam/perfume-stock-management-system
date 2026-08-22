import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  FlaskRound, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Sparkles,
  Droplet,
  SprayCan,
  BarChart3,
  Wallet,
  Calendar,
  ArrowUpRight,
  Layers,
  ShoppingCart,
  Award,
  Clock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import API from '../api/axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    materials: 0,
    bottles: 0,
    products: 0,
    salesCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    netProfit: 0,
    rawMaterialStockValue: 0,
    bottleStockValue: 0,
    totalInventoryValue: 0,
    dueCount: 0,
    dueAmount: 0,
  });
  const [salesTypeCounts, setSalesTypeCounts] = useState({ oil: 0, perfume: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [bottles, setBottles] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0); // 👈 NEW

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        materialsRes,
        bottlesWithSalesRes,
        productsRes,
        salesRes,
        expensesRes,
        purchasesRes,
        cashRes,
        settlementsRes, // 👈 NEW
      ] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles/with-sales'),
        API.get('/products'),
        API.get('/sales'),
        API.get('/expenses'),
        API.get('/purchases'),
        API.get('/reports/available-cash'),
        API.get('/investors/settlements'), // 👈 new endpoint
      ]);

      const allSales = salesRes?.data || [];
      const allExpenses = expensesRes?.data || [];
      const allPurchases = purchasesRes?.data || [];
      const products = productsRes?.data || [];
      const materials = materialsRes?.data || [];
      const bottleData = bottlesWithSalesRes?.data || [];

      setBottles(bottleData);
      setSettlementsTotal(settlementsRes.data?.total || 0);

      // Due sales
      const dueSales = allSales.filter(s => s.paymentStatus === 'due');
      const dueCount = dueSales.length;
      const dueAmount = dueSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);

      // Totals
      const totalRevenue = allSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);
      const totalExpenses = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const totalPurchases = allPurchases.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);

      // Stock values
      let rawMaterialStockValue = 0;
      materials.forEach(m => {
        const stock = parseFloat(m.currentStockMl) || 0;
        const avgCost = parseFloat(m.avgCostPerMl) || 0;
        rawMaterialStockValue += stock * avgCost;
      });

      let bottleStockValue = 0;
      bottleData.forEach(b => {
        const stock = parseFloat(b.currentStock) || 0;
        const avgCost = parseFloat(b.avgCostPerUnit) || 0;
        bottleStockValue += stock * avgCost;
      });

      const totalInventoryValue = rawMaterialStockValue + bottleStockValue;
      const availableCash = cashRes.data?.availableCash || 0;

      // Sales by product type
      let oilSold = 0;
      let perfumeSold = 0;
      const productSalesMap = {};

      for (const sale of allSales) {
        if (!sale.items || !sale.items.length) continue;
        for (const item of sale.items) {
          const product = item.product;
          if (!product) continue;
          if (product.type === 'roll-on') oilSold += (item.quantity || 0);
          else if (product.type === 'spray') perfumeSold += (item.quantity || 0);

          const productId = product._id;
          if (!productSalesMap[productId]) {
            productSalesMap[productId] = {
              productId,
              totalSold: 0,
              totalRevenue: 0,
              productName: product.name,
              sku: product.sku,
            };
          }
          productSalesMap[productId].totalSold += (item.quantity || 0);
          productSalesMap[productId].totalRevenue += (item.quantity || 0) * (item.unitPrice || 0);
        }
      }

      const sortedProducts = Object.values(productSalesMap)
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5);
      setTopProducts(sortedProducts);

      const recentExp = [...allExpenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      const recentPur = [...allPurchases]
        .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
        .slice(0, 5);

      setStats({
        materials: materials.length,
        bottles: bottleData.length,
        products: products.length,
        salesCount: allSales.length,
        totalRevenue,
        totalExpenses,
        totalPurchases,
        netProfit: availableCash,
        rawMaterialStockValue,
        bottleStockValue,
        totalInventoryValue,
        dueCount,
        dueAmount,
      });
      setSalesTypeCounts({ oil: oilSold, perfume: perfumeSold });
      setRecentExpenses(recentExp);
      setRecentPurchases(recentPur);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- Main Stats Cards ---
  const mainCards = [
    {
      title: 'Raw Materials',
      value: stats.materials,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50/80',
      border: 'border-amber-200/50',
      link: '/inventory/materials',
      linkText: 'Manage →',
    },
    {
      title: 'Bottle Types',
      value: stats.bottles,
      icon: FlaskRound,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50/80',
      border: 'border-indigo-200/50',
      link: '/inventory/bottles',
      linkText: 'View →',
    },
    {
      title: 'Total Products',
      value: stats.products,
      icon: Sparkles,
      color: 'text-purple-600',
      bg: 'bg-purple-50/80',
      border: 'border-purple-200/50',
      link: '/products',
      linkText: 'Browse →',
    },
    {
      title: 'Total Sales',
      value: stats.salesCount,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50/80',
      border: 'border-blue-200/50',
      link: '/sales',
      linkText: 'View all →',
    },
    {
      title: 'Raw Mat. Stock Value',
      value: `৳${stats.rawMaterialStockValue.toFixed(2)}`,
      icon: Layers,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/80',
      border: 'border-emerald-200/50',
      link: '/inventory/materials',
      linkText: 'View stock →',
    },
    {
      title: 'Bottles Stock Value',
      value: `৳${stats.bottleStockValue.toFixed(2)}`,
      icon: Layers,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50/80',
      border: 'border-cyan-200/50',
      link: '/inventory/bottles',
      linkText: 'View stock →',
    },
  ];

  // --- Overall Summary (with Settlements) ---
  const overallSummary = [
    { 
      label: 'Total Revenue', 
      value: `৳${stats.totalRevenue.toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/50',
    },
    { 
      label: 'Total Expenses', 
      value: `৳${stats.totalExpenses.toFixed(2)}`, 
      icon: Wallet, 
      color: 'text-rose-600',
      bg: 'bg-rose-50/50',
    },
    { 
      label: 'Total Purchases', 
      value: `৳${stats.totalPurchases.toFixed(2)}`, 
      icon: ShoppingCart, 
      color: 'text-orange-600',
      bg: 'bg-orange-50/50',
    },
    { 
      label: 'Pending Payments', 
      value: `৳${stats.dueAmount.toFixed(2)}`, 
      icon: Clock, 
      color: 'text-yellow-600',
      bg: 'bg-yellow-50/50',
      badge: `${stats.dueCount} due`,
      link: '/sales?paymentStatus=due',
      linkText: 'View due →',
    },
    { 
      label: 'Available Cash', 
      value: `৳${stats.netProfit.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'text-indigo-600',
      bg: 'bg-indigo-50/50',
      link: '/investors',
      linkText: 'View Investors →',
    },
    { 
      label: 'Inventory Value', 
      value: `৳${stats.totalInventoryValue.toFixed(2)}`, 
      icon: Layers, 
      color: 'text-teal-600',
      bg: 'bg-teal-50/50',
    },
    { 
      label: 'Total Business Value', 
      value: `৳${(stats.netProfit + stats.totalInventoryValue).toFixed(2)}`, 
      icon: BarChart3, 
      color: 'text-amber-600',
      bg: 'bg-amber-50/50',
    },
    // 👇 NEW SETTLEMENTS CARD
    { 
      label: 'Settlements', 
      value: `৳${settlementsTotal.toFixed(2)}`, 
      icon: Wallet, 
      color: 'text-rose-600',
      bg: 'bg-rose-50/50',
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/5 via-purple-600/5 to-amber-600/5 border border-gray-200/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Welcome back, <span className="bg-gradient-to-r from-indigo-600 to-amber-600 bg-clip-text text-transparent">{user?.name || 'Admin'}</span>
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/sales/new"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 shadow-amber-500/25 text-sm font-medium"
            >
              <TrendingUp size={18} />
              <span>New Sale</span>
            </Link>
            <Link
              to="/expenses"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 shadow-rose-500/25 text-sm font-medium"
            >
              <Wallet size={18} />
              <span>Add Expense</span>
            </Link>
            <button
              onClick={() => navigate('/wastage/new')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 shadow-red-500/25 text-sm font-medium"
            >
              <Trash2 size={18} />
              <span>Record Wastage</span>
            </button>
            {/* Refresh Button */}
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition text-sm font-medium"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Main Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {mainCards.map((card, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl border ${card.border} hover:shadow-lg transition-all duration-300 hover:scale-[1.02] p-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <span className="text-xl font-bold text-gray-800">{card.value}</span>
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <Link
                  to={card.link}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 group"
                >
                  {card.linkText}
                  <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            ))}
          </div>

          {/* Overall Summary */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-500" />
              Financial Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4">
              {overallSummary.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-gray-200/60 hover:shadow-md transition-all duration-200 p-4 text-center relative"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <div className={`p-1.5 rounded-lg ${item.bg}`}>
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                      {item.label}
                    </p>
                  </div>
                  <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.link && (
                    <Link
                      to={item.link}
                      className="mt-1 text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      {item.linkText || 'View →'}
                      <ArrowUpRight size={10} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Two-Column: Recent Expenses & Recent Purchases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Expenses */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Wallet size={16} className="text-rose-500" />
                  Recent Expenses
                </h3>
                <Link to="/expenses" className="text-xs text-indigo-600 hover:underline">
                  View all →
                </Link>
              </div>
              {recentExpenses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent expenses</p>
              ) : (
                <div className="space-y-2">
                  {recentExpenses.map((exp) => (
                    <div key={exp._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                          <DollarSign size={14} className="text-rose-500" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-700 truncate">{exp.category}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {new Date(exp.date).toLocaleDateString()}
                            {exp.description && ` • ${exp.description}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-rose-600 whitespace-nowrap ml-2">৳{exp.amount?.toFixed(2) || '0.00'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Purchases */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-orange-500" />
                  Recent Purchases
                </h3>
                <Link to="/purchases" className="text-xs text-indigo-600 hover:underline">
                  View all →
                </Link>
              </div>
              {recentPurchases.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent purchases</p>
              ) : (
                <div className="space-y-2">
                  {recentPurchases.map((purchase) => (
                    <div key={purchase._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart size={14} className="text-orange-500" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-700 truncate">{purchase.invoiceNo}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {new Date(purchase.purchaseDate).toLocaleDateString()}
                            {purchase.supplier && ` • ${purchase.supplier}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-orange-600 whitespace-nowrap ml-2">৳{purchase.totalAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Two-Column: Sales by Product Type & Top Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Product Type */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" />
                Sales by Product Type (All Time)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 text-center border border-amber-200/50">
                  <Droplet className="w-8 h-8 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{salesTypeCounts.oil}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Oil Units</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 text-center border border-blue-200/50">
                  <SprayCan className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{salesTypeCounts.perfume}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Perfume Units</p>
                </div>
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Award size={16} className="text-amber-500" />
                Top Selling Products
              </h3>
              {topProducts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No sales data yet</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((item, index) => (
                    <div key={item.productId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-700 truncate">{item.productName}</p>
                          <p className="text-xs text-gray-400 truncate">SKU: {item.sku}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-sm font-semibold text-amber-600">{item.totalSold} units</p>
                        <p className="text-xs text-gray-500">৳{item.totalRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available Bottles Inventory Table */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FlaskRound size={18} className="text-cyan-500" />
              Available Bottles (Inventory)
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bottle</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bottles.map((bottle) => {
                      const totalPurchased = bottle.totalPurchased || 0;
                      const sold = bottle.sold || 0;
                      const available = Math.max(0, totalPurchased - sold);
                      const avgCost = parseFloat(bottle.avgCostPerUnit) || 0;
                      const totalValue = available * avgCost;
                      return (
                        <tr key={bottle._id} className="hover:bg-gray-50/70 transition">
                          <td className="px-4 sm:px-6 py-3 text-sm">{bottle.sizeMl} ml</td>
                          <td className="px-4 sm:px-6 py-3 capitalize text-sm">{bottle.type}</td>
                          <td className="px-4 sm:px-6 py-3 text-right font-medium text-sm">{totalPurchased}</td>
                          <td className="px-4 sm:px-6 py-3 text-right text-rose-600 text-sm">{sold}</td>
                          <td className="px-4 sm:px-6 py-3 text-right font-semibold text-emerald-600 text-sm">{available}</td>
                          <td className="px-4 sm:px-6 py-3 text-right text-sm">৳{avgCost.toFixed(2)}</td>
                          <td className="px-4 sm:px-6 py-3 text-right font-semibold text-cyan-600 text-sm">৳{totalValue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {bottles.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-gray-400">No bottles found</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50/50 font-semibold">
                    <tr>
                      <td colSpan="2" className="px-4 sm:px-6 py-3 text-right text-sm">Total</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm">
                        {bottles.reduce((sum, b) => sum + (b.totalPurchased || 0), 0)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm">
                        {bottles.reduce((sum, b) => sum + (b.sold || 0), 0)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm">
                        {bottles.reduce((sum, b) => sum + Math.max(0, (b.totalPurchased || 0) - (b.sold || 0)), 0)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm">-</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-cyan-600 text-sm">
                        ৳{bottles.reduce((sum, b) => sum + (Math.max(0, (b.totalPurchased || 0) - (b.sold || 0)) * (parseFloat(b.avgCostPerUnit) || 0)), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;