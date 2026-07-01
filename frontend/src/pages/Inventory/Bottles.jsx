import { useEffect, useState } from 'react';
import API from '../../api/axios';
import { Plus, Upload, X, CheckCircle, AlertCircle, Pencil, Trash2, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';

const Bottles = () => {
  // ---------- State ----------
  const [bottles, setBottles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBottle, setNewBottle] = useState({
    sizeMl: '',
    type: 'spray',
    currentStock: 0,
    avgCostPerUnit: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBottle, setEditingBottle] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingSize, setDeletingSize] = useState('');

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseBottle, setPurchaseBottle] = useState(null);
  const [purchaseData, setPurchaseData] = useState({
    quantity: '',
    costPerUnit: '',
    supplier: '',
    invoiceNo: '',
  });
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  // ---------- Fetch ----------
  useEffect(() => {
    fetchBottlesWithSales();
  }, []);

  const fetchBottlesWithSales = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/inventory/bottles/with-sales');
      const formatted = data.map(b => ({
        ...b,
        currentStock: Number(b.currentStock) || 0,
        avgCostPerUnit: Number(b.avgCostPerUnit) || 0,
        totalPurchased: Number(b.totalPurchased) || 0,
        sold: Number(b.sold) || 0,
      }));
      setBottles(formatted);
    } catch (error) {
      console.error('Failed to fetch bottles with sales', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Single Add ----------
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    try {
      await API.post('/inventory/bottles', {
        sizeMl: parseFloat(newBottle.sizeMl),
        type: newBottle.type,
        currentStock: Number(newBottle.currentStock) || 0,
        avgCostPerUnit: Number(newBottle.avgCostPerUnit) || 0,
      });
      setShowAddModal(false);
      fetchBottlesWithSales();
      setNewBottle({ sizeMl: '', type: 'spray', currentStock: 0, avgCostPerUnit: 0 });
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create bottle');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Edit ----------
  const handleEditClick = (bottle) => {
    setEditingBottle({
      ...bottle,
      currentStock: Number(bottle.currentStock) || 0,
      avgCostPerUnit: Number(bottle.avgCostPerUnit) || 0,
      totalPurchased: Number(bottle.totalPurchased) || 0,
      sold: Number(bottle.sold) || 0,
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingBottle) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      await API.put(`/inventory/bottles/${editingBottle._id}`, {
        sizeMl: editingBottle.sizeMl,
        type: editingBottle.type,
        currentStock: Number(editingBottle.currentStock) || 0,
        avgCostPerUnit: Number(editingBottle.avgCostPerUnit) || 0,
      });
      setShowEditModal(false);
      fetchBottlesWithSales();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ---------- Delete ----------
  const handleDeleteClick = (id, sizeMl, type) => {
    setDeletingId(id);
    setDeletingSize(`${sizeMl}ml (${type})`);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await API.delete(`/inventory/bottles/${deletingId}`);
      setShowDeleteConfirm(false);
      fetchBottlesWithSales();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
      setDeletingSize('');
    }
  };

  // ---------- Purchase ----------
  const handlePurchaseClick = (bottle) => {
    setPurchaseBottle(bottle);
    setPurchaseData({ quantity: '', costPerUnit: '', supplier: '', invoiceNo: '' });
    setPurchaseError('');
    setShowPurchaseModal(true);
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    const { quantity, costPerUnit, supplier, invoiceNo } = purchaseData;
    if (!quantity || quantity <= 0) {
      setPurchaseError('Quantity must be a positive number');
      return;
    }
    if (!costPerUnit || costPerUnit < 0) {
      setPurchaseError('Cost per unit must be >= 0');
      return;
    }
    setPurchasing(true);
    setPurchaseError('');
    try {
      await API.post(`/inventory/bottles/${purchaseBottle._id}/purchase`, {
        quantity: parseFloat(quantity),
        costPerUnit: parseFloat(costPerUnit),
        supplier: supplier.trim() || undefined,
        invoiceNo: invoiceNo.trim() || undefined,
      });
      setShowPurchaseModal(false);
      fetchBottlesWithSales();
    } catch (err) {
      setPurchaseError(err.response?.data?.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  // ---------- Bulk Upload ----------
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const findColumn = (obj, possibleNames) => {
          const keys = Object.keys(obj);
          for (const name of possibleNames) {
            const found = keys.find(
              k => k.trim().toLowerCase().includes(name.toLowerCase())
            );
            if (found) return found;
          }
          return null;
        };

        const firstRow = rows[0] || {};
        const sizeCol = findColumn(firstRow, ['size', 'ml', 'sizeml']);
        const typeCol = findColumn(firstRow, ['type', 'bottle type']);
        const stockCol = findColumn(firstRow, ['stock', 'qty', 'quantity']);
        const costCol = findColumn(firstRow, ['cost', 'unit cost', 'avg cost', 'per unit cost']);

        if (!sizeCol) {
          const found = Object.keys(firstRow).join(', ');
          setUploadResult({
            success: false,
            message: `Could not find a column for bottle size. Found: ${found || 'none'}. Please include a column like "Size" or "Size (ml)".`,
          });
          setUploading(false);
          return;
        }

        const items = rows
          .map((row) => {
            const sizeRaw = String(row[sizeCol]).trim();
            const sizeMatch = sizeRaw.match(/([\d.]+)/);
            const sizeMl = sizeMatch ? parseFloat(sizeMatch[1]) : NaN;

            let type = 'spray';
            if (typeCol) {
              const typeRaw = String(row[typeCol]).toLowerCase().trim();
              if (typeRaw.includes('roll') || typeRaw.includes('role')) type = 'roll-on';
              else if (typeRaw.includes('spray')) type = 'spray';
            } else {
              const lower = sizeRaw.toLowerCase();
              if (lower.includes('role') || lower.includes('roll')) type = 'roll-on';
              else if (lower.includes('spray')) type = 'spray';
            }

            let currentStock = 0;
            if (stockCol) {
              const val = parseFloat(row[stockCol]);
              if (!isNaN(val) && val >= 0) currentStock = val;
            }

            let avgCostPerUnit = 0;
            if (costCol) {
              const val = parseFloat(row[costCol]);
              if (!isNaN(val) && val >= 0) avgCostPerUnit = val;
            }

            return { sizeMl, type, currentStock, avgCostPerUnit };
          })
          .filter((item) => !isNaN(item.sizeMl) && item.type && (item.type === 'spray' || item.type === 'roll-on'));

        if (!items.length) {
          setUploadResult({
            success: false,
            message: 'No valid rows. Could not extract size and type. Ensure values like "3.5ml Role" or "6ml Spray".',
          });
          setUploading(false);
          return;
        }

        const response = await API.post('/inventory/bottles/bulk', { items });
        setUploadResult({ success: true, data: response.data });
        fetchBottlesWithSales();
        setFile(null);
        setTimeout(() => setShowUploadModal(false), 3000);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  // ---------- Render ----------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Bottles</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} /> Add Bottle
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Upload size={18} /> Upload Sheet
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sold</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Per Unit Cost (৳)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value (৳)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bottles.map((b) => {
                const totalPurchased = b.totalPurchased || 0;
                const sold = b.sold || 0;
                const available = Math.max(0, totalPurchased - sold);
                const unitCost = b.avgCostPerUnit || 0;
                const totalValue = available * unitCost;

                return (
                  <tr key={b._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">{b.sizeMl}</td>
                    <td className="px-6 py-4 capitalize">{b.type}</td>
                    <td className="px-6 py-4 text-right font-medium">{totalPurchased}</td>
                    <td className="px-6 py-4 text-right text-rose-600">{sold}</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-600">{available}</td>
                    <td className="px-6 py-4 text-right">৳{unitCost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-cyan-600">৳{totalValue.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handlePurchaseClick(b)}
                        className="text-green-600 hover:text-green-800 mr-3"
                        title="Record Purchase"
                      >
                        <DollarSign size={18} />
                      </button>
                      <button
                        onClick={() => handleEditClick(b)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(b._id, b.sizeMl, b.type)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {bottles.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">No bottles found</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan="2" className="px-6 py-3 text-right">Total</td>
                <td className="px-6 py-3 text-right">
                  {bottles.reduce((sum, b) => sum + (b.totalPurchased || 0), 0)}
                </td>
                <td className="px-6 py-3 text-right text-rose-600">
                  {bottles.reduce((sum, b) => sum + (b.sold || 0), 0)}
                </td>
                <td className="px-6 py-3 text-right text-green-600">
                  {bottles.reduce((sum, b) => sum + Math.max(0, (b.totalPurchased || 0) - (b.sold || 0)), 0)}
                </td>
                <td className="px-6 py-3 text-right">-</td>
                <td className="px-6 py-3 text-right text-cyan-600">
                  ৳{bottles.reduce((sum, b) => {
                    const avail = Math.max(0, (b.totalPurchased || 0) - (b.sold || 0));
                    return sum + (avail * (b.avgCostPerUnit || 0));
                  }, 0).toFixed(2)}
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Add Bottle Type</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (ml)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBottle.sizeMl}
                  onChange={(e) => setNewBottle({ ...newBottle, sizeMl: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newBottle.type}
                  onChange={(e) => setNewBottle({ ...newBottle, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="spray">Spray</option>
                  <option value="roll-on">Roll‑on</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={newBottle.currentStock}
                  onChange={(e) => setNewBottle({ ...newBottle, currentStock: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Unit Cost (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newBottle.avgCostPerUnit}
                  onChange={(e) => setNewBottle({ ...newBottle, avgCostPerUnit: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              {modalError && <p className="text-red-500 text-sm">{modalError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Edit Modal (ENHANCED) ---------- */}
      {showEditModal && editingBottle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Edit Bottle</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Editable fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (ml)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingBottle.sizeMl}
                  onChange={(e) => setEditingBottle({ ...editingBottle, sizeMl: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={editingBottle.type}
                  onChange={(e) => setEditingBottle({ ...editingBottle, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="spray">Spray</option>
                  <option value="roll-on">Roll‑on</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock (Inventory)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={editingBottle.currentStock}
                  onChange={(e) => setEditingBottle({ ...editingBottle, currentStock: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Unit Cost (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingBottle.avgCostPerUnit}
                  onChange={(e) => setEditingBottle({ ...editingBottle, avgCostPerUnit: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              {/* Read-only summary of stock & sales */}
              <div className="border-t pt-4 mt-2">
                <p className="text-sm text-gray-500 mb-2">Stock & Sales Summary (read‑only)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Total Stock</span>
                    <p className="font-semibold">{editingBottle.totalPurchased || 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Sold</span>
                    <p className="font-semibold text-rose-600">{editingBottle.sold || 0}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Available Stock</span>
                    <p className="font-semibold text-green-600">
                      {Math.max(0, (editingBottle.totalPurchased || 0) - (editingBottle.sold || 0))}
                    </p>
                  </div>
                </div>
              </div>

              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <button
                type="submit"
                disabled={editSubmitting}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editSubmitting ? 'Updating...' : 'Update'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Delete Confirmation ---------- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingSize}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Upload Modal ---------- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadResult(null);
                setFile(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-2">Bulk Upload Bottles</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with columns: <strong>Size</strong> (e.g., "3.5ml Role") and optional <strong>Type</strong> (spray or roll‑on).
              <br />
              Optional columns: <strong>Stock</strong> (initial quantity) and <strong>Per Unit Cost (৳)</strong> (average cost per unit).
              <br />
              If Type is missing, it will be inferred from the Size text.
            </p>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
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
                        {uploadResult.data.errors?.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-sm">
                              View errors ({uploadResult.data.errors.length})
                            </summary>
                            <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto">
                              {uploadResult.data.errors.map((e, i) => (
                                <li key={i}>
                                  • {e.error} {e.item && `(item: ${JSON.stringify(e.item)})`}
                                </li>
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
                  disabled={uploading || !file}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setFile(null);
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

      {/* ---------- Purchase Modal ---------- */}
      {showPurchaseModal && purchaseBottle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPurchaseModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-2">Record Purchase</h2>
            <p className="text-gray-500 text-sm mb-4">
              {purchaseBottle.sizeMl}ml - <span className="capitalize">{purchaseBottle.type}</span>
            </p>
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={purchaseData.quantity}
                  onChange={(e) => setPurchaseData({ ...purchaseData, quantity: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseData.costPerUnit}
                  onChange={(e) => setPurchaseData({ ...purchaseData, costPerUnit: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (optional)</label>
                <input
                  type="text"
                  value={purchaseData.supplier}
                  onChange={(e) => setPurchaseData({ ...purchaseData, supplier: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No. (optional)</label>
                <input
                  type="text"
                  value={purchaseData.invoiceNo}
                  onChange={(e) => setPurchaseData({ ...purchaseData, invoiceNo: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              {purchaseError && <p className="text-red-500 text-sm">{purchaseError}</p>}
              <button
                type="submit"
                disabled={purchasing}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {purchasing ? 'Recording...' : 'Record Purchase'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bottles;