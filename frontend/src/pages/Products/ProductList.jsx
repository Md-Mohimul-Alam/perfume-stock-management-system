import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import {
  Plus, Search, Eye, Edit, Trash2,
  X, CheckCircle, AlertCircle, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterIntensity, setFilterIntensity] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/products');
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await API.delete(`/products/${productToDelete._id}`);
      toast.success('Product deactivated');
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesIntensity = filterIntensity === 'all' || p.intensity === filterIntensity;
    return matchesSearch && matchesType && matchesIntensity;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <p className="text-gray-500 text-sm">Manage your product catalog</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/products/new"
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30"
          >
            <Plus size={18} /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="all">All Types</option>
            <option value="spray">Spray</option>
            <option value="roll-on">Roll‑on</option>
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Intensity</label>
          <select
            value={filterIntensity}
            onChange={(e) => setFilterIntensity(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="all">All</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </div>

        <button
          onClick={() => { setSearch(''); setFilterType('all'); setFilterIntensity('all'); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading products...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intensity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best For</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bestseller</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-400">No products found</td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600">{p.sku}</td>
                    <td className="px-6 py-4 capitalize">{p.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{p.description || '-'}</td>
                    <td className="px-6 py-4 capitalize">{p.intensity || 'medium'}</td>
                    <td className="px-6 py-4 text-sm">{p.bestFor?.join(', ') || 'all'}</td>
                    <td className="px-6 py-4 text-sm">{p.notes?.join(', ') || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      {p.isBestseller ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">★</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => navigate(`/products/edit/${p._id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setProductToDelete(p);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Deactivate"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Deactivate Product</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to deactivate <strong>{productToDelete.name}</strong>?
              <br />
              <span className="text-sm text-gray-500">This will hide it from the storefront.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Deactivate
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;