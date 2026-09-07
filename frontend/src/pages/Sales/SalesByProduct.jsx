import { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Loader2,
  RefreshCw,
  Droplet,
  SprayCan,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';

const SalesByProduct = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [salesData, setSalesData] = useState({}); // productId -> { name, sku, type, sizes: {}, totalUnits, totalRevenue }
  const [selectedProduct, setSelectedProduct] = useState('');
  const [allSizes, setAllSizes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [productsRes, salesRes] = await Promise.all([
        API.get('/products'),
        API.get('/sales'),
      ]);

      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : [];

      setProducts(products);

      // Initialize data structure for all products
      const data = {};
      products.forEach(p => {
        data[p._id] = {
          name: p.name,
          sku: p.sku,
          type: p.type,
          sizes: {},
          totalUnits: 0,
          totalRevenue: 0,
        };
      });

      const sizeSet = new Set();

      // Process sales
      sales.forEach(sale => {
        if (!sale.items) return;
        sale.items.forEach(item => {
          const productId = item.product?._id || item.product;
          if (!productId) return;

          const product = products.find(p => p._id === productId);
          if (!product) return;

          const size = item.sizeMl || 0;
          const qty = item.quantity || 0;
          const unitPrice = item.unitPrice || 0;
          if (size === 0 || qty === 0) return;

          sizeSet.add(size);

          if (!data[productId]) return;

          if (!data[productId].sizes[size]) {
            data[productId].sizes[size] = { units: 0, revenue: 0 };
          }
          data[productId].sizes[size].units += qty;
          data[productId].sizes[size].revenue += qty * unitPrice;
          data[productId].totalUnits += qty;
          data[productId].totalRevenue += qty * unitPrice;
        });
      });

      setSalesData(data);
      setAllSizes(Array.from(sizeSet).sort((a, b) => a - b));
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Prepare chart data for selected product
  const prepareChartData = (productId) => {
    const product = salesData[productId];
    if (!product) return [];
    return allSizes.map(size => {
      const data = product.sizes[size] || { units: 0, revenue: 0 };
      return {
        size: `${size}ml`,
        units: data.units,
        revenue: data.revenue,
      };
    });
  };

  const selectedProductData = selectedProduct ? salesData[selectedProduct] : null;
  const chartData = selectedProduct ? prepareChartData(selectedProduct) : [];

  const formatCurrency = (amount) => `৳${(amount || 0).toFixed(2)}`;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales by Product</h1>
          <p className="text-gray-500 text-sm">Units sold and revenue per product, broken down by size</p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Products</p>
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Units Sold</p>
          <p className="text-2xl font-bold text-gray-800">
            {Object.values(salesData).reduce((sum, p) => sum + p.totalUnits, 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(Object.values(salesData).reduce((sum, p) => sum + p.totalRevenue, 0))}
          </p>
        </div>
      </div>

      {/* Product Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
        >
          <option value="">-- All Products (Table Below) --</option>
          {products.map(p => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-gray-500">Loading data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Selected Product Chart & Table */}
          {selectedProduct && selectedProductData && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                {selectedProductData.name} ({selectedProductData.sku})
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  selectedProductData.type === 'roll-on' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedProductData.type}
                </span>
              </h2>

              {/* Chart */}
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="units" name="Units Sold" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue (৳)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                    {allSizes.map(size => {
                      const data = selectedProductData.sizes[size] || { units: 0, revenue: 0 };
                      return (
                        <tr key={size} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{size}</td>
                          <td className="px-4 py-2 text-sm text-right font-semibold">{data.units}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(data.revenue)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">Total</td>
                      <td className="px-4 py-2 text-sm text-right">{selectedProductData.totalUnits}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(selectedProductData.totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Products Accordion/Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-700">All Products Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Units</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Expand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map(product => {
                    const data = salesData[product._id];
                    if (!data) return null;
                    return (
                      <ProductRow
                        key={product._id}
                        product={data}
                        allSizes={allSizes}
                        onExpand={() => setSelectedProduct(product._id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper component: ProductRow with expandable details
const ProductRow = ({ product, allSizes, onExpand }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    setExpanded(!expanded);
    if (!expanded) onExpand();
  };

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={toggle}>
        <td className="px-4 py-2 text-sm font-medium">{product.name} ({product.sku})</td>
        <td className="px-4 py-2 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            product.type === 'roll-on' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {product.type}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-right">{product.totalUnits}</td>
        <td className="px-4 py-2 text-sm text-right font-semibold text-emerald-600">৳{product.totalRevenue.toFixed(2)}</td>
        <td className="px-4 py-2 text-center">
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan="5" className="px-4 py-2">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                    <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 uppercase">Units</th>
                    <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allSizes.map(size => {
                    const d = product.sizes[size] || { units: 0, revenue: 0 };
                    return (
                      <tr key={size}>
                        <td className="px-3 py-1">{size}</td>
                        <td className="px-3 py-1 text-right">{d.units}</td>
                        <td className="px-3 py-1 text-right">৳{d.revenue.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="px-3 py-1">Total</td>
                    <td className="px-3 py-1 text-right">{product.totalUnits}</td>
                    <td className="px-3 py-1 text-right">৳{product.totalRevenue.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default SalesByProduct;