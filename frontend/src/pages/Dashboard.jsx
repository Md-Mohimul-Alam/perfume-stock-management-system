import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Package, FlaskRound, DollarSign, TrendingUp, ShoppingBag,
  Sparkles, Droplet, SprayCan, BarChart3, Wallet,
  Calendar, ArrowUpRight, Layers, ShoppingCart, Award,
  Clock, Trash2, RefreshCw, RotateCw, AlertCircle,
  PlusCircle, FileText, Users,
} from 'lucide-react';
import API from '../api/axios';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ✅ FIX: Import Recharts components
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

// ---------- Responsive styles ----------
const responsiveStyles = `
  @media (min-width: 1920px) {
    .dashboard-container { max-width: 1800px; padding: 2rem 2.5rem; }
  }
  @media (min-width: 2560px) {
    .dashboard-container { max-width: 2000px; padding: 2.5rem 3.5rem; }
    .stat-card { padding: 1.5rem !important; }
    .stat-value { font-size: 1.75rem !important; }
  }
  .skeleton { background: #f0f0f0; border-radius: 0.5rem; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
  .badge-pulse { animation: blink 1.2s infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
`;

// ---------- Recent Activity Component ----------
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

  if (!activities || activities.length === 0) {
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
          {item.amount !== undefined && (
            <span className="text-sm font-semibold whitespace-nowrap ml-2">
              {item.amount > 0 ? '+' : ''}৳{item.amount.toFixed(2)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};

// ---------- Main Dashboard Component ----------
const Dashboard = () => {
  const { user } = useAuth();
  const { setNotifications } = useNotifications();
  const navigate = useNavigate();
  const dashboardRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
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
  const [materials, setMaterials] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [lowStockItems, setLowStockItems] = useState({ materials: [], bottles: [] });
  const [chartData, setChartData] = useState([]);
  const [dueSales, setDueSales] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // ---------- Build notifications ----------
  const buildNotifications = (lowMat, lowBot, dueSalesList) => {
    const notifs = [];
    lowMat.forEach(m => {
      notifs.push({
        type: 'warning',
        message: `Material "${m.name}" low (${m.currentStockMl} ml)`,
        link: '/inventory/materials',
        time: 'Just now',
        read: false,
      });
    });
    lowBot.forEach(b => {
      notifs.push({
        type: 'warning',
        message: `Bottle ${b.sizeMl}ml (${b.type}) low (${b.currentStock} pcs)`,
        link: '/inventory/bottles',
        time: 'Just now',
        read: false,
      });
    });
    dueSalesList.forEach(s => {
      notifs.push({
        type: 'due',
        message: `Due payment ৳${s.totalAmount.toFixed(2)} - ${s.invoiceNo}`,
        link: `/sales/${s._id}`,
        time: 'Pending',
        read: false,
      });
    });
    return notifs;
  };

  // ---------- Fetch data ----------
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
        settlementsRes,
      ] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles/with-sales'),
        API.get('/products'),
        API.get('/sales'),
        API.get('/expenses'),
        API.get('/purchases'),
        API.get('/reports/available-cash'),
        API.get('/investors/settlements'),
      ]);

      // ✅ Defensive: ensure all are arrays
      const allSales = Array.isArray(salesRes?.data) ? salesRes.data : [];
      const allExpenses = Array.isArray(expensesRes?.data) ? expensesRes.data : [];
      const allPurchases = Array.isArray(purchasesRes?.data) ? purchasesRes.data : [];
      const products = Array.isArray(productsRes?.data) ? productsRes.data : [];
      const materialsData = Array.isArray(materialsRes?.data) ? materialsRes.data : [];
      const bottleData = Array.isArray(bottlesWithSalesRes?.data) ? bottlesWithSalesRes.data : [];

      setMaterials(materialsData);
      setBottles(bottleData);
      setSettlementsTotal(settlementsRes.data?.total || 0);

      // Low stock alerts
      const lowMat = materialsData.filter(m => (m.currentStockMl || 0) < 100);
      const lowBot = bottleData.filter(b => (b.currentStock || 0) < 10);
      setLowStockItems({ materials: lowMat, bottles: lowBot });

      // Due sales
      const dueSalesList = allSales.filter(s => s.paymentStatus === 'due');
      setDueSales(dueSalesList);
      const dueCount = dueSalesList.length;
      const dueAmount = dueSalesList.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);

      // Build notifications and update context
      const notifs = buildNotifications(lowMat, lowBot, dueSalesList);
      setNotifications(notifs);

      const totalRevenue = allSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);
      const totalExpenses = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const totalPurchases = allPurchases.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);

      let rawMaterialStockValue = 0;
      materialsData.forEach(m => {
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

      // Recent 5 sales
      const recentSalesData = [...allSales]
        .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
        .slice(0, 5);
      setRecentSales(recentSalesData);

      const recentPur = [...allPurchases]
        .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
        .slice(0, 5);
      setRecentPurchases(recentPur);

      // Build recent activities (combine sales, purchases, expenses, wastage)
      const activities = [];
      allSales.slice(0, 5).forEach(s => {
        activities.push({
          type: 'sale',
          id: s._id,
          title: `Sale ${s.invoiceNo} - ${s.channel}`,
          time: new Date(s.saleDate).toLocaleDateString(),
          amount: s.totalAmount,
        });
      });
      allPurchases.slice(0, 5).forEach(p => {
        activities.push({
          type: 'purchase',
          id: p._id,
          title: `Purchase ${p.invoiceNo}${p.supplier ? ' - ' + p.supplier : ''}`,
          time: new Date(p.purchaseDate).toLocaleDateString(),
          amount: p.totalAmount,
        });
      });
      allExpenses.slice(0, 5).forEach(e => {
        activities.push({
          type: 'expense',
          id: e._id,
          title: `Expense - ${e.category}${e.description ? ': ' + e.description : ''}`,
          time: new Date(e.date).toLocaleDateString(),
          amount: e.amount,
        });
      });
      // Sort by time (most recent first)
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      setRecentActivities(activities);

      setStats({
        materials: materialsData.length,
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

      // Chart data (last 30 days)
      const days = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = 0;
      }
      allSales.forEach(sale => {
        const dateKey = new Date(sale.saleDate).toISOString().split('T')[0];
        if (days[dateKey] !== undefined) {
          days[dateKey] += sale.totalAmount || 0;
        }
      });
      const chartArray = Object.entries(days).map(([date, revenue]) => ({ date, revenue }));
      setChartData(chartArray);

    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Rebuild stock ----------
  const handleRebuild = async () => {
    if (user?.role !== 'admin') {
      toast.error('Only admins can rebuild stock');
      return;
    }
    if (!window.confirm('Rebuild stock from purchases and sales? This will recalculate all stock levels.')) return;
    setRebuilding(true);
    try {
      const response = await API.post('/admin/rebuild-stock');
      toast.success(response.data.message || 'Stock rebuilt successfully');
      await fetchDashboardData();
    } catch (error) {
      console.error('Rebuild error:', error);
      toast.error(error.response?.data?.message || 'Failed to rebuild stock');
    } finally {
      setRebuilding(false);
    }
  };

  // ---------- Export PDF ----------
  const exportDashboardPDF = async () => {
    const element = document.getElementById('dashboard-content');
    if (!element) return;
    toast.loading('Generating PDF...', { id: 'pdf-export' });
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save('dashboard-report.pdf');
      toast.success('PDF exported successfully!', { id: 'pdf-export' });
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate PDF', { id: 'pdf-export' });
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ---------- Memoized cards ----------
  const mainCards = useMemo(() => [
    { title: 'Raw Materials', value: stats.materials, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50/80', border: 'border-amber-200/50', link: '/inventory/materials', linkText: 'Manage →' },
    { title: 'Bottle Types', value: stats.bottles, icon: FlaskRound, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-200/50', link: '/inventory/bottles', linkText: 'View →' },
    { title: 'Total Products', value: stats.products, icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50/80', border: 'border-purple-200/50', link: '/products', linkText: 'Browse →' },
    { title: 'Total Sales', value: stats.salesCount, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50/80', border: 'border-blue-200/50', link: '/sales', linkText: 'View all →' },
    { title: 'Raw Mat. Stock Value', value: `৳${stats.rawMaterialStockValue.toFixed(2)}`, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-200/50', link: '/inventory/materials', linkText: 'View stock →' },
    { title: 'Bottles Stock Value', value: `৳${stats.bottleStockValue.toFixed(2)}`, icon: Layers, color: 'text-cyan-600', bg: 'bg-cyan-50/80', border: 'border-cyan-200/50', link: '/inventory/bottles', linkText: 'View stock →' },
  ], [stats]);

  const overallSummary = useMemo(() => [
    { label: 'Revenue', value: `৳${stats.totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
    { label: 'Expenses', value: `৳${stats.totalExpenses.toFixed(2)}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50/50' },
    { label: 'Purchases', value: `৳${stats.totalPurchases.toFixed(2)}`, icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50/50' },
    { label: 'Due Payments', value: `৳${stats.dueAmount.toFixed(2)}`, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50/50', badge: `${stats.dueCount} due`, link: '/sales?paymentStatus=due', linkText: 'View due →' },
    { label: 'Available Cash', value: `৳${stats.netProfit.toFixed(2)}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50/50', link: '/investors', linkText: 'View Investors →' },
    { label: 'Inventory Value', value: `৳${stats.totalInventoryValue.toFixed(2)}`, icon: Layers, color: 'text-teal-600', bg: 'bg-teal-50/50' },
    { label: 'Business Value', value: `৳${(stats.netProfit + stats.totalInventoryValue).toFixed(2)}`, icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50/50' },
    { label: 'Settlements', value: `৳${settlementsTotal.toFixed(2)}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50/50' },
  ], [stats, settlementsTotal]);

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 skeleton h-28" />
  );

  // ---------- Render ----------
  return (
    <>
      <style>{responsiveStyles}</style>
      <div id="dashboard-content" className="dashboard-container p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200/60 shadow-lg p-4 sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-amber-500/5" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                Welcome back, <span className="bg-gradient-to-r from-indigo-600 to-amber-600 bg-clip-text text-transparent">{user?.name || 'Admin'}</span>
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-400" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportDashboardPDF}
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition text-sm font-medium"
              >
                <FileText size={18} /> Export PDF
              </button>
              <button onClick={fetchDashboardData} className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition text-sm font-medium">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              {user?.role === 'admin' && (
                <button onClick={handleRebuild} disabled={rebuilding} className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition disabled:opacity-60 text-sm font-medium">
                  <RotateCw size={18} className={rebuilding ? 'animate-spin' : ''} />
                  {rebuilding ? 'Rebuilding...' : 'Rebuild Stock'}
                </button>
              )}
            </div>
          </div>

          {/* Low Stock Alert */}
          {(lowStockItems.materials.length > 0 || lowStockItems.bottles.length > 0) && (
            <div className="relative mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 text-sm">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-800">Low stock alert:</span>
                {lowStockItems.materials.length > 0 && (
                  <span className="ml-2">{lowStockItems.materials.length} material(s) low</span>
                )}
                {lowStockItems.bottles.length > 0 && (
                  <span className="ml-2">{lowStockItems.bottles.length} bottle type(s) low</span>
                )}
                <Link to="/inventory" className="ml-3 text-amber-700 underline hover:text-amber-900">View inventory</Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Link to="/sales/new" className="bg-indigo-50 hover:bg-indigo-100 rounded-xl p-3 text-center transition border border-indigo-200/50 group">
            <PlusCircle size={24} className="mx-auto text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">New Sale</span>
          </Link>
          <Link to="/expenses" className="bg-rose-50 hover:bg-rose-100 rounded-xl p-3 text-center transition border border-rose-200/50 group">
            <Wallet size={24} className="mx-auto text-rose-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">Add Expense</span>
          </Link>
          <button onClick={() => navigate('/wastage/new')} className="bg-red-50 hover:bg-red-100 rounded-xl p-3 text-center transition border border-red-200/50 group">
            <Trash2 size={24} className="mx-auto text-red-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">Wastage</span>
          </button>
          <Link to="/purchases/new" className="bg-orange-50 hover:bg-orange-100 rounded-xl p-3 text-center transition border border-orange-200/50 group">
            <ShoppingCart size={24} className="mx-auto text-orange-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">New Purchase</span>
          </Link>
          <Link to="/investors" className="bg-teal-50 hover:bg-teal-100 rounded-xl p-3 text-center transition border border-teal-200/50 group">
            <Users size={24} className="mx-auto text-teal-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">Investors</span>
          </Link>
          <Link to="/reports" className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 text-center transition border border-gray-200/50 group">
            <FileText size={24} className="mx-auto text-gray-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-gray-700 block mt-1">Reports</span>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5 xl:gap-6">
              {mainCards.map((card, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border ${card.border} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-3 sm:p-4 lg:p-5 xl:p-6 stat-card flex flex-col h-full min-w-0 min-h-[110px] sm:min-h-[120px]`}
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                    <div className={`p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-xl ${card.bg} flex-shrink-0`}>
                      <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 ${card.color}`} />
                    </div>
                    <span
                      className="text-sm sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-bold text-gray-800 stat-value truncate text-right min-w-0 max-w-full overflow-hidden text-ellipsis"
                      title={typeof card.value === 'string' ? card.value : card.value?.toString() || ''}
                    >
                      {card.value}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider truncate">
                    {card.title}
                  </p>
                  <Link
                    to={card.link}
                    className="mt-auto pt-1.5 sm:pt-2 text-[10px] sm:text-xs lg:text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 group font-medium min-h-[28px]"
                  >
                    {card.linkText}
                    <ArrowUpRight
                      size={12}
                      className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    />
                  </Link>
                </div>
              ))}
            </div>

            {/* Overall Summary */}
            <div>
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-500" />
                Financial Snapshot
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
                {overallSummary.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-200/60 hover:shadow-md transition-all duration-200 p-3 sm:p-4 text-center relative hover:-translate-y-1">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={`p-1.5 rounded-lg ${item.bg}`}>
                        <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{item.label}</p>
                    </div>
                    <p className={`text-sm sm:text-base font-bold ${item.color}`}>{item.value}</p>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full badge-pulse">
                        {item.badge}
                      </span>
                    )}
                    {item.link && (
                      <Link to={item.link} className="mt-1 text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1">
                        {item.linkText || 'View →'}
                        <ArrowUpRight size={10} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Profit Margin</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.totalRevenue > 0 ? ((stats.totalRevenue - stats.totalExpenses - stats.totalPurchases) / stats.totalRevenue * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-400">of revenue</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Inventory Turnover</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.totalInventoryValue > 0 ? (stats.totalPurchases / stats.totalInventoryValue).toFixed(1) : 0}x
                </p>
                <p className="text-xs text-gray-400">purchases ÷ inventory</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Cash Conversion</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalRevenue > 0 ? (stats.dueAmount / stats.totalRevenue * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-400">due payments</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Avg. Sale Value</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.salesCount > 0 ? (stats.totalRevenue / stats.salesCount).toFixed(2) : 0}
                </p>
                <p className="text-xs text-gray-400">per transaction</p>
              </div>
            </div>

            {/* Chart & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-500" />
                  Revenue Trend (Last 30 Days)
                </h3>
                {chartData.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No revenue data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(val) => `৳${val}`} />
                      <Tooltip formatter={(val) => `৳${val.toFixed(2)}`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-200 font-semibold flex items-center gap-2">
                    <Clock size={18} className="text-gray-500" />
                    Recent Activity
                  </div>
                  <div className="p-2">
                    <RecentActivity activities={recentActivities} />
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column: Recent Sales & Recent Purchases */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-blue-500" />
                    Recent Sales
                  </h3>
                  <Link to="/sales" className="text-xs text-indigo-600 hover:underline">View all →</Link>
                </div>
                {recentSales.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No recent sales</p>
                ) : (
                  <div className="space-y-2">
                    {recentSales.map((sale) => (
                      <div key={sale._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <DollarSign size={14} className="text-blue-500" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium text-gray-700 truncate">Invoice #{sale.invoiceNo}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {new Date(sale.saleDate).toLocaleDateString()}
                              {sale.customer && ` • ${sale.customer}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-blue-600 whitespace-nowrap ml-2">৳{sale.totalAmount?.toFixed(2) || '0.00'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ShoppingCart size={16} className="text-orange-500" />
                    Recent Purchases
                  </h3>
                  <Link to="/purchases" className="text-xs text-indigo-600 hover:underline">View all →</Link>
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

            {/* Sales by Type & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-500" />
                  Sales by Product Type
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

              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5">
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

            {/* Bottles Inventory Table */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FlaskRound size={18} className="text-cyan-500" />
                Available Bottles (Inventory)
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50 sticky top-0">
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
    </>
  );
};

export default Dashboard;