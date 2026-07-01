import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  ArrowDownRight,
  Clock,
  ShoppingCart,
  Layers,
} from 'lucide-react';
import API from '../api/axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
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
  });
  const [salesTypeCounts, setSalesTypeCounts] = useState({ oil: 0, perfume: 0 });
  const [bottleSales, setBottleSales] = useState([]);
  const [bottles, setBottles] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        let materialsRes, bottlesRes, productsRes, salesRes, expensesRes, purchasesRes;
        try {
          [materialsRes, bottlesRes, productsRes, salesRes, expensesRes, purchasesRes] = await Promise.all([
            API.get('/inventory/materials'),
            API.get('/inventory/bottles'),
            API.get('/products'),
            API.get('/sales'),
            API.get('/expenses'),
            API.get('/purchases'),
          ]);
        } catch (apiError) {
          toast.error('Failed to load dashboard data. Please refresh.');
          console.error('API Error:', apiError);
          setLoading(false);
          return;
        }

        const allSales = salesRes?.data || [];
        const allExpenses = expensesRes?.data || [];
        const allPurchases = purchasesRes?.data || [];
        const products = productsRes?.data || [];
        const materials = materialsRes?.data || [];
        const bottleData = bottlesRes?.data || [];
        setBottles(bottleData);

        // --- All-time totals (robust parsing) ---
        const totalRevenue = allSales.reduce((sum, s) => {
          const amount = parseFloat(s.totalAmount) || 0;
          return sum + amount;
        }, 0);

        const totalExpenses = allExpenses.reduce((sum, e) => {
          const amount = parseFloat(e.amount) || 0;
          return sum + amount;
        }, 0);

        const totalPurchases = allPurchases.reduce((sum, p) => {
          const amount = parseFloat(p.totalAmount) || 0;
          return sum + amount;
        }, 0);

        // --- Raw Material Stock Value ---
        let rawMaterialStockValue = 0;
        materials.forEach(m => {
          const stock = parseFloat(m.currentStockMl) || 0;
          const avgCost = parseFloat(m.avgCostPerMl) || 0;
          rawMaterialStockValue += stock * avgCost;
        });

        // --- Bottle Stock Value ---
        let bottleStockValue = 0;
        bottleData.forEach(b => {
          const stock = parseFloat(b.currentStock) || 0;
          const avgCost = parseFloat(b.avgCostPerUnit) || 0;
          bottleStockValue += stock * avgCost;
        });

        const totalInventoryValue = rawMaterialStockValue + bottleStockValue;

        // --- Sales by product type ---
        let oilSold = 0;
        let perfumeSold = 0;
        const salesByBottle = {};

        for (const sale of allSales) {
          if (!sale.items || !sale.items.length) continue;
          for (const item of sale.items) {
            const product = item.product;
            if (!product) continue;
            if (product.type === 'roll-on') oilSold += (item.quantity || 0);
            else if (product.type === 'spray') perfumeSold += (item.quantity || 0);

            const key = `${item.sizeMl}-${product.type}`;
            if (!salesByBottle[key]) {
              salesByBottle[key] = { 
                size: item.sizeMl, 
                type: product.type, 
                totalSold: 0 
              };
            }
            salesByBottle[key].totalSold += (item.quantity || 0);
          }
        }

        const sortedBottleSales = Object.values(salesByBottle)
          .sort((a, b) => b.totalSold - a.totalSold)
          .slice(0, 10);

        // --- Recent expenses & purchases (last 5) ---
        const recentExp = [...allExpenses]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        const recentPur = [...allPurchases]
          .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
          .slice(0, 5);

        // --- Update state ---
        setStats({
          materials: materials.length,
          bottles: bottleData.length,
          products: products.length,
          salesCount: allSales.length,
          totalRevenue,
          totalExpenses,
          totalPurchases,
          netProfit: totalRevenue - totalExpenses - totalPurchases - (10600 + 246 + 127),
          rawMaterialStockValue,
          bottleStockValue,
          totalInventoryValue,
        });
        setSalesTypeCounts({ oil: oilSold, perfume: perfumeSold });
        setBottleSales(sortedBottleSales);
        setRecentExpenses(recentExp);
        setRecentPurchases(recentPur);
      } catch (error) {
        toast.error('Failed to load dashboard');
        console.error('Dashboard error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // --- Main stats cards (6 cards) ---
  const mainCards = [
    {
      title: 'Raw Materials',
      value: stats.materials,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      link: '/inventory/materials',
      linkText: 'Manage →',
    },
    {
      title: 'Bottle Types',
      value: stats.bottles,
      icon: FlaskRound,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      link: '/inventory/bottles',
      linkText: 'View →',
    },
    {
      title: 'Total Products',
      value: stats.products,
      icon: Sparkles,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      link: '/products',
      linkText: 'Browse →',
    },
    {
      title: 'Total Sales',
      value: stats.salesCount,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      link: '/sales',
      linkText: 'View all →',
    },
    {
      title: 'Raw Materials Stock Value',
      value: `৳${stats.rawMaterialStockValue.toFixed(2)}`,
      icon: Layers,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      link: '/inventory/materials',
      linkText: 'View stock →',
    },
    {
      title: 'Bottles Stock Value',
      value: `৳${stats.bottleStockValue.toFixed(2)}`,
      icon: Layers,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      border: 'border-cyan-200',
      link: '/inventory/bottles',
      linkText: 'View stock →',
    },
  ];

  // --- Overall Summary (all-time) with link to Investors ---
  const overallSummary = [
    { 
      label: 'Total Revenue', 
      value: `৳${stats.totalRevenue.toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'text-emerald-600' 
    },
    { 
      label: 'Total Expenses', 
      value: `৳${stats.totalExpenses.toFixed(2)}`, 
      icon: Wallet, 
      color: 'text-rose-600' 
    },
    { 
      label: 'Total Purchases', 
      value: `৳${stats.totalPurchases.toFixed(2)}`, 
      icon: ShoppingCart, 
      color: 'text-orange-600' 
    },
    { 
      label: 'Available Cash', 
      value: `৳${stats.netProfit.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'text-indigo-600',
      link: '/investors',
      linkText: 'Distribute →',
    },
    { 
      label: 'Total Inventory Value', 
      value: `৳${stats.totalInventoryValue.toFixed(2)}`, 
      icon: Layers, 
      color: 'text-teal-600' 
    },
    { 
      label: 'Total Business Value', 
      value: `৳${(stats.netProfit + stats.totalInventoryValue).toFixed(2)}`, 
      icon: BarChart3, 
      color: 'text-amber-600' 
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome back, <span className="text-amber-600">{user?.name || 'Admin'}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <Calendar size={16} />
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/sales/new"
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition shadow-amber-500/30 flex items-center gap-2"
          >
            <TrendingUp size={18} />
            New Sale
          </Link>
          <Link
            to="/expenses"
            className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition shadow-rose-500/30 flex items-center gap-2"
          >
            <Wallet size={18} />
            Add Expense
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Main Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {mainCards.map((card, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl shadow-sm border ${card.border} hover:shadow-md transition-shadow p-4`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`p-2 rounded-xl ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <span className="text-lg font-bold text-gray-800">{card.value}</span>
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <Link
                  to={card.link}
                  className="mt-1 text-xs text-amber-600 hover:underline inline-flex items-center gap-1"
                >
                  {card.linkText}
                  <ArrowUpRight size={10} />
                </Link>
              </div>
            ))}
          </div>

          {/* Overall Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-amber-600" />
              Overall Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {overallSummary.map((item, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      {item.label}
                    </p>
                  </div>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                  {item.link && (
                    <Link
                      to={item.link}
                      className="mt-1 text-xs text-amber-600 hover:underline inline-flex items-center gap-1"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Recent Expenses */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Wallet size={16} className="text-rose-600" />
                  Recent Expenses
                </h3>
                <Link to="/expenses" className="text-xs text-amber-600 hover:underline">
                  View all →
                </Link>
              </div>
              {recentExpenses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent expenses</p>
              ) : (
                <div className="space-y-2">
                  {recentExpenses.map((exp) => (
                    <div key={exp._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                          <DollarSign size={14} className="text-rose-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{exp.category}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(exp.date).toLocaleDateString()}
                            {exp.description && ` • ${exp.description}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-rose-600">৳{exp.amount?.toFixed(2) || '0.00'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Purchases */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-orange-600" />
                  Recent Purchases
                </h3>
                <Link to="/purchases" className="text-xs text-amber-600 hover:underline">
                  View all →
                </Link>
              </div>
              {recentPurchases.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent purchases</p>
              ) : (
                <div className="space-y-2">
                  {recentPurchases.map((purchase) => (
                    <div key={purchase._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                          <ShoppingCart size={14} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{purchase.invoiceNo}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(purchase.purchaseDate).toLocaleDateString()}
                            {purchase.supplier && ` • ${purchase.supplier}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-orange-600">৳{purchase.totalAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Two-Column: Sales by Product Type & Top Selling Bottles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-amber-600" />
                Sales by Product Type (All Time)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                  <Droplet className="w-8 h-8 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{salesTypeCounts.oil}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Oil Units</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                  <SprayCan className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{salesTypeCounts.perfume}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Perfume Units</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FlaskRound size={16} className="text-amber-600" />
                Top Selling Bottles (All Time)
              </h3>
              {bottleSales.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No sales data yet</p>
              ) : (
                <div className="space-y-2">
                  {bottleSales.slice(0, 5).map((item) => (
                    <div key={`${item.size}-${item.type}`} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{item.size} ml</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.type === 'roll-on' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.type === 'roll-on' ? 'Oil' : 'Perfume'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-amber-600">{item.totalSold} units</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ✅ UPDATED: Available Bottles (Inventory) with Total Stock & Sold */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FlaskRound size={18} className="text-cyan-600" />
              Available Bottles (Inventory)
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bottle Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stock</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Available Stock</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost (৳)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bottles.map((bottle) => {
                      const avgCost = parseFloat(bottle.avgCostPerUnit) || 0;
                      const totalPurchased = bottle.totalPurchased || 0;
                      const available = parseInt(bottle.currentStock) || 0;
                      const sold = totalPurchased - available;
                      const totalValue = available * avgCost;
                      return (
                        <tr key={bottle._id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">{bottle.sizeMl} ml</td>
                          <td className="px-6 py-4 capitalize">{bottle.type}</td>
                          <td className="px-6 py-4 text-right font-medium">{totalPurchased}</td>
                          <td className="px-6 py-4 text-right text-rose-600">{sold}</td>
                          <td className="px-6 py-4 text-right font-semibold text-green-600">{available}</td>
                          <td className="px-6 py-4 text-right">৳{avgCost.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-cyan-600">
                            ৳{totalValue.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {bottles.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-gray-400">No bottles found</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan="2" className="px-6 py-3 text-right">Total</td>
                      <td className="px-6 py-3 text-right">
                        {bottles.reduce((sum, b) => sum + (b.totalPurchased || 0), 0)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {bottles.reduce((sum, b) => sum + ((b.totalPurchased || 0) - (b.currentStock || 0)), 0)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {bottles.reduce((sum, b) => sum + (parseInt(b.currentStock) || 0), 0)}
                      </td>
                      <td className="px-6 py-3 text-right">-</td>
                      <td className="px-6 py-3 text-right text-cyan-600">
                        ৳{bottles.reduce((sum, b) => sum + ((parseInt(b.currentStock) || 0) * (parseFloat(b.avgCostPerUnit) || 0)), 0).toFixed(2)}
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