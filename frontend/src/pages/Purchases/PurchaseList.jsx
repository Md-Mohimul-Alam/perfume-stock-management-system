import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import {
  Plus, Search, Eye, Edit, Trash2,
  Package, Droplet, Filter, Calendar,
  X, CheckCircle, AlertCircle, Upload,
  PlusCircle, MinusCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const PurchaseList = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ itemType: '', supplier: '' });
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [editForm, setEditForm] = useState({
    supplier: '',
    purchaseDate: '',
    notes: '',
    items: []
  });
  const [editLoading, setEditLoading] = useState(false);

  // All items for search & edit
  const [allMaterials, setAllMaterials] = useState([]);
  const [allBottles, setAllBottles] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Summary
  const [summary, setSummary] = useState({
    totalMaterialCost: 0,
    totalBottleCost: 0,
    grandTotal: 0,
  });

  // ---------- Fetch ----------
  useEffect(() => {
    fetchPurchases();
    fetchItems();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/purchases');
      setPurchases(data);

      let materialCost = 0;
      let bottleCost = 0;
      data.forEach(p => {
        p.items.forEach(item => {
          if (item.itemType === 'RawMaterial') materialCost += item.totalCost;
          else if (item.itemType === 'Bottle') bottleCost += item.totalCost;
        });
      });
      setSummary({
        totalMaterialCost: materialCost,
        totalBottleCost: bottleCost,
        grandTotal: materialCost + bottleCost,
      });
    } catch (error) {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const [materialsRes, bottlesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles')
      ]);
      setAllMaterials(materialsRes.data);
      setAllBottles(bottlesRes.data);
    } catch (error) {
      console.error('Failed to load items for search', error);
    } finally {
      setItemsLoading(false);
    }
  };

  // ---------- Helper: get item label for search ----------
  const getItemSearchLabel = (itemType, itemId) => {
    if (itemType === 'RawMaterial') {
      const mat = allMaterials.find(m => m._id === itemId);
      return mat ? mat.sku : null;
    } else if (itemType === 'Bottle') {
      const bot = allBottles.find(b => b._id === itemId);
      return bot ? `${bot.sizeMl}ml ${bot.type}` : null;
    }
    return null;
  };

  // ---------- View / Edit / Delete ----------
  const viewDetails = async (id) => {
    try {
      const { data } = await API.get(`/purchases/${id}`);
      setSelectedPurchase(data);
      setShowDetailsModal(true);
    } catch (error) {
      toast.error('Failed to load purchase details');
    }
  };

  const openEditModal = async (purchase) => {
    try {
      const [materialsRes, bottlesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles')
      ]);
      setAllMaterials(materialsRes.data);
      setAllBottles(bottlesRes.data);
    } catch (err) {
      toast.error('Failed to load inventory for item selection');
    }

    setEditingPurchase(purchase);
    setEditForm({
      supplier: purchase.supplier || '',
      purchaseDate: new Date(purchase.purchaseDate).toISOString().split('T')[0],
      notes: purchase.notes || '',
      items: purchase.items.map(item => ({
        _id: item._id,
        itemType: item.itemType,
        itemId: item.item?._id || item.item,
        quantity: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
      }))
    });
    setShowEditModal(true);
  };

  const addEditItem = () => {
    setEditForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          _id: null,
          itemType: 'RawMaterial',
          itemId: '',
          quantity: 1,
          costPerUnit: 0,
          totalCost: 0,
        }
      ]
    }));
  };

  const removeEditItem = (index) => {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateEditItem = (index, field, value) => {
    const newItems = [...editForm.items];
    const item = newItems[index];

    if (field === 'itemType') {
      item.itemType = value;
      item.itemId = '';
      item.costPerUnit = 0;
      item.totalCost = 0;
    } else if (field === 'itemId') {
      item.itemId = value;
    } else if (field === 'quantity' || field === 'costPerUnit') {
      item[field] = parseFloat(value) || 0;
      item.totalCost = item.quantity * item.costPerUnit;
    }
    setEditForm(prev => ({ ...prev, items: newItems }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPurchase) return;

    for (let i = 0; i < editForm.items.length; i++) {
      const item = editForm.items[i];
      if (!item.itemId) {
        toast.error(`Row ${i+1}: Please select a valid item.`);
        return;
      }
      if (item.quantity <= 0 || item.costPerUnit <= 0) {
        toast.error(`Row ${i+1}: Quantity and cost must be positive.`);
        return;
      }
    }

    setEditLoading(true);
    try {
      const payload = {
        supplier: editForm.supplier,
        purchaseDate: editForm.purchaseDate,
        notes: editForm.notes,
        items: editForm.items.map(item => ({
          itemType: item.itemType,
          item: item.itemId,
          quantity: item.quantity,
          costPerUnit: item.costPerUnit,
          totalCost: item.quantity * item.costPerUnit,
        }))
      };
      await API.put(`/purchases/${editingPurchase._id}`, payload);
      toast.success('Purchase updated successfully');
      setShowEditModal(false);
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id, invoiceNo) => {
    if (!window.confirm(`Delete purchase ${invoiceNo}? This will reverse stock.`)) return;
    try {
      await API.delete(`/purchases/${id}`);
      toast.success('Purchase deleted and stock reversed');
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  // ---------- Upload ----------
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

        const requiredCols = {
          itemType: findCol(['item type', 'type', 'material type']),
          itemSKU: findCol(['sku', 'item sku', 'product sku']),
          quantity: findCol(['quantity', 'qty', 'units']),
          costPerUnit: findCol(['cost per unit', 'unit cost', 'price', 'cost']),
          invoice: findCol(['invoice', 'invoice no', 'invoiceno']),
          supplier: findCol(['supplier', 'vendor']),
          date: findCol(['date', 'purchase date']),
          notes: findCol(['notes', 'remark']),
        };

        const required = ['itemType', 'itemSKU', 'quantity', 'costPerUnit'];
        const missing = required.filter(k => !requiredCols[k]);
        if (missing.length) {
          setUploadResult({
            success: false,
            message: `Missing columns: ${missing.join(', ')}. Found: ${columns.join(', ')}`,
          });
          setUploading(false);
          return;
        }

        const [allMats, allBots] = await Promise.all([
          API.get('/inventory/materials'),
          API.get('/inventory/bottles')
        ]);
        const materialMap = {};
        allMats.data.forEach(m => { materialMap[m.sku] = m._id; });
        const bottleMap = {};
        allBots.data.forEach(b => { bottleMap[b.sku] = b._id; });

        const purchasesMap = new Map();
        const timestamp = Date.now();
        const errors = [];

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          try {
            const itemTypeRaw = String(row[requiredCols.itemType]).trim().toLowerCase();
            let itemType = 'RawMaterial';
            if (itemTypeRaw.includes('bottle') || itemTypeRaw.includes('glass')) {
              itemType = 'Bottle';
            } else if (itemTypeRaw.includes('oil') || itemTypeRaw.includes('material') || itemTypeRaw.includes('raw')) {
              itemType = 'RawMaterial';
            } else {
              const sku = String(row[requiredCols.itemSKU]).trim().toUpperCase();
              if (sku.startsWith('BTL')) itemType = 'Bottle';
              else itemType = 'RawMaterial';
            }

            const sku = String(row[requiredCols.itemSKU]).trim();
            const quantity = parseFloat(row[requiredCols.quantity]);
            const costPerUnit = parseFloat(row[requiredCols.costPerUnit]);

            if (!sku || isNaN(quantity) || quantity <= 0 || isNaN(costPerUnit) || costPerUnit <= 0) {
              errors.push(`Row ${idx+1}: Invalid SKU, quantity, or cost`);
              continue;
            }

            let itemId = null;
            if (itemType === 'RawMaterial') {
              itemId = materialMap[sku];
            } else {
              itemId = bottleMap[sku];
            }
            if (!itemId) {
              errors.push(`Row ${idx+1}: Item not found for SKU "${sku}"`);
              continue;
            }

            const totalCost = quantity * costPerUnit;

            let invoice = String(row[requiredCols.invoice] || '').trim();
            if (!invoice) {
              invoice = `PUR-${timestamp}-${String(idx+1).padStart(3, '0')}`;
            }

            if (!purchasesMap.has(invoice)) {
              purchasesMap.set(invoice, {
                invoiceNo: invoice,
                supplier: requiredCols.supplier ? String(row[requiredCols.supplier]).trim() : '',
                purchaseDate: requiredCols.date ? new Date(row[requiredCols.date]) : new Date(),
                notes: requiredCols.notes ? String(row[requiredCols.notes]).trim() : '',
                items: [],
              });
            }

            const purchase = purchasesMap.get(invoice);
            purchase.items.push({
              itemType,
              item: itemId,
              quantity,
              costPerUnit,
              totalCost,
            });
          } catch (err) {
            errors.push(`Row ${idx+1}: ${err.message}`);
          }
        }

        const purchasesArray = Array.from(purchasesMap.values()).filter(p => p.items.length > 0);
        if (!purchasesArray.length) {
          setUploadResult({
            success: false,
            message: `No valid rows. Errors: ${errors.join('; ')}`,
          });
          setUploading(false);
          return;
        }

        const response = await API.post('/purchases/bulk', { purchases: purchasesArray });
        setUploadResult({
          success: true,
          data: response.data,
          errors: errors,
        });
        fetchPurchases();
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

  // ---------- Filtering (with SKU search) ----------
  const getFilteredPurchases = () => {
    let filtered = purchases;

    if (filter.itemType) {
      filtered = filtered.filter(p =>
        p.items.some(item => item.itemType === filter.itemType)
      );
    }
    if (filter.supplier) {
      filtered = filtered.filter(p =>
        p.supplier?.toLowerCase().includes(filter.supplier.toLowerCase())
      );
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(p => {
        // Check invoice and supplier
        const invoiceMatch = p.invoiceNo.toLowerCase().includes(lowerSearch);
        const supplierMatch = p.supplier?.toLowerCase().includes(lowerSearch);
        if (invoiceMatch || supplierMatch) return true;

        // Check each item's SKU (for materials) or size+type (for bottles)
        return p.items.some(item => {
          const label = getItemSearchLabel(item.itemType, item.item);
          if (!label) return false;
          return label.toLowerCase().includes(lowerSearch);
        });
      });
    }
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(p => {
        const d = new Date(p.purchaseDate);
        return d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
      });
    }
    return filtered;
  };

  const filteredPurchases = getFilteredPurchases();
  const suppliers = [...new Set(purchases.map(p => p.supplier).filter(Boolean))];

  const getItemDisplayName = (itemType, itemId) => {
    if (itemType === 'RawMaterial') {
      const mat = allMaterials.find(m => m._id === itemId);
      return mat ? mat.name : 'Unknown';
    } else {
      const bot = allBottles.find(b => b._id === itemId);
      return bot ? `${bot.sizeMl}ml (${bot.type})` : 'Unknown';
    }
  };

  // ----- RENDER -----
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Purchase History</h1>
          <p className="text-gray-500 text-sm">Track all raw material and bottle purchases</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg hover:bg-green-700 transition shadow-md shadow-green-500/30 text-sm"
          >
            <Upload size={18} /> Upload Purchases
          </button>
          <Link
            to="/purchases/new"
            className="flex items-center gap-2 bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30 text-sm"
          >
            <Plus size={18} /> New Purchase
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Raw Materials Cost</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">৳{summary.totalMaterialCost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Bottles Cost</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">৳{summary.totalBottleCost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Purchase Cost</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">৳{summary.grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6 flex flex-wrap items-end gap-3 sm:gap-4">
        <div className="flex-1 min-w-[180px] sm:min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Invoice, Supplier or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
          <select
            value={filter.itemType}
            onChange={(e) => setFilter({ ...filter, itemType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
          >
            <option value="">All</option>
            <option value="RawMaterial">Raw Materials</option>
            <option value="Bottle">Bottles</option>
          </select>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <select
            value={filter.supplier}
            onChange={(e) => setFilter({ ...filter, supplier: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
        </div>

        <button
          onClick={() => { setFilter({ itemType: '', supplier: '' }); setSearch(''); setDateRange({ start: '', end: '' }); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm whitespace-nowrap"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading purchases...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total (৳)</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPurchases.map((purchase) => {
                const hasMaterial = purchase.items.some(i => i.itemType === 'RawMaterial');
                const hasBottle = purchase.items.some(i => i.itemType === 'Bottle');
                let typeLabel = '';
                if (hasMaterial && hasBottle) typeLabel = 'Mixed';
                else if (hasMaterial) typeLabel = 'Raw Material';
                else if (hasBottle) typeLabel = 'Bottle';
                else typeLabel = 'Unknown';
                return (
                  <tr key={purchase._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-gray-800 text-sm">{purchase.invoiceNo}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm">{purchase.supplier || '-'}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        typeLabel === 'Raw Material' ? 'bg-amber-100 text-amber-700' :
                        typeLabel === 'Bottle' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-semibold text-amber-600 text-sm">
                      ৳{purchase.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-gray-600 text-sm whitespace-nowrap">
                      {new Date(purchase.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex justify-center items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => viewDetails(purchase._id)}
                          className="text-blue-600 hover:text-blue-800 transition p-1"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => openEditModal(purchase)}
                          className="text-amber-600 hover:text-amber-800 transition p-1"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(purchase._id, purchase.invoiceNo)}
                          className="text-red-600 hover:text-red-800 transition p-1"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    No purchases found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Details Modal ---------- */}
      {showDetailsModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <button
              onClick={() => { setShowDetailsModal(false); setSelectedPurchase(null); }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800">Purchase Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Invoice</p>
                <p className="font-semibold">{selectedPurchase.invoiceNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-semibold">{selectedPurchase.supplier || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-semibold">{new Date(selectedPurchase.purchaseDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">৳{selectedPurchase.totalAmount.toFixed(2)}</p>
              </div>
              {selectedPurchase.notes && (
                <div className="col-span-1 sm:col-span-2">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{selectedPurchase.notes}</p>
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-700 mb-3">Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedPurchase.items.map((item, idx) => {
                    const itemName = item.item?.sizeMl
                      ? `${item.item.sizeMl}ml (${item.item.type})`
                      : (item.item?.name || item.item?.sku || 'Unknown');
                    const unit = item.itemType === 'RawMaterial' ? 'ml' : 'pcs';
                    return (
                      <tr key={idx}>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.itemType === 'RawMaterial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.itemType === 'RawMaterial' ? 'Oil' : 'Bottle'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm">{itemName}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm">{item.quantity} {unit}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm">৳{item.costPerUnit.toFixed(2)}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-sm">৳{item.totalCost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- EDIT MODAL ---------- */}
      {showEditModal && editingPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Edit Purchase</h2>
            <p className="text-gray-500 text-sm mb-4">
              Update supplier, date, notes, and items. Changing items will adjust stock accordingly.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
                  <input
                    type="text"
                    value={editingPurchase.invoiceNo}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={editForm.purchaseDate}
                    onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Items</label>
                  <button
                    type="button"
                    onClick={addEditItem}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <PlusCircle size={16} /> Add Item
                  </button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-2 sm:px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editForm.items.map((item, index) => {
                        const options = item.itemType === 'RawMaterial'
                          ? allMaterials.map(m => ({ value: m._id, label: m.name || m.sku || 'Unknown' }))
                          : allBottles.map(b => ({ value: b._id, label: b.sizeMl ? `${b.sizeMl}ml Bottle` : (b.name || b.sku || 'Unknown') }));
                        return (
                          <tr key={index}>
                            <td className="px-2 sm:px-3 py-2">
                              <select
                                value={item.itemType}
                                onChange={(e) => updateEditItem(index, 'itemType', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="RawMaterial">Oil</option>
                                <option value="Bottle">Bottle</option>
                              </select>
                            </td>
                            <td className="px-2 sm:px-3 py-2">
                              <select
                                value={item.itemId}
                                onChange={(e) => updateEditItem(index, 'itemId', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="">Select {item.itemType === 'RawMaterial' ? 'Oil' : 'Bottle'}</option>
                                {options.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 sm:px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(index, 'quantity', e.target.value)}
                                min="0.01"
                                step="0.01"
                                className="w-16 sm:w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-2 sm:px-3 py-2">
                              <input
                                type="number"
                                value={item.costPerUnit}
                                onChange={(e) => updateEditItem(index, 'costPerUnit', e.target.value)}
                                min="0.01"
                                step="0.01"
                                className="w-20 sm:w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-right font-semibold text-sm">
                              ৳{(item.quantity * item.costPerUnit).toFixed(2)}
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeEditItem(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <MinusCircle size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {editForm.items.length === 0 && (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-gray-400 text-sm">
                            No items added. Click "Add Item" to include items.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-full sm:flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- UPLOAD MODAL ---------- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadResult(null);
                setUploadFile(null);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Bulk Upload Purchases</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with purchase data. Supports grouping by invoice.
              <br />
              <span className="text-amber-600">Required columns:</span>
              {' Item Type, SKU, Quantity, Cost Per Unit'}
              <br />
              <span className="text-gray-400">Optional:</span>
              {' Invoice, Supplier, Date, Notes'}
              <br />
              <span className="text-xs text-gray-400">
                If no Invoice column, each row becomes a separate purchase with auto-generated invoice.
              </span>
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full border rounded-lg p-2 text-sm"
                  required
                />
              </div>

              {uploadResult && (
                <div
                  className={`p-3 rounded-lg text-sm ${
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
                              {uploadResult.data.errors.map((e, i) => {
                                let errorMessage = '';
                                let context = '';
                                if (typeof e === 'string') {
                                  errorMessage = e;
                                } else if (e && typeof e === 'object') {
                                  errorMessage = e.error || e.message || JSON.stringify(e);
                                  context = e.purchaseData?.invoiceNo || e.purchaseData?.supplier || '';
                                } else {
                                  errorMessage = String(e);
                                }
                                return (
                                  <li key={i} className="text-red-600">
                                    • {errorMessage}
                                    {context && <span className="text-gray-400 ml-1">(Invoice: {context})</span>}
                                  </li>
                                );
                              })}
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="w-full sm:flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
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
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
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

export default PurchaseList;