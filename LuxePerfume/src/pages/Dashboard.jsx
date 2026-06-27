import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  FlaskRound, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Sparkles 
} from 'lucide-react';
import API from '../api/axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    materials: 0,
    bottles: 0,
    products: 0,
    salesToday: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [materialsRes, bottlesRes, productsRes, salesRes] = await Promise.all([
          API.get('/inventory/materials'),
          API.get('/inventory/bottles'),
          API.get('/products'),
          API.get('/sales?startDate=' + new Date().toISOString().split('T')[0]), // today's sales
        ]);

        const todaySales = salesRes.data || [];
        const totalRevenue = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

        setStats({
          materials: materialsRes.data.length,
          bottles: bottlesRes.data.length,
          products: productsRes.data.length,
          salesToday: todaySales.length,
          totalRevenue,
        });
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: 'Raw Materials',
      value: stats.materials,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      link: '/inventory/materials',
      linkText: 'Manage inventory →',
    },
    {
      title: 'Bottle Types',
      value: stats.bottles,
      icon: FlaskRound,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      link: '/inventory/bottles',
      linkText: 'View bottles →',
    },
    {
      title: 'Total Products',
      value: stats.products,
      icon: Sparkles,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      link: '/products',
      linkText: 'Browse products →',
    },
    {
      title: "Today's Sales",
      value: stats.salesToday,
      icon: ShoppingBag,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      link: '/sales',
      linkText: 'View sales →',
    },
    {
      title: "Today's Revenue",
      value: `৳${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      link: '/reports',
      linkText: 'View reports →',
    },
  ];

  return (
    <div>
      {/* Header with welcome */}
      <div className="flex flex-wrap items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif text-brand-dark">
            Welcome back, <span className="text-brand-primary">{user?.name || 'Admin'}</span>
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <Link
          to="/sales/new"
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition shadow-amber-500/30 flex items-center gap-2"
        >
          <TrendingUp size={18} />
          New Sale
        </Link>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-brand-muted">Loading dashboard...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl shadow-card border border-gray-100 hover:shadow-luxe transition-shadow p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <span className="text-2xl font-bold text-brand-dark">{card.value}</span>
              </div>
              <h3 className="text-sm font-medium text-brand-muted uppercase tracking-wider">
                {card.title}
              </h3>
              <Link
                to={card.link}
                className="mt-4 text-sm font-medium text-brand-primary hover:underline inline-flex items-center gap-1"
              >
                {card.linkText}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;