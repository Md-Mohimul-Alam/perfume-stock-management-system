import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { 
  Plus, Search, Eye, Edit, Trash2, 
  Package, Droplet, Filter, Calendar,
  X, CheckCircle, AlertCircle, Upload
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

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Stat summary
  const [summary, setSummary] = useState({
    totalMaterialCost: 0,
    totalBottleCost: 0,
    grandTotal: 0,
  });

  useEffect(() => {
    fetchPurchases();
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

  const viewDetails = async (id) => {
    try {
      const { data } = await API.get(`/purchases/${id}`);
      setSelectedPurchase(data);
      setShowDetailsModal(true);
    } catch (error) {
      toast.error('Failed to load purchase details');
    }
  };

  // ---------- UPLOAD ----------
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

        // Required columns
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

        // Validate required
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

        // Group by invoice (or create individual)
        const purchasesMap = new Map();
        const timestamp = Date.now();

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
              // fallback: check if SKU starts with 'BTL' or 'MAT' – but we'll just warn
              const sku = String(row[requiredCols.itemSKU]).trim().toUpperCase();
              if (sku.startsWith('BTL')) itemType = 'Bottle';
              else itemType = 'RawMaterial';
            }

            const sku = String(row[requiredCols.itemSKU]).trim();
            const quantity = parseFloat(row[requiredCols.quantity]);
            const costPerUnit = parseFloat(row[requiredCols.costPerUnit]);

            if (!sku || isNaN(quantity) || quantity <= 0 || isNaN(costPerUnit) || costPerUnit <= 0) {
              throw new Error(`Row ${idx+1}: Invalid SKU, quantity, or cost`);
            }

            // Find the item (material or bottle) by SKU
            let itemId = null;
            if (itemType === 'RawMaterial') {
              const material = await API.get(`/inventory/materials?sku=${sku}`).then(res => res.data[0]);
              if (material) itemId = material._id;
            } else {
              const bottle = await API.get(`/inventory/bottles?sku=${sku}`).then(res => res.data[0]);
              if (bottle) itemId = bottle._id;
            }
            if (!itemId) {
              throw new Error(`Row ${idx+1}: Item not found for SKU "${sku}"`);
            }

            const totalCost = quantity * costPerUnit;

            // Determine invoice
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
            setUploadResult({ success: false, message: err.message });
            setUploading(false);
            return;
          }
        }

        const purchasesArray = Array.from(purchasesMap.values()).filter(p => p.items.length > 0);
        if (!purchasesArray.length) {
          setUploadResult({ success: false, message: 'No valid rows found' });
          setUploading(false);
          return;
        }

        // Calculate totals and send to backend
        const response = await API.post('/purchases/bulk', { purchases: purchasesArray });
        setUploadResult({ success: true, data: response.data });
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

  // Filtering
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
      filtered = filtered.filter(p => 
        p.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier?.toLowerCase().includes(search.toLowerCase())
      );
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Purchase History</h1>
          <p className="text-gray-500 text-sm">Track all raw material and bottle purchases</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition shadow-md shadow-green-500/30"
          >
            <Upload size={18} /> Upload Purchases
          </button>
          <Link
            to="/purchases/new"
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30"
          >
            <Plus size={18} /> New Purchase
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Raw Materials Cost</p>
          <p className="text-2xl font-bold text-amber-600">৳{summary.totalMaterialCost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Bottles Cost</p>
          <p className="text-2xl font-bold text-blue-600">৳{summary.totalBottleCost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Purchase Cost</p>
          <p className="text-2xl font-bold text-green-600">৳{summary.grandTotal.toFixed(2)}</p>
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
              placeholder="Invoice or Supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
          <select
            value={filter.itemType}
            onChange={(e) => setFilter({ ...filter, itemType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="">All</option>
            <option value="RawMaterial">Raw Materials</option>
            <option value="Bottle">Bottles</option>
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <select
            value={filter.supplier}
            onChange={(e) => setFilter({ ...filter, supplier: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <button
          onClick={() => { setFilter({ itemType: '', supplier: '' }); setSearch(''); setDateRange({ start: '', end: '' }); }}
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
            <p className="text-gray-500 mt-4">Loading purchases...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total (৳)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                    <td className="px-6 py-4 font-medium text-gray-800">{purchase.invoiceNo}</td>
                    <td className="px-6 py-4">{purchase.supplier || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        typeLabel === 'Raw Material' ? 'bg-amber-100 text-amber-700' :
                        typeLabel === 'Bottle' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-amber-600">
                      ৳{purchase.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(purchase.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => viewDetails(purchase._id)}
                        className="text-blue-600 hover:text-blue-800 transition"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
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

      {/* ---------- Details Modal (same as before, omitted for brevity) ---------- */}
      {/* ... (keep existing details modal) ... */}

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
            <h2 className="text-2xl font-bold mb-2">Bulk Upload Purchases</h2>
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

export default PurchaseList;