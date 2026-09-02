import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { Calendar, Search, Trash2, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';

const WastageList = () => {
  const [wastages, setWastages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedWastage, setSelectedWastage] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchWastages();
  }, []);

  const fetchWastages = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/expenses');
      // Filter by category 'Wastage'
      const wastageData = data.filter(e => e.category === 'Wastage');
      setWastages(wastageData);
    } catch (error) {
      toast.error('Failed to load wastage records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this wastage record? This action cannot be undone.')) return;
    try {
      await API.delete(`/expenses/${id}`);
      toast.success('Wastage deleted');
      fetchWastages();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  // Filtering
  const filtered = wastages.filter(w => {
    const matchesSearch = w.description?.toLowerCase().includes(search.toLowerCase()) ||
                          w.reference?.toLowerCase().includes(search.toLowerCase());
    const matchesDate = dateRange.start && dateRange.end ?
      new Date(w.date) >= new Date(dateRange.start) && new Date(w.date) <= new Date(dateRange.end) :
      true;
    return matchesSearch && matchesDate;
  });

  const totalAmount = filtered.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Wastage History</h1>
          <p className="text-gray-500 text-sm">Track all recorded wastage expenses</p>
        </div>
        <Link
          to="/wastage/new"
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
        >
          <span>+</span> Record Wastage
        </Link>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Total Wastage</span>
          <span className="text-2xl font-bold text-red-600">৳{totalAmount.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{filtered.length} record(s)</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Description or Reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <button
          onClick={() => { setSearch(''); setDateRange({ start: '', end: '' }); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading wastage records...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((w) => (
                <tr key={w._id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(w.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{w.description || '-'}</td>
                  <td className="px-6 py-4">{w.reference || '-'}</td>
                  <td className="px-6 py-4 text-right font-semibold text-red-600">
                    ৳{w.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => { setSelectedWastage(w); setShowDetails(true); }}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(w._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-400">
                    No wastage records found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan="3" className="px-6 py-3 text-right">Total</td>
                <td className="px-6 py-3 text-right text-red-600">৳{totalAmount.toFixed(2)}</td>
                <td className="px-6 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedWastage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4">Wastage Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{new Date(selectedWastage.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="font-bold text-red-600 text-xl">৳{selectedWastage.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{selectedWastage.description || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reference</p>
                <p className="font-medium">{selectedWastage.reference || '-'}</p>
              </div>
              {selectedWastage.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{selectedWastage.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WastageList;