import { useEffect, useState } from 'react';
import API from '../../api/axios';
import { Plus, Upload, X, CheckCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const Materials = () => {
  // ---------- State ----------
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', sku: '', type: 'oil' });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingName, setDeletingName] = useState('');

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // ---------- Fetch ----------
  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/inventory/materials');
      setMaterials(data);
    } catch (error) {
      console.error('Failed to fetch materials', error);
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
      await API.post('/inventory/materials', newMaterial);
      setShowAddModal(false);
      fetchMaterials();
      setNewMaterial({ name: '', sku: '', type: 'oil' });
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create material');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Edit ----------
  const handleEditClick = (material) => {
    setEditingMaterial({ ...material });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMaterial) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      await API.put(`/inventory/materials/${editingMaterial._id}`, {
        name: editingMaterial.name,
        sku: editingMaterial.sku,
        type: editingMaterial.type,
      });
      setShowEditModal(false);
      fetchMaterials();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ---------- Delete ----------
  const handleDeleteClick = (id, name) => {
    setDeletingId(id);
    setDeletingName(name);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await API.delete(`/inventory/materials/${deletingId}`);
      setShowDeleteConfirm(false);
      fetchMaterials();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
      setDeletingName('');
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
        const rows = XLSX.utils.sheet_to_json(sheet);

        const items = rows.map((row) => {
          const purchases = [];
          for (let i = 1; i <= 3; i++) {
            const qtyKey = `QTY${i}`;
            const prKey = `PR${i}`;
            const qty = parseFloat(row[qtyKey]);
            const cost = parseFloat(row[prKey]);
            if (!isNaN(qty) && !isNaN(cost) && qty > 0 && cost > 0) {
              purchases.push({
                quantityMl: qty,
                costPerMl: cost / qty,
                totalCost: qty * cost,
                supplier: '',
                invoiceNo: '',
              });
            }
          }
          if (purchases.length === 0) {
            const totalQty = parseFloat(row['Total Quantity']);
            const totalPrice = parseFloat(row['Total Price']);
            if (!isNaN(totalQty) && !isNaN(totalPrice) && totalQty > 0 && totalPrice > 0) {
              purchases.push({
                quantityMl: totalQty,
                costPerMl: totalPrice / totalQty,
                totalCost: totalPrice,
                supplier: '',
                invoiceNo: '',
              });
            }
          }

          let type = (row['type'] || row['Type'] || '').toLowerCase().trim();
          if (!type) {
            const nameLower = (row['Name'] || row['name'] || '').toLowerCase();
            if (nameLower.includes('ethanol') || nameLower.includes('eth')) type = 'ethanol';
            else if (nameLower.includes('fixative') || nameLower.includes('fix')) type = 'fixative';
            else if (nameLower.includes('oil')) type = 'oil';
            else type = 'oil';
          }

          return {
            name: row['Name'] || row['name'] || '',
            sku: row['Human-Friendly SKU'] || row['sku'] || row['SKU'] || '',
            type,
            purchases,
          };
        }).filter((item) => item.name && item.sku && item.purchases.length > 0);

        if (!items.length) {
          setUploadResult({
            success: false,
            message: 'No valid rows. Required: Name, Human-Friendly SKU, and at least one purchase (QTY1/PR1, etc.)',
          });
          setUploading(false);
          return;
        }

        const response = await API.post('/inventory/materials/import', { items });
        setUploadResult({ success: true, data: response.data });
        fetchMaterials();
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
        <h1 className="text-3xl font-bold">Raw Materials</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} /> Add Material
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock (ml)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Per ml Cost (৳)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Price (৳)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {materials.map((m) => {
                const perMlCost = m.avgCostPerMl || 0;
                const totalPrice = (m.currentStockMl || 0) * perMlCost;
                return (
                  <tr key={m._id}>
                    <td className="px-6 py-4">{m.name}</td>
                    <td className="px-6 py-4">{m.sku}</td>
                    <td className="px-6 py-4 capitalize">{m.type}</td>
                    <td className="px-6 py-4">{m.currentStockMl}</td>
                    <td className="px-6 py-4">{perMlCost.toFixed(2)}</td>
                    <td className="px-6 py-4">{totalPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleEditClick(m)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(m._id, m.name)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {materials.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">No materials found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Add Modal (unchanged) ---------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Add Raw Material</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={newMaterial.sku}
                  onChange={(e) => setNewMaterial({ ...newMaterial, sku: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newMaterial.type}
                  onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="oil">Oil</option>
                  <option value="ethanol">Ethanol</option>
                  <option value="fixative">Fixative</option>
                </select>
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

      {/* ---------- Updated Edit Modal ---------- */}
      {showEditModal && editingMaterial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4">Edit Material</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Editable fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingMaterial.name}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={editingMaterial.sku}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, sku: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={editingMaterial.type}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="oil">Oil</option>
                  <option value="ethanol">Ethanol</option>
                  <option value="fixative">Fixative</option>
                </select>
              </div>

              {/* Read-only fields – show current stock, cost, total */}
              <div className="border-t pt-4 mt-2">
                <p className="text-sm text-gray-500 mb-2">Inventory Details (read‑only)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Stock (ml)</span>
                    <p className="font-semibold">{editingMaterial.currentStockMl || 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Per ml Cost (৳)</span>
                    <p className="font-semibold">{(editingMaterial.avgCostPerMl || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Total Price (৳)</span>
                    <p className="font-semibold text-blue-600">
                      {((editingMaterial.currentStockMl || 0) * (editingMaterial.avgCostPerMl || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  * Stock and cost are updated via purchases and usage.
                </p>
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

      {/* ---------- Delete Confirmation (unchanged) ---------- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingName}</strong>? This action cannot be undone.
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

      {/* ---------- Upload Modal (unchanged) ---------- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative">
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
            <h2 className="text-2xl font-bold mb-2">Bulk Import Materials</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with columns:{' '}
              <strong>Name, Human-Friendly SKU, Type (optional), QTY1, PR1, QTY2, PR2, QTY3, PR3</strong>.
              <br />
              Type values: <em>oil, ethanol, fixative</em> – if missing, we try to guess from the name.
              <br />
              <span className="text-amber-600">Tip:</span> You can also use <strong>Total Quantity</strong> and{' '}
              <strong>Total Price</strong> if you don't have separate lots.
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
    </div>
  );
};

export default Materials;