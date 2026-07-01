import { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Plus, Eye, Search, Edit, Trash2,
  X, CheckCircle, AlertCircle,
  Calendar, Filter, Download, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const ExpensePage = () => {
  const [expenses, setExpenses] = useState([]);
  const [regularExpenses, setRegularExpenses] = useState([]);
  const [eventExpenses, setEventExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('regular');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [formData, setFormData] = useState({
    type: 'regular',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    term: '',
    stallRent: '',
    otherCosts: '',
    notes: '',
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('regular');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Summary
  const [summary, setSummary] = useState({
    totalRegular: 0,
    totalEvent: 0,
    grandTotal: 0,
  });

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/expenses');
      setExpenses(data);

      const regular = data.filter(e => e.type === 'regular' || !e.type);
      const events = data.filter(e => e.type === 'event');
      setRegularExpenses(regular);
      setEventExpenses(events);

      const totalRegular = regular.reduce((sum, e) => sum + e.amount, 0);
      const totalEvent = events.reduce((sum, e) => sum + (e.eventTotal || e.amount || 0), 0);
      setSummary({ totalRegular, totalEvent, grandTotal: totalRegular + totalEvent });

      const uniqueCats = [...new Set(data.map(e => e.category).filter(Boolean))];
      setCategories(uniqueCats);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Handlers ----------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      type: 'regular',
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      term: '',
      stallRent: '',
      otherCosts: '',
      notes: '',
    });
    setSelectedExpense(null);
  };

  // ---------- CRUD ----------
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (formData.type === 'event') {
        payload.amount = parseFloat(formData.stallRent) + parseFloat(formData.otherCosts || 0);
        payload.eventTotal = payload.amount;
      } else {
        payload.amount = parseFloat(formData.amount);
      }

      await API.post('/expenses', payload);
      toast.success('Expense added');
      setShowAddModal(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (formData.type === 'event') {
        payload.amount = parseFloat(formData.stallRent) + parseFloat(formData.otherCosts || 0);
        payload.eventTotal = payload.amount;
      } else {
        payload.amount = parseFloat(formData.amount);
      }

      await API.put(`/expenses/${selectedExpense._id}`, payload);
      toast.success('Expense updated');
      setShowEditModal(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update expense');
    }
  };

  const handleDeleteExpense = async () => {
    try {
      await API.delete(`/expenses/${selectedExpense._id}`);
      toast.success('Expense deleted');
      setShowDeleteModal(false);
      fetchExpenses();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  // ---------- Upload (UPDATED) ----------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
          setUploadResult({ success: false, message: 'File is empty' });
          setUploading(false);
          return;
        }

        const firstRow = rows[0];
        const columns = Object.keys(firstRow);

        const findCol = (possibleNames) => {
          for (const name of possibleNames) {
            const found = columns.find(
              c => c.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            if (found) return found;
          }
          return null;
        };

        let requiredCols;
        // ----- REGULAR -----
        if (uploadType === 'regular') {
          const amountCol = findCol(['amount', 'price', 'cost']);
          const categoryCol = findCol(['category', 'expense category', 'type']);
          const dateCol = findCol(['date', 'day', 'sale date']);

          if (amountCol && categoryCol) {
            // Standard format: category, amount, optional date
            requiredCols = {
              type: 'standard',
              category: categoryCol,
              amount: amountCol,
              date: dateCol || null,
              description: findCol(['description', 'note', 'remarks']),
              reference: findCol(['reference', 'invoice', 'ref']),
            };
          } else {
            // Pivot format: first column is category, others are dates
            const nonDateKeywords = ['category', 'expense category', 'type', 'total', 'column', 'notes', 'remark', 'reference'];
            const dateColumns = columns.filter(col => {
              const lower = col.trim().toLowerCase();
              if (nonDateKeywords.some(k => lower.includes(k))) return false;
              return /[\d\/\-]/.test(col);
            });

            if (dateColumns.length === 0) {
              setUploadResult({
                success: false,
                message: `No date columns found. Expected columns like "19/8", "23/8", etc. Found: ${columns.join(', ')}`,
              });
              setUploading(false);
              return;
            }

            // Use first column as category
            const catCol = columns[0]; // assume first column is category
            requiredCols = {
              type: 'pivot',
              category: catCol,
              dateColumns: dateColumns,
              description: findCol(['description', 'note', 'remarks']),
              reference: findCol(['reference', 'invoice', 'ref']),
            };
          }
        } else {
          // ----- EVENT -----
          requiredCols = {
            term: findCol(['term', 'fair']),
            stallRent: findCol(['stall rent', 'stall', 'rent']),
            otherCosts: findCol(['other costs', 'others', 'extra', 'rent+ others', 'rent+others']),
            date: findCol(['date', 'day', 'sale date']),
            reference: findCol(['reference', 'event name', 'fair']),
            notes: findCol(['notes', 'remarks', 'comment']),
          };

          const optionalKeys = ['date', 'reference', 'notes', 'otherCosts'];
          const missing = [];
          for (const [key, col] of Object.entries(requiredCols)) {
            if (!col && !optionalKeys.includes(key)) {
              missing.push(key);
            }
          }
          if (missing.length) {
            setUploadResult({
              success: false,
              message: `Missing columns: ${missing.join(', ')}. Found: ${columns.join(', ')}`,
            });
            setUploading(false);
            return;
          }
        }

        // Build expense objects
        const expensesToCreate = [];
        const errors = [];

        // ---------- Process REGULAR ----------
        if (uploadType === 'regular') {
          if (requiredCols.type === 'standard') {
            // Standard format
            for (let idx = 0; idx < rows.length; idx++) {
              const row = rows[idx];
              try {
                const category = String(row[requiredCols.category]).trim();
                const amount = parseFloat(row[requiredCols.amount]);
                const date = requiredCols.date && row[requiredCols.date] ? new Date(row[requiredCols.date]) : new Date();
                const description = requiredCols.description ? String(row[requiredCols.description]).trim() : '';
                const reference = requiredCols.reference ? String(row[requiredCols.reference]).trim() : '';

                if (!category || isNaN(amount) || amount <= 0) {
                  errors.push(`Row ${idx+1}: Invalid category or amount`);
                  continue;
                }

                expensesToCreate.push({
                  type: 'regular',
                  category,
                  amount,
                  date,
                  description,
                  reference,
                });
              } catch (err) {
                errors.push(`Row ${idx+1}: ${err.message}`);
              }
            }
          } else {
            // Pivot format
            const catCol = requiredCols.category;
            const dateCols = requiredCols.dateColumns;

            for (let idx = 0; idx < rows.length; idx++) {
              const row = rows[idx];
              const category = String(row[catCol]).trim();
              if (!category) {
                errors.push(`Row ${idx+1}: Missing category`);
                continue;
              }

              for (const dateCol of dateCols) {
                const amount = parseFloat(row[dateCol]);
                if (isNaN(amount) || amount <= 0) continue;

                // Parse date from column header
                let dateObj = new Date();
                try {
                  const dateStr = dateCol.trim();
                  let parts = dateStr.split(/[\/\-]/);
                  if (parts.length === 2) {
                    // day/month – assume current year
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const year = new Date().getFullYear();
                    dateObj = new Date(year, month, day);
                  } else if (parts.length === 3) {
                    let day, month, year;
                    if (parseInt(parts[0]) > 12) {
                      day = parseInt(parts[0]);
                      month = parseInt(parts[1]) - 1;
                      year = parseInt(parts[2]);
                    } else if (parseInt(parts[2]) > 31) {
                      month = parseInt(parts[0]) - 1;
                      day = parseInt(parts[1]);
                      year = parseInt(parts[2]);
                    } else {
                      day = parseInt(parts[0]);
                      month = parseInt(parts[1]) - 1;
                      year = 2000 + parseInt(parts[2]);
                    }
                    dateObj = new Date(year, month, day);
                  }
                  if (isNaN(dateObj.getTime())) {
                    dateObj = new Date();
                  }
                } catch (e) {
                  dateObj = new Date();
                }

                expensesToCreate.push({
                  type: 'regular',
                  category,
                  amount,
                  date: dateObj,
                  description: '',
                  reference: '',
                });
              }
            }
          }
        } else {
          // ---------- Process EVENT ----------
          for (let idx = 0; idx < rows.length; idx++) {
            const row = rows[idx];
            try {
              const term = String(row[requiredCols.term]).trim();
              const stallRent = parseFloat(row[requiredCols.stallRent]) || 0;
              const otherCosts = requiredCols.otherCosts ? parseFloat(row[requiredCols.otherCosts]) || 0 : 0;
              const date = requiredCols.date && row[requiredCols.date] ? new Date(row[requiredCols.date]) : new Date();
              const reference = requiredCols.reference ? String(row[requiredCols.reference]).trim() : '';
              const notes = requiredCols.notes ? String(row[requiredCols.notes]).trim() : '';

              if (!term) {
                errors.push(`Row ${idx+1}: Missing term`);
                continue;
              }
              if (stallRent === 0 && otherCosts === 0) {
                errors.push(`Row ${idx+1}: Both stall rent and other costs are zero`);
                continue;
              }

              const amount = stallRent + otherCosts;
              expensesToCreate.push({
                type: 'event',
                category: 'Stall Rent + Others',
                term,
                stallRent,
                otherCosts,
                eventTotal: amount,
                amount,
                date,
                reference,
                notes,
              });
            } catch (err) {
              errors.push(`Row ${idx+1}: ${err.message}`);
            }
          }
        }

        if (!expensesToCreate.length) {
          setUploadResult({
            success: false,
            message: `No valid rows. Errors: ${errors.join('; ')}`,
          });
          setUploading(false);
          return;
        }

        const response = await API.post('/expenses/bulk', { expenses: expensesToCreate });
        setUploadResult({
          success: true,
          data: response.data,
          errors: errors,
        });
        fetchExpenses();
        setUploadFile(null);
        setTimeout(() => setShowUploadModal(false), 3000);
      };
      reader.readAsArrayBuffer(uploadFile);
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  // ---------- Filtering ----------
  const getFilteredExpenses = () => {
    const list = activeTab === 'regular' ? regularExpenses : eventExpenses;
    return list.filter(e => {
      const matchesSearch =
        e.category?.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.reference?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory ? e.category === filterCategory : true;
      const matchesDate = dateRange.start && dateRange.end ?
        new Date(e.date) >= new Date(dateRange.start) && new Date(e.date) <= new Date(dateRange.end) :
        true;
      return matchesSearch && matchesCategory && matchesDate;
    });
  };

  const filteredExpenses = getFilteredExpenses();

  // ---------- Render ----------
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-gray-500 text-sm">Manage regular & event expenses</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-secondary transition"
          >
            <Plus size={18} /> Add Expense
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Upload size={18} /> Upload Expenses
          </button>
          <button className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-card p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Regular Expenses</p>
          <p className="text-2xl font-bold">৳{summary.totalRegular.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Event Expenses</p>
          <p className="text-2xl font-bold">৳{summary.totalEvent.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold">৳{summary.grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('regular')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'regular'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Regular Expenses
        </button>
        <button
          onClick={() => setActiveTab('event')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'event'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Event Expenses
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Category, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
          />
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
          />
        </div>

        <button
          onClick={() => { setSearch(''); setFilterCategory(''); setDateRange({ start: '', end: '' }); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                {activeTab === 'event' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stall Rent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Other Costs</th>
                  </>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {expense.category}
                    </span>
                  </td>
                  {activeTab === 'event' && (
                    <>
                      <td className="px-6 py-4 font-medium">{expense.term || '-'}</td>
                      <td className="px-6 py-4">৳{expense.stallRent?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4">৳{expense.otherCosts?.toFixed(2) || '0.00'}</td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right font-semibold">
                    ৳{activeTab === 'event'
                      ? (expense.eventTotal || expense.amount || 0).toFixed(2)
                      : expense.amount.toFixed(2)
                    }
                  </td>
                  <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                    {expense.description || expense.reference || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedExpense(expense);
                          setFormData({
                            type: expense.type || 'regular',
                            category: expense.category || '',
                            amount: expense.amount || '',
                            date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : '',
                            description: expense.description || '',
                            reference: expense.reference || '',
                            term: expense.term || '',
                            stallRent: expense.stallRent || '',
                            otherCosts: expense.otherCosts || '',
                            notes: expense.notes || '',
                          });
                          setShowEditModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedExpense(expense);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'event' ? 8 : 5} className="text-center py-8 text-gray-500">
                    No expenses found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={activeTab === 'event' ? 5 : 4} className="px-6 py-3 text-right">
                  Total
                </td>
                <td className="px-6 py-3 text-right">
                  ৳{filteredExpenses.reduce((sum, e) =>
                    sum + (activeTab === 'event' ? (e.eventTotal || e.amount || 0) : e.amount), 0
                  ).toFixed(2)}
                </td>
                <td className="px-6 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ---------- Add Modal ---------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => { setShowAddModal(false); resetForm(); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Add Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="regular"
                      checked={formData.type === 'regular'}
                      onChange={handleInputChange}
                      className="text-brand-primary"
                    />
                    Regular
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="event"
                      checked={formData.type === 'event'}
                      onChange={handleInputChange}
                      className="text-brand-primary"
                    />
                    Event
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                    required
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  />
                </div>
              </div>

              {formData.type === 'regular' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              {formData.type === 'event' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                    <select
                      name="term"
                      value={formData.term}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                      required
                    >
                      <option value="">Select</option>
                      <option value="Fair1">Fair 1</option>
                      <option value="Fair2">Fair 2</option>
                      <option value="Fair3">Fair 3</option>
                      <option value="Fair4">Fair 4</option>
                      <option value="Fair5">Fair 5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stall Rent *</label>
                    <input
                      type="number"
                      name="stallRent"
                      value={formData.stallRent}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Costs</label>
                    <input
                      type="number"
                      name="otherCosts"
                      value={formData.otherCosts}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="Invoice #, event name, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-secondary"
                >
                  Add Expense
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Edit Modal ---------- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => { setShowEditModal(false); resetForm(); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Edit Expense</h2>
            <form onSubmit={handleEditExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="regular"
                      checked={formData.type === 'regular'}
                      onChange={handleInputChange}
                      className="text-brand-primary"
                    />
                    Regular
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="event"
                      checked={formData.type === 'event'}
                      onChange={handleInputChange}
                      className="text-brand-primary"
                    />
                    Event
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  />
                </div>
              </div>

              {formData.type === 'regular' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              {formData.type === 'event' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                    <select
                      name="term"
                      value={formData.term}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                      required
                    >
                      <option value="">Select</option>
                      <option value="Fair1">Fair 1</option>
                      <option value="Fair2">Fair 2</option>
                      <option value="Fair3">Fair 3</option>
                      <option value="Fair4">Fair 4</option>
                      <option value="Fair5">Fair 5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stall Rent *</label>
                    <input
                      type="number"
                      name="stallRent"
                      value={formData.stallRent}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Costs</label>
                    <input
                      type="number"
                      name="otherCosts"
                      value={formData.otherCosts}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-secondary"
                >
                  Update Expense
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Delete Modal ---------- */}
      {showDeleteModal && selectedExpense && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Confirm Delete</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this expense?
              <br />
              <span className="font-semibold">{selectedExpense.category}</span>
              {' - ৳'}
              {selectedExpense.amount.toFixed(2)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteExpense}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Upload Modal ---------- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadResult(null);
                setUploadFile(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-2">Bulk Upload Expenses</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with expense data. Select the expense type below.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                >
                  <option value="regular">Regular Expenses</option>
                  <option value="event">Event Expenses</option>
                </select>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                {uploadType === 'regular' ? (
                  <>
                    <p className="font-medium">Supports two formats:</p>
                    <ul className="list-disc pl-5 text-gray-600">
                      <li><strong>Standard:</strong> columns <em>Category</em>, <em>Amount</em>, optional <em>Date</em></li>
                      <li><strong>Pivot:</strong> first column = Category, other columns = Dates (e.g., "19/8", "23/8")</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Required columns:</p>
                    <ul className="list-disc pl-5 text-gray-600">
                      <li><strong>Term</strong> (e.g., Fair1, Fair2)</li>
                      <li><strong>Stall</strong> (numeric – stall rent)</li>
                      <li><strong>Rent+ Others</strong> (numeric – other costs, optional)</li>
                      <li><strong>Date</strong> (optional)</li>
                      <li><strong>Reference</strong> (optional)</li>
                      <li><strong>Notes</strong> (optional)</li>
                    </ul>
                    <p className="mt-1 text-xs text-gray-500">
                      Total is auto‑calculated as Stall + Rent+ Others.
                    </p>
                  </>
                )}
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>

              {uploadResult && (
                <div
                  className={`p-3 rounded-lg ${
                    uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {uploadResult.success ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{uploadResult.data.message}</p>
                        <p className="text-sm">Created: {uploadResult.data.created?.length || 0}</p>
                        {uploadResult.errors?.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-sm">
                              View errors ({uploadResult.errors.length})
                            </summary>
                            <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto">
                              {uploadResult.errors.map((e, i) => (
                                <li key={i}>• {e}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                      <span>{uploadResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensePage;