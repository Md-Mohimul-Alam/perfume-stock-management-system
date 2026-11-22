
import { useEffect, useState, useCallback } from 'react';
import API from '../../api/axios';
import {
  UserPlus,
  Wallet,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const getLocalDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toDateInputValue = (date) => {
  if (!date) return '';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return '';

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const getContributionTotals = (investor) => {
  const contributions = Array.isArray(investor.contributions)
    ? investor.contributions
    : [];

  return contributions.reduce(
    (totals, item) => {
      const amount = Number(item.amount) || 0;

      if (item.type === 'investment') {
        totals.invested += amount;
      }

      if (item.type === 'withdrawal') {
        totals.withdrawn += amount;
      }

      return totals;
    },
    {
      invested: 0,
      withdrawn: 0,
    }
  );
};

const Investors = () => {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [availableCash, setAvailableCash] = useState(0);
  const [settlementsTotal, setSettlementsTotal] = useState(0);

  // ADD INVESTOR
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInvestor, setNewInvestor] = useState({
    name: '',
    initialInvestment: '',
  });

  // ADD CONTRIBUTION
  const [showContributionModal, setShowContributionModal] =
    useState(false);

  const [selectedInvestor, setSelectedInvestor] = useState(null);

  const [contribution, setContribution] = useState({
    amount: '',
    type: 'investment',
    date: getLocalDate(),
    notes: '',
  });

  // EDIT CONTRIBUTION
  const [showEditContributionModal, setShowEditContributionModal] =
    useState(false);

  const [editingContribution, setEditingContribution] = useState(null);

  const [editContribution, setEditContribution] = useState({
    amount: '',
    type: 'investment',
    date: '',
    notes: '',
  });

  // DELETE INVESTOR
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [investorToDelete, setInvestorToDelete] = useState(null);

  // SUMMARY
  const [summary, setSummary] = useState({
    totalInvestors: 0,
    totalInvested: 0,
    totalWithdrawn: 0,
  });

  // LOAD DATA
  const fetchInvestors = useCallback(async () => {
    setLoading(true);

    try {
      const [investorsRes, cashRes, settlementsRes] =
        await Promise.all([
          API.get('/investors'),
          API.get('/reports/available-cash'),
          API.get('/investors/settlements'),
        ]);

      const data = Array.isArray(investorsRes.data)
        ? investorsRes.data
        : [];

      setInvestors(data);

      setAvailableCash(
        Number(cashRes.data?.availableCash) || 0
      );

      setSettlementsTotal(
        Number(settlementsRes.data?.total) || 0
      );

      const totals = data.reduce(
        (result, investor) => {
          const investorTotals = getContributionTotals(investor);

          result.totalInvested += investorTotals.invested;
          result.totalWithdrawn += investorTotals.withdrawn;

          return result;
        },
        {
          totalInvested: 0,
          totalWithdrawn: 0,
        }
      );

      setSummary({
        totalInvestors: data.length,
        ...totals,
      });
    } catch (error) {
      console.error('Failed to load investors:', error);

      toast.error(
        error.response?.data?.message ||
          'Failed to load investors'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  // FORMATTERS
  const formatCurrency = (amount) => {
    const value = Number(amount) || 0;

    return `৳${value.toLocaleString('en-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return '-';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // INVESTOR SHARE
  // Ownership is calculated from investment contributions only.
  // Withdrawals/distributions do not reduce ownership.
  const calculateShare = (investor) => {
    const investorTotals = getContributionTotals(investor);

    if (summary.totalInvested <= 0) return 0;

    return (
      (investorTotals.invested / summary.totalInvested) * 100
    );
  };

  // ADD INVESTOR
  const handleAddInvestor = async (event) => {
    event.preventDefault();

    const name = newInvestor.name.trim();
    const initialInvestment = Number(
      newInvestor.initialInvestment || 0
    );

    if (!name) {
      toast.error('Please enter a name');
      return;
    }

    if (
      !Number.isFinite(initialInvestment) ||
      initialInvestment < 0
    ) {
      toast.error('Please enter a valid initial investment');
      return;
    }

    try {
      await API.post('/investors', {
        name,
        initialInvestment,
      });

      toast.success('Investor added successfully');

      setShowAddModal(false);

      setNewInvestor({
        name: '',
        initialInvestment: '',
      });

      await fetchInvestors();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Failed to add investor'
      );
    }
  };

  // ADD CONTRIBUTION
  const handleAddContribution = async (event) => {
    event.preventDefault();

    if (!selectedInvestor) return;

    const amount = Number(contribution.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await API.post(
        `/investors/${selectedInvestor._id}/contribute`,
        {
          amount,
          type: contribution.type,
          date: contribution.date,
          notes: contribution.notes.trim(),
        }
      );

      toast.success(
        contribution.type === 'investment'
          ? 'Investment added'
          : 'Profit distribution recorded'
      );

      closeContributionModal();

      await fetchInvestors();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Failed to add contribution'
      );
    }
  };

  const openContributionModal = (investor) => {
    setSelectedInvestor(investor);

    setContribution({
      amount: '',
      type: 'investment',
      date: getLocalDate(),
      notes: '',
    });

    setShowContributionModal(true);
  };

  const closeContributionModal = () => {
    setShowContributionModal(false);
    setSelectedInvestor(null);

    setContribution({
      amount: '',
      type: 'investment',
      date: getLocalDate(),
      notes: '',
    });
  };

  // EDIT CONTRIBUTION
  const openEditContributionModal = (investor, item) => {
    setSelectedInvestor(investor);
    setEditingContribution(item);

    setEditContribution({
      amount: String(item.amount ?? ''),
      type: item.type,
      date: toDateInputValue(item.date),
      notes: item.notes || '',
    });

    setShowEditContributionModal(true);
  };

  const closeEditContributionModal = () => {
    setShowEditContributionModal(false);
    setSelectedInvestor(null);
    setEditingContribution(null);

    setEditContribution({
      amount: '',
      type: 'investment',
      date: '',
      notes: '',
    });
  };

  const handleEditContribution = async (event) => {
    event.preventDefault();

    if (!selectedInvestor || !editingContribution) return;

    const amount = Number(editContribution.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await API.put(
        `/investors/${selectedInvestor._id}/contributions/${editingContribution._id}`,
        {
          amount,
          type: editContribution.type,
          date: editContribution.date,
          notes: editContribution.notes.trim(),
        }
      );

      toast.success('Contribution updated');

      closeEditContributionModal();

      await fetchInvestors();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Failed to update contribution'
      );
    }
  };

  // DELETE CONTRIBUTION
  const handleDeleteContribution = async (investor, item) => {
    const label =
      item.type === 'investment'
        ? 'investment'
        : 'profit distribution';

    const confirmed = window.confirm(
      `Delete this ${label} of ${formatCurrency(item.amount)}?`
    );

    if (!confirmed) return;

    try {
      await API.delete(
        `/investors/${investor._id}/contributions/${item._id}`
      );

      toast.success('Contribution deleted');

      await fetchInvestors();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Failed to delete contribution'
      );
    }
  };

  // DELETE / CLOSE INVESTOR
  const openDeleteModal = (investor) => {
    setInvestorToDelete(investor);
    setShowDeleteModal(true);
  };

  const handleDeleteInvestor = async () => {
    if (!investorToDelete) return;

    try {
      await API.delete(`/investors/${investorToDelete._id}`);

      toast.success('Investor closed successfully');

      setShowDeleteModal(false);
      setInvestorToDelete(null);

      await fetchInvestors();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Failed to close investor'
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Investors
          </h1>

          <p className="text-gray-500 text-sm">
            Manage partners, investments and distributions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md text-sm"
        >
          <UserPlus size={18} />
          Add Investor
        </button>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Total Investors
          </p>

          <p className="text-xl sm:text-2xl font-bold text-amber-600">
            {summary.totalInvestors}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Total Invested
          </p>

          <p className="text-xl sm:text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.totalInvested)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Profit Distributions
          </p>

          <p className="text-xl sm:text-2xl font-bold text-rose-600">
            {formatCurrency(summary.totalWithdrawn)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Available Cash
          </p>

          <p className="text-xl sm:text-2xl font-bold text-indigo-600">
            {formatCurrency(availableCash)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Total Settlements
          </p>

          <p className="text-xl sm:text-2xl font-bold text-rose-600">
            {formatCurrency(settlementsTotal)}
          </p>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />

            <p className="text-gray-500 mt-4">
              Loading investors...
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>

                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Invested
                </th>

                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Distributed
                </th>

                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Share %
                </th>

                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contributions
                </th>

                <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {investors.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-8 text-gray-400"
                  >
                    No investors yet
                  </td>
                </tr>
              ) : (
                investors.map((investor) => {
                  const totals = getContributionTotals(investor);
                  const share = calculateShare(investor);

                  return (
                    <tr
                      key={investor._id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-3 sm:px-4 py-3 font-medium text-gray-800 text-sm">
                        {investor.name}
                      </td>

                      <td className="px-3 sm:px-4 py-3 text-right text-emerald-600 font-semibold text-sm">
                        {formatCurrency(totals.invested)}
                      </td>

                      <td className="px-3 sm:px-4 py-3 text-right text-rose-600 font-semibold text-sm">
                        {formatCurrency(totals.withdrawn)}
                      </td>

                      <td className="px-3 sm:px-4 py-3 text-right">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {share.toFixed(2)}%
                        </span>
                      </td>

                      <td className="px-3 sm:px-4 py-3 min-w-[320px]">
                        {!investor.contributions?.length ? (
                          <span className="text-gray-400 text-xs">
                            No contributions
                          </span>
                        ) : (
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {investor.contributions.map((item) => (
                              <div
                                key={item._id}
                                className="flex items-center gap-2 border-b border-gray-100 pb-2 last:border-0"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-gray-500">
                                      {formatDate(item.date)}
                                    </span>

                                    <span
                                      className={
                                        item.type === 'investment'
                                          ? 'font-semibold text-emerald-600'
                                          : 'font-semibold text-rose-600'
                                      }
                                    >
                                      {item.type === 'investment'
                                        ? '＋ Investment'
                                        : '－ Distribution'}
                                    </span>

                                    <span className="font-mono font-medium">
                                      {formatCurrency(item.amount)}
                                    </span>
                                  </div>

                                  {item.notes && (
                                    <p className="text-[11px] text-gray-400 truncate mt-1">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditContributionModal(
                                      investor,
                                      item
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                                  title="Edit contribution"
                                >
                                  <Pencil size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteContribution(
                                      investor,
                                      item
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                  title="Delete contribution"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-3 sm:px-4 py-3 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openContributionModal(investor)
                            }
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Add contribution"
                          >
                            <Wallet size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(investor)}
                            className="text-rose-600 hover:text-rose-800 p-1"
                            title="Close investor"
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

      {/* ADD INVESTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold mb-4">
              Add New Investor
            </h2>

            <form
              onSubmit={handleAddInvestor}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Full Name *
                </label>

                <input
                  type="text"
                  value={newInvestor.name}
                  onChange={(event) =>
                    setNewInvestor({
                      ...newInvestor,
                      name: event.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Initial Investment
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newInvestor.initialInvestment}
                  onChange={(event) =>
                    setNewInvestor({
                      ...newInvestor,
                      initialInvestment: event.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 text-white py-2.5 rounded-lg"
              >
                Add Investor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD CONTRIBUTION MODAL */}
      {showContributionModal && selectedInvestor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={closeContributionModal}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold mb-1">
              Add Contribution
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              {selectedInvestor.name}
            </p>

            <form
              onSubmit={handleAddContribution}
              className="space-y-4"
            >
              <ContributionFields
                value={contribution}
                setValue={setContribution}
              />

              <button
                type="submit"
                className="w-full bg-amber-600 text-white py-2.5 rounded-lg"
              >
                Add Contribution
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CONTRIBUTION MODAL */}
      {showEditContributionModal &&
        selectedInvestor &&
        editingContribution && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
              <button
                type="button"
                onClick={closeEditContributionModal}
                className="absolute top-4 right-4 text-gray-400"
              >
                <X size={24} />
              </button>

              <h2 className="text-xl font-bold mb-1">
                Edit Contribution
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                {selectedInvestor.name}
              </p>

              <form
                onSubmit={handleEditContribution}
                className="space-y-4"
              >
                <ContributionFields
                  value={editContribution}
                  setValue={setEditContribution}
                />

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

      {/* CLOSE INVESTOR MODAL */}
      {showDeleteModal && investorToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">
              Close Investor
            </h2>

            <p className="text-gray-600 mb-5">
              Close <strong>{investorToDelete.name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteInvestor}
                className="flex-1 bg-rose-600 text-white py-2 rounded-lg"
              >
                Yes, Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setInvestorToDelete(null);
                }}
                className="flex-1 border py-2 rounded-lg"
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

// REUSABLE CONTRIBUTION FIELDS
const ContributionFields = ({ value, setValue }) => {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Type
        </label>

        <select
          value={value.type}
          onChange={(event) =>
            setValue({
              ...value,
              type: event.target.value,
            })
          }
          className="w-full px-4 py-2 border rounded-lg bg-white"
        >
          <option value="investment">
            Investment
          </option>

          <option value="withdrawal">
            Profit Distribution
          </option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Amount *
        </label>

        <input
          type="number"
          min="0.01"
          step="0.01"
          value={value.amount}
          onChange={(event) =>
            setValue({
              ...value,
              amount: event.target.value,
            })
          }
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Date
        </label>

        <input
          type="date"
          value={value.date}
          onChange={(event) =>
            setValue({
              ...value,
              date: event.target.value,
            })
          }
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Notes
        </label>

        <input
          type="text"
          value={value.notes}
          onChange={(event) =>
            setValue({
              ...value,
              notes: event.target.value,
            })
          }
          className="w-full px-4 py-2 border rounded-lg"
          placeholder="e.g. 3rd profit"
        />
      </div>
    </>
  );
};

export default Investors;
