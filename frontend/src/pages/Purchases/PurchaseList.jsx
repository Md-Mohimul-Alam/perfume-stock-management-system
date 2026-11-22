
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import {
  Plus, Search, Eye, Edit, Trash2, X,
  CheckCircle, AlertCircle, Upload,
  PlusCircle, MinusCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const PurchaseList = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState({
    itemType: '',
    supplier: ''
  });

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

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

  // Inventory items
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
    grandTotal: 0
  });

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const getId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') {
      return String(value._id || value.id || '');
    }
    return String(value);
  };

  const normalizeSKU = (value) => {
    return String(value || '').trim().toUpperCase();
  };

  const normalizeColumn = (value) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const formatMoney = (value) => {
    return toNumber(value).toFixed(2);
  };

  const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString();
  };

  const getDateInputValue = (value) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const getSpreadsheetDate = (value) => {
    if (!value) return new Date();

    // Excel serial date
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);

      if (parsed) {
        return new Date(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H || 0,
          parsed.M || 0,
          parsed.S || 0
        );
      }

      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getItemSearchLabel = (itemType, itemId) => {
    const id = getId(itemId);

    if (itemType === 'RawMaterial') {
      const material = allMaterials.find(
        item => getId(item._id) === id
      );

      return material
        ? `${material.sku || ''} ${material.name || ''}`.trim()
        : '';
    }

    if (itemType === 'Bottle') {
      const bottle = allBottles.find(
        item => getId(item._id) === id
      );

      return bottle
        ? `${bottle.sku || ''} ${bottle.sizeMl || ''}ml ${bottle.type || ''}`.trim()
        : '';
    }

    return '';
  };

  const getItemDisplayName = (itemType, item) => {
    if (item && typeof item === 'object') {
      if (item.sizeMl) {
        return `${item.sizeMl}ml (${item.type || 'Bottle'})`;
      }

      return item.name || item.sku || 'Unknown';
    }

    const id = getId(item);

    if (itemType === 'RawMaterial') {
      const material = allMaterials.find(
        material => getId(material._id) === id
      );

      return material?.name || material?.sku || 'Unknown';
    }

    const bottle = allBottles.find(
      bottle => getId(bottle._id) === id
    );

    return bottle
      ? `${bottle.sizeMl}ml (${bottle.type || 'Bottle'})`
      : 'Unknown';
  };

  const calculateSummary = (data) => {
    let materialCost = 0;
    let bottleCost = 0;

    (Array.isArray(data) ? data : []).forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const cost = toNumber(item.totalCost);

        if (item.itemType === 'RawMaterial') {
          materialCost += cost;
        } else if (item.itemType === 'Bottle') {
          bottleCost += cost;
        }
      });
    });

    setSummary({
      totalMaterialCost: materialCost,
      totalBottleCost: bottleCost,
      grandTotal: materialCost + bottleCost
    });
  };

  // --------------------------------------------------
  // Fetch purchases and inventory
  // --------------------------------------------------

  const fetchPurchases = async () => {
    setLoading(true);

    try {
      const { data } = await API.get('/purchases');

      const purchaseData = Array.isArray(data) ? data : [];

      setPurchases(purchaseData);
      calculateSummary(purchaseData);
    } catch (error) {
      console.error('Failed to load purchases:', error);
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

      setAllMaterials(
        Array.isArray(materialsRes.data) ? materialsRes.data : []
      );

      setAllBottles(
        Array.isArray(bottlesRes.data) ? bottlesRes.data : []
      );
    } catch (error) {
      console.error('Failed to load inventory items:', error);
      toast.error('Failed to load inventory items');
    } finally {
      setItemsLoading(false);
    }
  };

  const refreshData = async () => {
    await Promise.all([
      fetchPurchases(),
      fetchItems()
    ]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // --------------------------------------------------
  // View purchase details
  // --------------------------------------------------

  const viewDetails = async (id) => {
    try {
      const { data } = await API.get(`/purchases/${id}`);

      setSelectedPurchase(data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Failed to load purchase details:', error);
      toast.error('Failed to load purchase details');
    }
  };

  // --------------------------------------------------
  // Edit purchase
  // --------------------------------------------------

  const openEditModal = async (purchase) => {
    try {
      const [materialsRes, bottlesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles')
      ]);

      setAllMaterials(
        Array.isArray(materialsRes.data) ? materialsRes.data : []
      );

      setAllBottles(
        Array.isArray(bottlesRes.data) ? bottlesRes.data : []
      );
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast.error('Failed to load inventory for item selection');
      return;
    }

    setEditingPurchase(purchase);

    setEditForm({
      supplier: purchase.supplier || '',
      purchaseDate: getDateInputValue(purchase.purchaseDate),
      notes: purchase.notes || '',

      items: (purchase.items || []).map(item => ({
        _id: item._id || null,
        itemType: item.itemType,
        itemId: getId(item.item),
        quantity: toNumber(item.quantity),
        costPerUnit: toNumber(item.costPerUnit),
        totalCost: toNumber(item.totalCost)
      }))
    });

    setShowEditModal(true);
  };

  const addEditItem = () => {
    setEditForm(previous => ({
      ...previous,
      items: [
        ...previous.items,
        {
          _id: null,
          itemType: 'RawMaterial',
          itemId: '',
          quantity: 1,
          costPerUnit: 0,
          totalCost: 0
        }
      ]
    }));
  };

  const removeEditItem = (index) => {
    setEditForm(previous => ({
      ...previous,
      items: previous.items.filter((_, i) => i !== index)
    }));
  };

  const updateEditItem = (index, field, value) => {
    setEditForm(previous => {
      const newItems = [...previous.items];
      const item = { ...newItems[index] };

      if (field === 'itemType') {
        item.itemType = value;
        item.itemId = '';
        item.costPerUnit = 0;
        item.totalCost = 0;
      } else if (field === 'itemId') {
        item.itemId = value;
      } else if (field === 'quantity' || field === 'costPerUnit') {
        item[field] = value === '' ? '' : Math.max(0, Number(value));

        const quantity = toNumber(item.quantity);
        const cost = toNumber(item.costPerUnit);

        item.totalCost = quantity * cost;
      }

      newItems[index] = item;

      return {
        ...previous,
        items: newItems
      };
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!editingPurchase) return;

    if (!editForm.purchaseDate) {
      toast.error('Please select a purchase date');
      return;
    }

    if (!editForm.items.length) {
      toast.error('A purchase must contain at least one item');
      return;
    }

    for (let index = 0; index < editForm.items.length; index++) {
      const item = editForm.items[index];

      if (!item.itemId) {
        toast.error(`Row ${index + 1}: Please select an item`);
        return;
      }

      if (
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        toast.error(`Row ${index + 1}: Quantity must be positive`);
        return;
      }

      if (
        !Number.isFinite(Number(item.costPerUnit)) ||
        Number(item.costPerUnit) <= 0
      ) {
        toast.error(`Row ${index + 1}: Cost per unit must be positive`);
        return;
      }
    }

    setEditLoading(true);

    try {
      const payload = {
        supplier: editForm.supplier.trim(),
        purchaseDate: editForm.purchaseDate,
        notes: editForm.notes.trim(),

        items: editForm.items.map(item => ({
          itemType: item.itemType,
          item: item.itemId,
          quantity: Number(item.quantity),
          costPerUnit: Number(item.costPerUnit),
          totalCost:
            Number(item.quantity) * Number(item.costPerUnit)
        }))
      };

      await API.put(
        `/purchases/${editingPurchase._id}`,
        payload
      );

      toast.success('Purchase updated successfully');

      setShowEditModal(false);
      setEditingPurchase(null);

      await refreshData();
    } catch (error) {
      console.error('Purchase update failed:', error);

      toast.error(
        error.response?.data?.message || 'Update failed'
      );
    } finally {
      setEditLoading(false);
    }
  };

  // --------------------------------------------------
  // Delete purchase
  // --------------------------------------------------

  const handleDelete = async (id, invoiceNo) => {
    const confirmed = window.confirm(
      `Delete purchase ${invoiceNo}? This will reverse stock.`
    );

    if (!confirmed) return;

    try {
      await API.delete(`/purchases/${id}`);

      toast.success('Purchase deleted and stock reversed');

      await refreshData();
    } catch (error) {
      console.error('Purchase deletion failed:', error);

      toast.error(
        error.response?.data?.message || 'Delete failed'
      );
    }
  };

  // --------------------------------------------------
  // Excel / CSV upload
  // --------------------------------------------------

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setUploadFile(null);
      return;
    }

    const allowedExtensions = /\.(csv|xlsx|xls)$/i;

    if (!allowedExtensions.test(file.name)) {
      toast.error('Please select a CSV or Excel file');
      event.target.value = '';
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
    setUploadResult(null);
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(
        new Error('Unable to read the selected file')
      );

      reader.readAsArrayBuffer(file);
    });
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();

    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const fileBuffer = await readFileAsArrayBuffer(uploadFile);

      const workbook = XLSX.read(fileBuffer, {
        type: 'array',
        cellDates: true
      });

      if (!workbook.SheetNames.length) {
        throw new Error('The uploaded file contains no worksheets');
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: true
      });

      if (!rows.length) {
        throw new Error('File is empty');
      }

      const columns = Object.keys(rows[0]);

      const findCol = (possibleNames) => {
        for (const name of possibleNames) {
          const found = columns.find(
            column =>
              normalizeColumn(column) === normalizeColumn(name)
          );

          if (found) return found;
        }

        return null;
      };

      const columnMap = {
        itemType: findCol([
          'item type',
          'type',
          'material type'
        ]),

        itemSKU: findCol([
          'sku',
          'item sku',
          'product sku'
        ]),

        quantity: findCol([
          'quantity',
          'qty',
          'units'
        ]),

        costPerUnit: findCol([
          'cost per unit',
          'unit cost',
          'price',
          'cost'
        ]),

        invoice: findCol([
          'invoice',
          'invoice no',
          'invoiceno'
        ]),

        supplier: findCol([
          'supplier',
          'vendor'
        ]),

        date: findCol([
          'date',
          'purchase date'
        ]),

        notes: findCol([
          'notes',
          'remark'
        ])
      };

      const requiredColumns = [
        'itemType',
        'itemSKU',
        'quantity',
        'costPerUnit'
      ];

      const missingColumns = requiredColumns.filter(
        key => !columnMap[key]
      );

      if (missingColumns.length) {
        throw new Error(
          `Missing columns: ${missingColumns.join(', ')}. ` +
          `Found: ${columns.join(', ')}`
        );
      }

      const [materialsRes, bottlesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles')
      ]);

      const materialMap = new Map();
      const bottleMap = new Map();

      (materialsRes.data || []).forEach(material => {
        const sku = normalizeSKU(material.sku);

        if (sku) {
          materialMap.set(sku, material._id);
        }
      });

      (bottlesRes.data || []).forEach(bottle => {
        const sku = normalizeSKU(bottle.sku);

        if (sku) {
          bottleMap.set(sku, bottle._id);
        }
      });

      const purchasesMap = new Map();
      const errors = [];
      const timestamp = Date.now();

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 2;

        try {
          const sku = normalizeSKU(row[columnMap.itemSKU]);

          const itemTypeRaw = String(
            row[columnMap.itemType] || ''
          ).trim().toLowerCase();

          if (!sku) {
            errors.push(`Row ${rowNumber}: SKU is missing`);
            continue;
          }

          let itemType;

          if (
            itemTypeRaw.includes('bottle') ||
            itemTypeRaw.includes('glass')
          ) {
            itemType = 'Bottle';
          } else if (
            itemTypeRaw.includes('oil') ||
            itemTypeRaw.includes('material') ||
            itemTypeRaw.includes('raw')
          ) {
            itemType = 'RawMaterial';
          } else if (itemTypeRaw) {
            errors.push(
              `Row ${rowNumber}: Unknown item type "${itemTypeRaw}"`
            );
            continue;
          } else {
            itemType = sku.startsWith('BTL')
              ? 'Bottle'
              : 'RawMaterial';
          }

          const quantity = Number(row[columnMap.quantity]);
          const costPerUnit = Number(row[columnMap.costPerUnit]);

          if (
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(costPerUnit) ||
            costPerUnit <= 0
          ) {
            errors.push(
              `Row ${rowNumber}: Invalid quantity or cost`
            );
            continue;
          }

          const itemId = itemType === 'RawMaterial'
            ? materialMap.get(sku)
            : bottleMap.get(sku);

          if (!itemId) {
            errors.push(
              `Row ${rowNumber}: ${itemType} not found for SKU "${sku}"`
            );
            continue;
          }

          const totalCost = quantity * costPerUnit;

          let invoice = columnMap.invoice
            ? String(row[columnMap.invoice] || '').trim()
            : '';

          if (!invoice) {
            invoice = `PUR-${timestamp}-${String(index + 1).padStart(3, '0')}`;
          }

          let purchaseDate = new Date();

          if (columnMap.date && row[columnMap.date] !== '') {
            purchaseDate = getSpreadsheetDate(row[columnMap.date]);

            if (!purchaseDate) {
              errors.push(
                `Row ${rowNumber}: Invalid purchase date`
              );
              continue;
            }
          }

          if (!purchasesMap.has(invoice)) {
            purchasesMap.set(invoice, {
              invoiceNo: invoice,

              supplier: columnMap.supplier
                ? String(row[columnMap.supplier] || '').trim()
                : '',

              purchaseDate,

              notes: columnMap.notes
                ? String(row[columnMap.notes] || '').trim()
                : '',

              items: []
            });
          }

          const purchase = purchasesMap.get(invoice);

          purchase.items.push({
            itemType,
            item: itemId,
            quantity,
            costPerUnit,
            totalCost
          });
        } catch (error) {
          errors.push(
            `Row ${rowNumber}: ${error.message || 'Invalid row'}`
          );
        }
      }

      const purchasesArray = Array.from(
        purchasesMap.values()
      ).filter(purchase => purchase.items.length > 0);

      if (!purchasesArray.length) {
        setUploadResult({
          success: false,
          message:
            `No valid purchases found. ${errors.length} row(s) had errors.`,
          errors
        });

        return;
      }

      const response = await API.post('/purchases/bulk', {
        purchases: purchasesArray
      });

      const backendData = response.data || {};

      setUploadResult({
        success: true,
        data: backendData,
        errors: [
          ...errors,
          ...(Array.isArray(backendData.errors)
            ? backendData.errors
            : [])
        ]
      });

      toast.success(
        backendData.message || 'Bulk upload completed'
      );

      await refreshData();

      setUploadFile(null);
    } catch (error) {
      console.error('Bulk upload failed:', error);

      setUploadResult({
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Upload failed'
      });

      toast.error(
        error.response?.data?.message || 'Upload failed'
      );
    } finally {
      setUploading(false);
    }
  };

  // --------------------------------------------------
  // Filtering and searching
  // --------------------------------------------------

  const getFilteredPurchases = () => {
    let filtered = [...purchases];

    if (filter.itemType) {
      filtered = filtered.filter(purchase =>
        (purchase.items || []).some(
          item => item.itemType === filter.itemType
        )
      );
    }

    if (filter.supplier) {
      filtered = filtered.filter(purchase =>
        String(purchase.supplier || '')
          .toLowerCase()
          .includes(filter.supplier.toLowerCase())
      );
    }

    if (search.trim()) {
      const lowerSearch = search.trim().toLowerCase();

      filtered = filtered.filter(purchase => {
        const invoiceMatch = String(
          purchase.invoiceNo || ''
        ).toLowerCase().includes(lowerSearch);

        const supplierMatch = String(
          purchase.supplier || ''
        ).toLowerCase().includes(lowerSearch);

        if (invoiceMatch || supplierMatch) return true;

        return (purchase.items || []).some(item => {
          const label = getItemSearchLabel(
            item.itemType,
            item.item
          );

          return label.toLowerCase().includes(lowerSearch);
        });
      });
    }

    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(purchase => {
        const purchaseDate = new Date(purchase.purchaseDate);

        if (Number.isNaN(purchaseDate.getTime())) {
          return false;
        }

        if (dateRange.start) {
          const start = new Date(`${dateRange.start}T00:00:00`);
          if (purchaseDate < start) return false;
        }

        if (dateRange.end) {
          // Include the entire selected end date.
          const end = new Date(`${dateRange.end}T23:59:59.999`);
          if (purchaseDate > end) return false;
        }

        return true;
      });
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.purchaseDate) - new Date(a.purchaseDate)
    );
  };

  const filteredPurchases = getFilteredPurchases();

  const suppliers = [
    ...new Set(
      purchases
        .map(purchase => purchase.supplier)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  const clearFilters = () => {
    setFilter({
      itemType: '',
      supplier: ''
    });

    setSearch('');

    setDateRange({
      start: '',
      end: ''
    });
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Purchase History
          </h1>

          <p className="text-gray-500 text-sm">
            Track all raw material and bottle purchases
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setUploadResult(null);
              setUploadFile(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg hover:bg-green-700 transition shadow-md shadow-green-500/30 text-sm"
          >
            <Upload size={18} />
            Upload Purchases
          </button>

          <Link
            to="/purchases/new"
            className="flex items-center gap-2 bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30 text-sm"
          >
            <Plus size={18} />
            New Purchase
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Raw Materials Cost
          </p>

          <p className="text-xl sm:text-2xl font-bold text-amber-600">
            ৳{formatMoney(summary.totalMaterialCost)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Bottles Cost
          </p>

          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            ৳{formatMoney(summary.totalBottleCost)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Total Purchase Cost
          </p>

          <p className="text-xl sm:text-2xl font-bold text-green-600">
            ৳{formatMoney(summary.grandTotal)}
          </p>
        </div>

      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6 flex flex-wrap items-end gap-3 sm:gap-4">

        <div className="flex-1 min-w-[180px] sm:min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />

            <input
              type="text"
              placeholder="Invoice, Supplier or SKU"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Type
          </label>

          <select
            value={filter.itemType}
            onChange={event =>
              setFilter(previous => ({
                ...previous,
                itemType: event.target.value
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
          >
            <option value="">All</option>
            <option value="RawMaterial">Raw Materials</option>
            <option value="Bottle">Bottles</option>
          </select>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier
          </label>

          <select
            value={filter.supplier}
            onChange={event =>
              setFilter(previous => ({
                ...previous,
                supplier: event.target.value
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
          >
            <option value="">All Suppliers</option>

            {suppliers.map(supplier => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>

          <input
            type="date"
            value={dateRange.start}
            onChange={event =>
              setDateRange(previous => ({
                ...previous,
                start: event.target.value
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
        </div>

        <div className="min-w-[140px] sm:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>

          <input
            type="date"
            value={dateRange.end}
            onChange={event =>
              setDateRange(previous => ({
                ...previous,
                end: event.target.value
              }))
            }
            min={dateRange.start || undefined}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
        </div>

        <button
          onClick={clearFilters}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm whitespace-nowrap"
        >
          Clear
        </button>
      </div>

      {/* Purchase Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />

            <p className="text-gray-500 mt-4">
              Loading purchases...
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">

          <table className="min-w-full divide-y divide-gray-200">

            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>

                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>

                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>

                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total (৳)
                </th>

                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>

                <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">

              {filteredPurchases.map(purchase => {
                const items = purchase.items || [];

                const hasMaterial = items.some(
                  item => item.itemType === 'RawMaterial'
                );

                const hasBottle = items.some(
                  item => item.itemType === 'Bottle'
                );

                let typeLabel = 'Unknown';

                if (hasMaterial && hasBottle) {
                  typeLabel = 'Mixed';
                } else if (hasMaterial) {
                  typeLabel = 'Raw Material';
                } else if (hasBottle) {
                  typeLabel = 'Bottle';
                }

                const purchaseTotal = purchase.totalAmount != null
                  ? toNumber(purchase.totalAmount)
                  : items.reduce(
                      (total, item) => total + toNumber(item.totalCost),
                      0
                    );

                return (
                  <tr
                    key={purchase._id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-gray-800 text-sm">
                      {purchase.invoiceNo || '-'}
                    </td>

                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm">
                      {purchase.supplier || '-'}
                    </td>

                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          typeLabel === 'Raw Material'
                            ? 'bg-amber-100 text-amber-700'
                            : typeLabel === 'Bottle'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </td>

                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-semibold text-amber-600 text-sm">
                      ৳{formatMoney(purchaseTotal)}
                    </td>

                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-gray-600 text-sm whitespace-nowrap">
                      {formatDate(purchase.purchaseDate)}
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
                          onClick={() =>
                            handleDelete(
                              purchase._id,
                              purchase.invoiceNo
                            )
                          }
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
                  <td
                    colSpan="6"
                    className="text-center py-8 text-gray-400"
                  >
                    No purchases found
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------- */}
      {/* Details Modal */}
      {/* ----------------------------------------------- */}

      {showDetailsModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">

            <button
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedPurchase(null);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800">
              Purchase Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">

              <div>
                <p className="text-sm text-gray-500">Invoice</p>
                <p className="font-semibold">
                  {selectedPurchase.invoiceNo || '-'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-semibold">
                  {selectedPurchase.supplier || '-'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-semibold">
                  {formatDate(selectedPurchase.purchaseDate)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">
                  ৳{formatMoney(selectedPurchase.totalAmount)}
                </p>
              </div>

              {selectedPurchase.notes && (
                <div className="col-span-1 sm:col-span-2">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">
                    {selectedPurchase.notes}
                  </p>
                </div>
              )}

            </div>

            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              Items
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">

                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>

                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>

                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>

                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>

                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">

                  {(selectedPurchase.items || []).map((item, index) => {
                    const itemName = getItemDisplayName(
                      item.itemType,
                      item.item
                    );

                    const unit = item.itemType === 'RawMaterial'
                      ? 'ml'
                      : 'pcs';

                    return (
                      <tr key={item._id || index}>

                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.itemType === 'RawMaterial'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {item.itemType === 'RawMaterial'
                              ? 'Oil'
                              : 'Bottle'}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm">
                          {itemName}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm">
                          {toNumber(item.quantity)} {unit}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm">
                          ৳{formatMoney(item.costPerUnit)}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-sm">
                          ৳{formatMoney(item.totalCost)}
                        </td>

                      </tr>
                    );
                  })}

                  {(!selectedPurchase.items ||
                    selectedPurchase.items.length === 0) && (
                    <tr>
                      <td
                        colSpan="5"
                        className="text-center py-6 text-gray-400"
                      >
                        No purchase items found
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ----------------------------------------------- */}
      {/* Edit Purchase Modal */}
      {/* ----------------------------------------------- */}

      {showEditModal && editingPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">

            <button
              onClick={() => {
                if (editLoading) return;

                setShowEditModal(false);
                setEditingPurchase(null);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Edit Purchase
            </h2>

            <p className="text-gray-500 text-sm mb-4">
              Update supplier, date, notes, and items. Changing items will adjust stock accordingly.
            </p>

            <form
              onSubmit={handleEditSubmit}
              className="space-y-4"
            >

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice
                  </label>

                  <input
                    type="text"
                    value={editingPurchase.invoiceNo || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier
                  </label>

                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        supplier: event.target.value
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Date
                  </label>

                  <input
                    type="date"
                    value={editForm.purchaseDate}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        purchaseDate: event.target.value
                      }))
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>

                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        notes: event.target.value
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>

              </div>

              {/* Items */}
              <div>

                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Items
                  </label>

                  <button
                    type="button"
                    onClick={addEditItem}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <PlusCircle size={16} />
                    Add Item
                  </button>
                </div>

                {itemsLoading && (
                  <p className="text-sm text-gray-400 mb-2">
                    Loading inventory items...
                  </p>
                )}

                <div className="overflow-x-auto border rounded-lg">

                  <table className="min-w-full divide-y divide-gray-200">

                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>

                        <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Item
                        </th>

                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>

                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Cost/Unit
                        </th>

                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>

                        <th className="px-2 sm:px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">

                      {editForm.items.map((item, index) => {
                        const options = item.itemType === 'RawMaterial'
                          ? allMaterials.map(material => ({
                              value: material._id,
                              label:
                                material.name ||
                                material.sku ||
                                'Unknown'
                            }))
                          : allBottles.map(bottle => ({
                              value: bottle._id,
                              label: bottle.sizeMl
                                ? `${bottle.sizeMl}ml ${bottle.type || 'Bottle'}`
                                : bottle.name || bottle.sku || 'Unknown'
                            }));

                        return (
                          <tr key={item._id || `new-${index}`}>

                            <td className="px-2 sm:px-3 py-2">
                              <select
                                value={item.itemType}
                                onChange={event =>
                                  updateEditItem(
                                    index,
                                    'itemType',
                                    event.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="RawMaterial">
                                  Oil
                                </option>

                                <option value="Bottle">
                                  Bottle
                                </option>
                              </select>
                            </td>

                            <td className="px-2 sm:px-3 py-2">
                              <select
                                value={item.itemId}
                                onChange={event =>
                                  updateEditItem(
                                    index,
                                    'itemId',
                                    event.target.value
                                  )
                                }
                                className="w-full min-w-[130px] px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="">
                                  Select {item.itemType === 'RawMaterial'
                                    ? 'Oil'
                                    : 'Bottle'}
                                </option>

                                {options.map(option => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-2 sm:px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={event =>
                                  updateEditItem(
                                    index,
                                    'quantity',
                                    event.target.value
                                  )
                                }
                                min="0.01"
                                step="0.01"
                                required
                                className="w-16 sm:w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-amber-500"
                              />
                            </td>

                            <td className="px-2 sm:px-3 py-2">
                              <input
                                type="number"
                                value={item.costPerUnit}
                                onChange={event =>
                                  updateEditItem(
                                    index,
                                    'costPerUnit',
                                    event.target.value
                                  )
                                }
                                min="0.01"
                                step="0.01"
                                required
                                className="w-20 sm:w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-amber-500"
                              />
                            </td>

                            <td className="px-2 sm:px-3 py-2 text-right font-semibold text-sm whitespace-nowrap">
                              ৳{formatMoney(
                                toNumber(item.quantity) *
                                toNumber(item.costPerUnit)
                              )}
                            </td>

                            <td className="px-2 sm:px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeEditItem(index)}
                                className="text-red-500 hover:text-red-700"
                                title="Remove item"
                              >
                                <MinusCircle size={18} />
                              </button>
                            </td>

                          </tr>
                        );
                      })}

                      {editForm.items.length === 0 && (
                        <tr>
                          <td
                            colSpan="6"
                            className="text-center py-4 text-gray-400 text-sm"
                          >
                            No items added. Click "Add Item" to include items.
                          </td>
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>

                {/* Edit total */}
                <div className="flex justify-end mt-3">
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-right">
                    <p className="text-xs text-gray-500">
                      Updated Purchase Total
                    </p>

                    <p className="text-lg font-bold text-amber-600">
                      ৳{formatMoney(
                        editForm.items.reduce(
                          (total, item) =>
                            total +
                            toNumber(item.quantity) *
                            toNumber(item.costPerUnit),
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>

              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">

                <button
                  type="submit"
                  disabled={editLoading || itemsLoading}
                  className="w-full sm:flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  disabled={editLoading}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPurchase(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------- */}
      {/* Bulk Upload Modal */}
      {/* ----------------------------------------------- */}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">

            <button
              onClick={() => {
                if (uploading) return;

                setShowUploadModal(false);
                setUploadResult(null);
                setUploadFile(null);
              }}
              disabled={uploading}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Bulk Upload Purchases
            </h2>

            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with purchase data. Supports grouping by invoice.

              <br />

              <span className="text-amber-600">
                Required columns:
              </span>

              {' Item Type, SKU, Quantity, Cost Per Unit'}

              <br />

              <span className="text-gray-400">
                Optional:
              </span>

              {' Invoice, Supplier, Date, Notes'}

              <br />

              <span className="text-xs text-gray-400">
                If no Invoice column exists, each row becomes a separate purchase with an auto-generated invoice.
              </span>
            </p>

            <form
              onSubmit={handleUploadSubmit}
              className="space-y-4"
            >

              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full border rounded-lg p-2 text-sm"
                  disabled={uploading}
                  required
                />

                {uploadFile && (
                  <p className="text-xs text-gray-500 mt-2">
                    Selected file: {uploadFile.name}
                  </p>
                )}
              </div>

              {uploadResult && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    uploadResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >

                  {uploadResult.success ? (
                    <div className="flex items-start gap-2">

                      <CheckCircle
                        size={20}
                        className="mt-0.5 flex-shrink-0"
                      />

                      <div className="min-w-0">
                        <p className="font-medium">
                          {uploadResult.data?.message ||
                            'Upload completed'}
                        </p>

                        <p className="text-sm">
                          Created:{' '}
                          {uploadResult.data?.created?.length || 0}
                        </p>

                        {uploadResult.errors?.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm">
                              View errors ({uploadResult.errors.length})
                            </summary>

                            <ul className="text-xs mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {uploadResult.errors.map((error, index) => {
                                let errorMessage = '';
                                let context = '';

                                if (typeof error === 'string') {
                                  errorMessage = error;
                                } else if (
                                  error &&
                                  typeof error === 'object'
                                ) {
                                  errorMessage =
                                    error.error ||
                                    error.message ||
                                    JSON.stringify(error);

                                  context =
                                    error.purchaseData?.invoiceNo ||
                                    error.purchaseData?.supplier ||
                                    '';
                                } else {
                                  errorMessage = String(error);
                                }

                                return (
                                  <li
                                    key={index}
                                    className="text-red-600"
                                  >
                                    • {errorMessage}

                                    {context && (
                                      <span className="text-gray-400 ml-1">
                                        (Invoice: {context})
                                      </span>
                                    )}
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

                      <AlertCircle
                        size={20}
                        className="mt-0.5 flex-shrink-0"
                      />

                      <div className="min-w-0">
                        <p>{uploadResult.message}</p>

                        {uploadResult.errors?.length > 0 && (
                          <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                            {uploadResult.errors.map((error, index) => (
                              <li key={index}>
                                • {typeof error === 'string'
                                  ? error
                                  : error.message || error.error || JSON.stringify(error)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

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
                  disabled={uploading}
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setUploadFile(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
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
