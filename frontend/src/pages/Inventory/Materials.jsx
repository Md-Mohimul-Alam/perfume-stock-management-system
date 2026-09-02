import { useEffect, useState } from 'react';
import API from '../../api/axios';
import { Plus, Upload, X, CheckCircle, AlertCircle, Pencil, Trash2, Droplet, FlaskRound, Package, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const Materials = () => {
  // ---------- State ----------
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [oilSummary, setOilSummary] = useState({
    usedOilRollOn: 0,
    usedOilSpray: 0,
    totalOilStock: 0,
    availableOil: 0,
  });

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', sku: '', type: 'oil' });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    type: 'oil',
  });
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

  // ---------- Stock Out state ----------
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [stockOutMaterial, setStockOutMaterial] = useState(null);
  const [stockOutLoading, setStockOutLoading] = useState(false);

  // ---------- Fetch ----------
  useEffect(() => {
    fetchMaterialsAndSummary();
  }, []);

  const fetchMaterialsAndSummary = async () => {
    setLoading(true);
    try {
      const [materialsRes, salesRes, productsRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/sales'),
        API.get('/products'),
      ]);

      // ✅ Ensure we have arrays (defensive)
      const materialsData = Array.isArray(materialsRes.data) ? materialsRes.data : [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : [];
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];

      // If any is empty, log a warning (but continue)
      if (!materialsData.length) console.warn('No materials data received');
      if (!sales.length) console.warn('No sales data received');
      if (!products.length) console.warn('No products data received');

      // Build product map
      const productMap = {};
      products.forEach(p => {
        productMap[p._id] = p;
      });

      // Helper: parse blendComponents
      const parseBlendComponents = (product) => {
        const comps = product.blendComponents;
        if (!comps) return [];
        if (Array.isArray(comps)) {
          return comps
            .filter(c => c.material && c.percentage)
            .map(c => ({ material: c.material, percentage: c.percentage }));
        }
        const str = String(comps);
        const parts = str.split(';').map(s => s.trim());
        const parsed = [];
        for (const part of parts) {
          const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/);
          if (match) {
            const name = match[1].trim();
            const percentage = parseFloat(match[2]);
            parsed.push({ name, percentage });
          }
        }
        return parsed;
      };

      // Build material name -> id map
      const materialNameMap = {};
      materialsData.forEach(m => {
        materialNameMap[m.name?.toLowerCase()] = m._id;
      });

      // Compute usage per material
      const usageMap = {};

      for (const sale of sales) {
        if (!sale.items) continue;
        for (const item of sale.items) {
          const productId = item.product?._id || item.product;
          if (!productId) continue;
          const product = productMap[productId];
          if (!product) continue;

          const sizeMl = item.sizeMl || 0;
          const qty = item.quantity || 0;

          if (product.type === 'roll-on') {
            const oilId = product.baseOil?._id || product.baseOil;
            if (oilId) {
              const used = sizeMl * qty;
              usageMap[oilId] = (usageMap[oilId] || 0) + used;
            }
          } else if (product.type === 'spray') {
            const comps = parseBlendComponents(product);
            for (const comp of comps) {
              let materialId = comp.material?._id || comp.material;
              if (!materialId && comp.name) {
                const lowerName = comp.name.toLowerCase();
                materialId = materialNameMap[lowerName];
                if (!materialId) {
                  console.warn(`Material "${comp.name}" not found for product ${product.name}`);
                  continue;
                }
              }
              if (!materialId) continue;
              const percentage = comp.percentage || 0;
              if (percentage === 0) continue;
              const used = (sizeMl * (percentage / 100)) * qty;
              usageMap[materialId] = (usageMap[materialId] || 0) + used;
            }
          }
        }
      }

      // Preserve backend values for virtual rows
      const updatedMaterials = materialsData.map(m => {
        if (m._id === 'SR_SP_VIRTUAL' || m._id === 'LUXE1_SP_VIRTUAL') {
          return {
            ...m,
            usedOil: m.usedOil || 0,
            availableOil: m.availableOil || 0,
          };
        }
        const used = usageMap[m._id] || 0;
        return {
          ...m,
          usedOil: used,
          availableOil: m.currentStockMl || 0,
        };
      });
      setMaterials(updatedMaterials);

      // Compute summary (only oils)
      const oilMaterials = updatedMaterials.filter(m => m.type === 'oil');
      const totalOilStock = oilMaterials.reduce((sum, m) => sum + (m.currentStockMl || 0), 0);
      const totalAvailable = totalOilStock;

      let usedRollOn = 0;
      let usedSpray = 0;
      for (const sale of sales) {
        if (!sale.items) continue;
        for (const item of sale.items) {
          const productId = item.product?._id || item.product;
          if (!productId) continue;
          const product = productMap[productId];
          if (!product) continue;
          const sizeMl = item.sizeMl || 0;
          const qty = item.quantity || 0;
          if (product.type === 'roll-on') {
            usedRollOn += sizeMl * qty;
          } else if (product.type === 'spray') {
            const comps = parseBlendComponents(product);
            let sprayOilMl = 0;
            for (const comp of comps) {
              let materialId = comp.material?._id || comp.material;
              if (!materialId && comp.name) {
                const lowerName = comp.name.toLowerCase();
                materialId = materialNameMap[lowerName];
              }
              if (!materialId) continue;
              const mat = materialsData.find(m => m._id.toString() === materialId.toString());
              if (mat && mat.type === 'oil') {
                const percentage = comp.percentage || 0;
                sprayOilMl += (sizeMl * (percentage / 100));
              }
            }
            usedSpray += sprayOilMl * qty;
          }
        }
      }

      setOilSummary({
        usedOilRollOn: usedRollOn,
        usedOilSpray: usedSpray,
        totalOilStock,
        availableOil: totalAvailable,
      });

    } catch (error) {
      console.error('Failed to fetch data', error);
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  // ---------- CRUD ----------
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    try {
      await API.post('/inventory/materials', newMaterial);
      toast.success('Material added');
      setShowAddModal(false);
      fetchMaterialsAndSummary();
      setNewMaterial({ name: '', sku: '', type: 'oil' });
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create material');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (material) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      sku: material.sku,
      type: material.type,
    });
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
        name: editForm.name.trim(),
        sku: editForm.sku.trim(),
        type: editForm.type,
      });
      toast.success('Material updated');
      setShowEditModal(false);
      fetchMaterialsAndSummary();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteClick = (id, name) => {
    setDeletingId(id);
    setDeletingName(name);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await API.delete(`/inventory/materials/${deletingId}`);
      toast.success('Material deleted');
      setShowDeleteConfirm(false);
      fetchMaterialsAndSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
      setDeletingName('');
    }
  };

  // ---------- Stock Out handlers ----------
  const handleStockOutClick = (material) => {
    setStockOutMaterial(material);
    setShowStockOutModal(true);
  };

  const handleStockOutConfirm = async () => {
    if (!stockOutMaterial) return;
    setStockOutLoading(true);
    try {
      await API.post(`/inventory/materials/${stockOutMaterial._id}/stock-out`);
      toast.success(`Material "${stockOutMaterial.name}" marked as stock‑out.`);
      setShowStockOutModal(false);
      setStockOutMaterial(null);
      fetchMaterialsAndSummary();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Stock‑out failed');
    } finally {
      setStockOutLoading(false);
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
        fetchMaterialsAndSummary();
        setFile(null);
        toast.success('Materials imported');
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

      {/* Oil Summary Cards – Skeleton while loading */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Droplet size={14} className="text-amber-600" /> Oil Used (Roll-on)
              </p>
              <p className="text-2xl font-bold text-amber-700">{oilSummary.usedOilRollOn.toFixed(0)} ml</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <FlaskRound size={14} className="text-blue-600" /> Oil Used (Spray)
              </p>
              <p className="text-2xl font-bold text-blue-700">{oilSummary.usedOilSpray.toFixed(0)} ml</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Package size={14} className="text-green-600" /> Total Oil Stock
              </p>
              <p className="text-2xl font-bold text-green-700">{oilSummary.totalOilStock.toFixed(0)} ml</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Droplet size={14} className="text-purple-600" /> Available Oil
              </p>
              <p className={`text-2xl font-bold ${oilSummary.availableOil < 0 ? 'text-red-600' : 'text-purple-700'}`}>
                {oilSummary.availableOil.toFixed(0)} ml
              </p>
            </div>
          </>
        )}
      </div>

      {/* Table – with formal loader */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading materials...</p>
          </div>
        </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Purchases (৳)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Used Oil (ml)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available Oil (ml)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {materials.map((m) => {
                const perMlCost = m.avgCostPerMl || 0;
                const totalPrice = (m.currentStockMl || 0) * perMlCost;
                const totalPurchaseCost = m.totalPurchaseCost || 0;
                const used = m.usedOil || 0;
                const available = m.availableOil || 0;
                const isVirtual = m._id && m._id.includes('_VIRTUAL');

                return (
                  <tr key={m._id}>
                    <td className="px-6 py-4">{m.name}</td>
                    <td className="px-6 py-4">{m.sku}</td>
                    <td className="px-6 py-4 capitalize">{m.type}</td>
                    <td className="px-6 py-4">{m.currentStockMl}</td>
                    <td className="px-6 py-4">{perMlCost.toFixed(2)}</td>
                    <td className="px-6 py-4">{totalPrice.toFixed(2)}</td>
                    <td className="px-6 py-4">{totalPurchaseCost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-amber-600">{used.toFixed(0)}</td>
                    <td className={`px-6 py-4 font-semibold ${available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {available.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {m.isStockOut ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                          Stock Out
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleEditClick(m)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(m._id, m.name)}
                        className="text-red-600 hover:text-red-800 mr-2"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                      {!isVirtual && (
                        <button
                          onClick={() => handleStockOutClick(m)}
                          className="text-red-600 hover:text-red-800"
                          title="Stock Out"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {materials.length === 0 && (
                <tr>
                  <td colSpan="11" className="text-center py-8 text-gray-500">No materials found</td>
                </tr>
              )}
            </tbody>
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
            <h2 className="text-2xl font-bold mb-4">Add Raw Material</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
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

      {/* ---------- Edit Modal ---------- */}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input
                  type="text"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="oil">Oil</option>
                  <option value="ethanol">Ethanol</option>
                  <option value="fixative">Fixative</option>
                </select>
              </div>

              {/* Read-only inventory summary */}
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
                <p className="text-xs text-gray-400 mt-2">* Stock and cost are updated via purchases and usage.</p>
              </div>

              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSubmitting ? 'Updating...' : 'Update Material'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
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

      {/* ---------- Stock Out Confirmation Modal ---------- */}
      {showStockOutModal && stockOutMaterial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">Stock Out Material</h3>
            <p className="text-gray-600 mb-2">
              You are about to mark <strong>{stockOutMaterial.name}</strong> as <strong>Stock Out</strong>.
            </p>
            {stockOutMaterial.currentStockMl > 0 ? (
              <p className="text-amber-600 text-sm mb-4">
                ⚠️ There is <strong>{stockOutMaterial.currentStockMl} ml</strong> remaining.
                This will be recorded as <strong>Wastage</strong> and removed from inventory.
              </p>
            ) : (
              <p className="text-gray-500 text-sm mb-4">
                This item is already out of stock. Marking it as stock‑out will confirm it's currently unavailable.
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowStockOutModal(false); setStockOutMaterial(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStockOutConfirm}
                disabled={stockOutLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {stockOutLoading ? 'Processing...' : 'Confirm Stock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Upload Modal ---------- */}
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