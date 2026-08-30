import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { 
  Plus, 
  UserPlus, 
  Wallet, 
  Trash2, 
  X, 
} from 'lucide-react';
import toast from 'react-hot-toast';

const Investors = () => {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableCash, setAvailableCash] = useState(0);
  const [settlementsTotal, setSettlementsTotal] = useState(0);

  // Add investor form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInvestor, setNewInvestor] = useState({ name: '', initialInvestment: '' });

  // Add contribution modal
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [contribution, setContribution] = useState({
    amount: '',
    type: 'investment',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [investorToDelete, setInvestorToDelete] = useState(null);

  // Summary stats
  const [summary, setSummary] = useState({
    totalInvestors: 0,
    totalNet: 0,
    totalInvested: 0,
    totalWithdrawn: 0,
  });

  useEffect(() => {
    fetchInvestors();
  }, []);

  const fetchInvestors = async () => {
    setLoading(true);
    try {
      const [investorsRes, cashRes, settlementsRes] = await Promise.all([
        API.get('/investors'),
        API.get('/reports/available-cash'),
        API.get('/investors/settlements'),
      ]);

      const data = investorsRes.data;
      setInvestors(data);
      setAvailableCash(cashRes.data?.availableCash || 0);
      setSettlementsTotal(settlementsRes.data?.total || 0);

      let totalInvested = 0;
      let totalWithdrawn = 0;
      let totalNet = 0;
      data.forEach(inv => {
        inv.contributions.forEach(c => {
          if (c.type === 'investment') totalInvested += c.amount;
          else totalWithdrawn += c.amount;
        });
        totalNet += inv.netContribution || 0;
      });
      setSummary({
        totalInvestors: data.length,
        totalNet,
        totalInvested,
        totalWithdrawn,
      });
    } catch (error) {
      toast.error('Failed to load investors or available cash');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ----- Add Investor -----
  const handleAddInvestor = async (e) => {
    e.preventDefault();
    if (!newInvestor.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    try {
      const payload = {
        name: newInvestor.name.trim(),
        initialInvestment: parseFloat(newInvestor.initialInvestment) || 0,
      };
      await API.post('/investors', payload);
      toast.success('Investor added successfully');
      setShowAddModal(false);
      setNewInvestor({ name: '', initialInvestment: '' });
      fetchInvestors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add investor');
    }
  };

  // ----- Add Contribution -----
  const handleAddContribution = async (e) => {
    e.preventDefault();
    if (!selectedInvestor) return;
    const amount = parseFloat(contribution.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      await API.post(`/investors/${selectedInvestor._id}/contribute`, {
        amount,
        type: contribution.type,
        date: contribution.date || new Date(),
        notes: contribution.notes || '',
      });
      toast.success('Contribution added');
      setShowContributionModal(false);
      setContribution({ amount: '', type: 'investment', date: new Date().toISOString().split('T')[0], notes: '' });
      setSelectedInvestor(null);
      fetchInvestors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add contribution');
    }
  };

  // ----- Delete Investor -----
  const handleDeleteInvestor = async () => {
    if (!investorToDelete) return;
    try {
      await API.delete(`/investors/${investorToDelete._id}`);
      toast.success('Investor closed successfully');
      setShowDeleteModal(false);
      setInvestorToDelete(null);
      fetchInvestors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to close investor');
    }
  };

  const openContributionModal = (investor) => {
    setSelectedInvestor(investor);
    setContribution({
      amount: '',
      type: 'investment',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowContributionModal(true);
  };

  const openDeleteModal = (investor) => {
    setInvestorToDelete(investor);
    setShowDeleteModal(true);
  };

  const calculateShare = (investor) => {
    const totalInvested = investor.contributions
      .filter(c => c.type === 'investment')
      .reduce((sum, c) => sum + c.amount, 0);
    const overallTotal = summary.totalInvested;
    if (overallTotal === 0) return 0;
    return (totalInvested / overallTotal) * 100;
  };

  const calculateProfitShare = (sharePercentage) => {
    return (sharePercentage / 100) * availableCash;
  };

  const formatCurrency = (amount) => {
    return `৳${(amount || 0).toFixed(2)}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Investors</h1>
          <p className="text-gray-500 text-sm">Manage partners and track contributions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30 text-sm"
        >
          <UserPlus size={18} /> Add Investor
        </button>
      </div>

      {/* Summary Cards – responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total Investors</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{summary.totalInvestors}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total Invested</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalInvested)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total Withdrawn</p>
          <p className="text-xl sm:text-2xl font-bold text-rose-600">{formatCurrency(summary.totalWithdrawn)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Available Cash</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{formatCurrency(availableCash)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total Settlements</p>
          <p className="text-xl sm:text-2xl font-bold text-rose-600">{formatCurrency(settlementsTotal)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading investors...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Invested</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Withdrawn</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Share %</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit Share</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contributions</th>
                <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {investors.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-400">No investors yet</td>
                </tr>
              ) : (
                investors.map((investor) => {
                  const totalInvested = investor.contributions
                    .filter(c => c.type === 'investment')
                    .reduce((sum, c) => sum + c.amount, 0);
                  const totalWithdrawn = investor.contributions
                    .filter(c => c.type === 'withdrawal')
                    .reduce((sum, c) => sum + c.amount, 0);
                  const share = calculateShare(investor);
                  const profitShare = calculateProfitShare(share);
                  const totalAmount = totalInvested + profitShare;

                  return (
                    <tr key={investor._id} className="hover:bg-gray-50 transition">
                      <td className="px-3 sm:px-4 py-3 font-medium text-gray-800 text-sm">{investor.name}</td>
                      <td className="px-3 sm:px-4 py-3 text-right text-emerald-600 font-semibold text-sm">
                        {formatCurrency(totalInvested)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-rose-600 font-semibold text-sm">
                        {formatCurrency(totalWithdrawn)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          share > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {share.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-purple-600 font-semibold text-sm">
                        {formatCurrency(profitShare)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-bold text-amber-600 text-sm">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-left">
                        {investor.contributions.length === 0 ? (
                          <span className="text-gray-400 text-xs">No contributions</span>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {investor.contributions.map((c, idx) => (
                              <div key={idx} className="text-xs flex flex-wrap items-center gap-1 sm:gap-2 border-b border-gray-100 pb-1 last:border-0">
                                <span className="text-gray-500 whitespace-nowrap">{formatDate(c.date)}</span>
                                <span className={`font-medium ${c.type === 'investment' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {c.type === 'investment' ? '＋' : '－'}
                                </span>
                                <span className="font-mono font-medium">{formatCurrency(c.amount)}</span>
                                {c.notes && <span className="text-gray-400 truncate max-w-[80px] sm:max-w-[100px]">({c.notes})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <div className="flex justify-center items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => openContributionModal(investor)}
                            className="text-blue-600 hover:text-blue-800 transition p-1"
                            title="Add Contribution"
                          >
                            <Wallet size={18} />
                          </button>
                          <button
                            onClick={() => openDeleteModal(investor)}
                            className="text-rose-600 hover:text-rose-800 transition p-1"
                            title="Close Investor"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Add Investor Modal – responsive ---------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Add New Investor</h2>
            <form onSubmit={handleAddInvestor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newInvestor.name}
                  onChange={(e) => setNewInvestor({ ...newInvestor, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  placeholder="e.g., John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Investment (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newInvestor.initialInvestment}
                  onChange={(e) => setNewInvestor({ ...newInvestor, initialInvestment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition text-sm"
                >
                  Add Investor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Contribution Modal – responsive ---------- */}
      {showContributionModal && selectedInvestor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 relative">
            <button
              onClick={() => {
                setShowContributionModal(false);
                setSelectedInvestor(null);
                setContribution({ amount: '', type: 'investment', date: new Date().toISOString().split('T')[0], notes: '' });
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Add Contribution</h2>
            <p className="text-sm text-gray-500 mb-4">For: <span className="font-semibold text-gray-700">{selectedInvestor.name}</span></p>
            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={contribution.type}
                  onChange={(e) => setContribution({ ...contribution, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
                >
                  <option value="investment">Investment</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={contribution.amount}
                  onChange={(e) => setContribution({ ...contribution, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={contribution.date}
                  onChange={(e) => setContribution({ ...contribution, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={contribution.notes}
                  onChange={(e) => setContribution({ ...contribution, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  placeholder="e.g., Monthly investment"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition text-sm"
                >
                  Add Contribution
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowContributionModal(false);
                    setSelectedInvestor(null);
                    setContribution({ amount: '', type: 'investment', date: new Date().toISOString().split('T')[0], notes: '' });
                  }}
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Delete Confirmation Modal – responsive ---------- */}
      {showDeleteModal && investorToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Close Investor</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to close <span className="font-semibold">{investorToDelete.name}</span>?
              <br />
              This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDeleteInvestor}
                className="w-full sm:flex-1 bg-rose-600 text-white py-2 rounded-lg hover:bg-rose-700 transition text-sm"
              >
                Yes, Close
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setInvestorToDelete(null);
                }}
                className="w-full sm:flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-sm"
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

export default Investors;