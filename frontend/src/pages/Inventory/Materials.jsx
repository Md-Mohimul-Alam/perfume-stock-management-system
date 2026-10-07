import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Droplet,
  FlaskRound,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

import API from '../../api/axios';

const LOW_STOCK_ML = 10;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(number(value));

const timeAgo = (date) => {
  if (!date) return 'never';

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'unknown';

  const seconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return `${Math.floor(days / 30)}mo ago`;
};

const readSheetRows = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read the selected file.'));

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];

        if (!firstSheet) {
          reject(new Error('The spreadsheet does not contain a worksheet.'));
          return;
        }

        resolve(
          XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
            defval: '',
          })
        );
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });

const Modal = ({ children, onClose, maxWidth = 'max-w-md' }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
    <div
      className={`relative my-auto w-full ${maxWidth} rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6`}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}
      {children}
    </div>
  </div>
);

const fieldClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100';

const Materials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  const [oilSummary, setOilSummary] = useState({
    usedOilRollOn: 0,
    usedOilSpray: 0,
    totalOilStock: 0,
    availableOil: 0,
    totalWastage: 0,
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    sku: '',
    type: 'oil',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    type: 'oil',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [stockOutMaterial, setStockOutMaterial] = useState(null);
  const [stockOutLoading, setStockOutLoading] = useState(false);

  const [adjustMaterial, setAdjustMaterial] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    newStockMl: '',
    reason: 'recount',
    recordAsWastage: true,
    notes: '',
  });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const fetchMaterialsAndSummary = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const [materialsRes, salesRes, productsRes, logsRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/sales'),
        API.get('/products'),
        API.get('/inventory/logs?reason=wastage'),
      ]);

      const materialsData = Array.isArray(materialsRes.data) ? materialsRes.data : [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : [];
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const logs = Array.isArray(logsRes.data) ? logsRes.data : [];

      const historicalWastageMap = {};

      for (const log of logs) {
        if (log.reason !== 'wastage' || !log.material) continue;

        const materialId =
          log.material?._id?.toString() ||
          log.material?.toString();

        if (!materialId) continue;

        historicalWastageMap[materialId] =
          number(historicalWastageMap[materialId]) +
          Math.abs(number(log.changeQuantity));
      }

      const productMap = {};
      products.forEach((product) => {
        if (product?._id) productMap[String(product._id)] = product;
      });

      const materialNameMap = {};
      materialsData.forEach((material) => {
        if (material?.name && material?._id) {
          materialNameMap[material.name.toLowerCase()] = String(material._id);
        }
      });

      const parseBlendComponents = (product, sizeMl) => {
        const sizeVariant = product.sizes?.find(
          (size) => number(size.sizeMl) === number(sizeMl)
        );

        const variantComponents = sizeVariant?.blendComponents;

        if (Array.isArray(variantComponents) && variantComponents.length) {
          return variantComponents
            .filter(
              (component) =>
                (component.material || component.name) &&
                number(component.percentage) > 0
            )
            .map((component) => ({
              material: component.material,
              name: component.name,
              percentage: number(component.percentage),
            }));
        }

        const components = product.blendComponents;

        if (!components) return [];

        if (Array.isArray(components)) {
          return components
            .filter(
              (component) =>
                (component.material || component.name) &&
                number(component.percentage) > 0
            )
            .map((component) => ({
              material: component.material,
              name: component.name,
              percentage: number(component.percentage),
            }));
        }

        return String(components)
          .split(';')
          .map((part) => part.trim())
          .map((part) => {
            const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/);
            return match
              ? {
                  name: match[1].trim(),
                  percentage: number(match[2]),
                }
              : null;
          })
          .filter(Boolean);
      };

      const resolveMaterialId = (component) => {
        const directId =
          component.material?._id ||
          component.material;

        if (directId) return String(directId);

        if (component.name) {
          return materialNameMap[component.name.toLowerCase()] || null;
        }

        return null;
      };

      const usageMap = {};

      for (const sale of sales) {
        if (!Array.isArray(sale.items)) continue;

        for (const item of sale.items) {
          const productId =
            item.product?._id ||
            item.product;

          const product = productMap[String(productId || '')];
          if (!product) continue;

          const sizeMl = number(item.sizeMl);
          const quantity = number(item.quantity);
          if (sizeMl <= 0 || quantity <= 0) continue;

          if (product.type === 'roll-on') {
            const oilId =
              product.baseOil?._id ||
              product.baseOil;

            if (oilId) {
              const key = String(oilId);
              usageMap[key] = number(usageMap[key]) + sizeMl * quantity;
            }
          }

          if (product.type === 'spray') {
            for (const component of parseBlendComponents(product, sizeMl)) {
              const materialId = resolveMaterialId(component);
              if (!materialId) continue;

              const used =
                sizeMl *
                (number(component.percentage) / 100) *
                quantity;

              usageMap[materialId] =
                number(usageMap[materialId]) +
                used;
            }
          }
        }
      }

      const updatedMaterials = materialsData.map((material) => {
        const id = String(material._id || '');
        const historicalWasted = number(historicalWastageMap[id]);

        if (id === 'SR_SP_VIRTUAL' || id === 'LUXE1_SP_VIRTUAL') {
          return {
            ...material,
            usedOil: number(material.usedOil),
            availableOil: number(material.availableOil),
            wastedOil: 0,
            historicalWasted,
          };
        }

        const cycleWasted =
          material.currentCycleWastageMl !== undefined &&
          material.currentCycleWastageMl !== null
            ? number(material.currentCycleWastageMl)
            : historicalWasted;

        return {
          ...material,
          usedOil: number(usageMap[id]),
          availableOil: number(material.currentStockMl),
          wastedOil: cycleWasted,
          historicalWasted,
        };
      });

      setMaterials(updatedMaterials);

      const oilMaterials = updatedMaterials.filter(
        (material) => material.type === 'oil'
      );

      const totalOilStock = oilMaterials.reduce(
        (sum, material) => sum + number(material.currentStockMl),
        0
      );

      const totalWastage = oilMaterials.reduce(
        (sum, material) => sum + number(material.wastedOil),
        0
      );

      let usedRollOn = 0;
      let usedSpray = 0;

      for (const sale of sales) {
        if (!Array.isArray(sale.items)) continue;

        for (const item of sale.items) {
          const productId = item.product?._id || item.product;
          const product = productMap[String(productId || '')];
          if (!product) continue;

          const sizeMl = number(item.sizeMl);
          const quantity = number(item.quantity);
          if (sizeMl <= 0 || quantity <= 0) continue;

          if (product.type === 'roll-on') {
            usedRollOn += sizeMl * quantity;
            continue;
          }

          if (product.type === 'spray') {
            let sprayOilMl = 0;

            for (const component of parseBlendComponents(product, sizeMl)) {
              const materialId = resolveMaterialId(component);
              if (!materialId) continue;

              const material = materialsData.find(
                (row) => String(row._id) === materialId
              );

              if (material?.type === 'oil') {
                sprayOilMl +=
                  sizeMl *
                  (number(component.percentage) / 100);
              }
            }

            usedSpray += sprayOilMl * quantity;
          }
        }
      }

      setOilSummary({
        usedOilRollOn: usedRollOn,
        usedOilSpray: usedSpray,
        totalOilStock,
        availableOil: totalOilStock,
        totalWastage,
      });
    } catch (error) {
      console.error('Failed to fetch materials data', error);
      toast.error(error.response?.data?.message || 'Failed to load materials');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterialsAndSummary();
  }, []);

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase();

    return materials.filter((material) => {
      const stock = number(material.currentStockMl);
      const isOut = material.isStockOut || stock <= 0;

      const matchesSearch =
        !query ||
        String(material.name || '').toLowerCase().includes(query) ||
        String(material.sku || '').toLowerCase().includes(query);

      const matchesType =
        typeFilter === 'all' || material.type === typeFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'available' && !isOut && stock >= LOW_STOCK_ML) ||
        (statusFilter === 'low' && !isOut && stock > 0 && stock < LOW_STOCK_ML) ||
        (statusFilter === 'out' && isOut);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [materials, search, typeFilter, statusFilter]);

  const inventorySummary = useMemo(
    () =>
      materials.reduce(
        (summary, material) => {
          if (String(material._id || '').includes('_VIRTUAL')) return summary;

          const stock = number(material.currentStockMl);
          const value = stock * number(material.avgCostPerMl);

          summary.stockMl += stock;
          summary.value += value;

          if (material.isStockOut || stock <= 0) summary.out += 1;
          else if (stock < LOW_STOCK_ML) summary.low += 1;

          return summary;
        },
        { stockMl: 0, value: 0, low: 0, out: 0 }
      ),
    [materials]
  );

  const handleAddSubmit = async (event) => {
    event.preventDefault();

    const name = newMaterial.name.trim();
    const sku = newMaterial.sku.trim();

    if (!name || !sku) {
      setModalError('Name and SKU are required.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      await API.post('/inventory/materials', {
        name,
        sku,
        type: newMaterial.type,
      });

      toast.success('Material added');
      setShowAddModal(false);
      setNewMaterial({
        name: '',
        sku: '',
        type: 'oil',
      });
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      setModalError(error.response?.data?.message || 'Failed to create material');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (material) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name || '',
      sku: material.sku || '',
      type: material.type || 'oil',
    });
    setEditError('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingMaterial) return;

    const name = editForm.name.trim();
    const sku = editForm.sku.trim();

    if (!name || !sku) {
      setEditError('Name and SKU are required.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      await API.put(`/inventory/materials/${editingMaterial._id}`, {
        name,
        sku,
        type: editForm.type,
      });

      toast.success('Material updated');
      setEditingMaterial(null);
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      setEditError(error.response?.data?.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await API.delete(`/inventory/materials/${deleteTarget._id}`);
      toast.success('Material deleted');
      setDeleteTarget(null);
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleStockOutConfirm = async () => {
    if (!stockOutMaterial || stockOutLoading) return;

    setStockOutLoading(true);

    try {
      await API.post(`/inventory/materials/${stockOutMaterial._id}/stock-out`);
      toast.success(`"${stockOutMaterial.name}" marked as stock out`);
      setStockOutMaterial(null);
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Stock-out failed');
    } finally {
      setStockOutLoading(false);
    }
  };

  const handleAdjustClick = (material) => {
    setAdjustMaterial(material);
    setAdjustForm({
      newStockMl: String(number(material.currentStockMl)),
      reason: 'recount',
      recordAsWastage: true,
      notes: '',
    });
    setAdjustError('');
  };

  const handleAdjustConfirm = async () => {
    if (!adjustMaterial || adjustLoading) return;

    const target = Number(adjustForm.newStockMl);

    if (!Number.isFinite(target) || target < 0) {
      setAdjustError('Please enter a valid non-negative stock amount.');
      return;
    }

    setAdjustLoading(true);
    setAdjustError('');

    try {
      const response = await API.post(
        `/inventory/materials/${adjustMaterial._id}/adjust`,
        {
          newStockMl: target,
          reason: adjustForm.reason,
          recordAsWastage: adjustForm.recordAsWastage,
          notes: adjustForm.notes.trim(),
        }
      );

      toast.success(response.data?.message || 'Stock adjusted');
      setAdjustMaterial(null);
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      setAdjustError(error.response?.data?.message || 'Adjustment failed');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setUploadResult(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setUploadResult({
        success: false,
        message: 'File is too large. Maximum upload size is 5 MB.',
      });
      event.target.value = '';
      return;
    }

    setFile(selected);
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const rows = await readSheetRows(file);

      if (!rows.length) {
        throw new Error('The spreadsheet does not contain any data rows.');
      }

      const items = rows
        .map((row) => {
          const purchases = [];

          for (let index = 1; index <= 3; index += 1) {
            const quantity = Number(row[`QTY${index}`]);
            const price = Number(row[`PR${index}`]);

            if (
              Number.isFinite(quantity) &&
              Number.isFinite(price) &&
              quantity > 0 &&
              price > 0
            ) {
              /*
                PR1 / PR2 / PR3 is treated as the total
                price paid for that purchase lot.
              */
              purchases.push({
                quantityMl: quantity,
                costPerMl: price / quantity,
                totalCost: price,
                supplier: '',
                invoiceNo: '',
              });
            }
          }

          if (!purchases.length) {
            const totalQuantity = Number(row['Total Quantity']);
            const totalPrice = Number(row['Total Price']);

            if (
              Number.isFinite(totalQuantity) &&
              Number.isFinite(totalPrice) &&
              totalQuantity > 0 &&
              totalPrice > 0
            ) {
              purchases.push({
                quantityMl: totalQuantity,
                costPerMl: totalPrice / totalQuantity,
                totalCost: totalPrice,
                supplier: '',
                invoiceNo: '',
              });
            }
          }

          const name = String(row.Name || row.name || '').trim();
          const sku = String(
            row['Human-Friendly SKU'] ||
            row.sku ||
            row.SKU ||
            ''
          ).trim();

          let type = String(row.type || row.Type || '')
            .toLowerCase()
            .trim();

          if (!type) {
            const lowerName = name.toLowerCase();

            if (lowerName.includes('ethanol') || lowerName.includes('eth')) {
              type = 'ethanol';
            } else if (lowerName.includes('fixative') || lowerName.includes('fix')) {
              type = 'fixative';
            } else {
              type = 'oil';
            }
          }

          return {
            name,
            sku,
            type,
            purchases,
          };
        })
        .filter(
          (item) =>
            item.name &&
            item.sku &&
            ['oil', 'ethanol', 'fixative'].includes(item.type) &&
            item.purchases.length > 0
        );

      if (!items.length) {
        throw new Error(
          'No valid rows found. Check Name, SKU and purchase columns.'
        );
      }

      const response = await API.post('/inventory/materials/import', { items });

      setUploadResult({
        success: true,
        data: response.data,
      });
      setFile(null);
      toast.success('Materials imported');
      await fetchMaterialsAndSummary({ silent: true });
    } catch (error) {
      setUploadResult({
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const renderActions = (material) => {
    const isVirtual = String(material._id || '').includes('_VIRTUAL');
    const isStockOut = material.isStockOut === true;

    return (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => handleEditClick(material)}
          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          title="Edit"
          aria-label={`Edit ${material.name}`}
        >
          <Pencil size={18} />
        </button>

        {!isVirtual && (
          <button
            type="button"
            onClick={() => handleAdjustClick(material)}
            className="rounded-lg p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            title="Adjust stock"
            aria-label={`Adjust stock for ${material.name}`}
          >
            <Settings size={18} />
          </button>
        )}

        {!isVirtual && (
          <button
            type="button"
            onClick={() => setStockOutMaterial(material)}
            disabled={isStockOut}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30"
            title={isStockOut ? 'Already stock out' : 'Stock out'}
            aria-label={`Stock out ${material.name}`}
          >
            <XCircle size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setDeleteTarget(material)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-slate-800"
          title="Delete"
          aria-label={`Delete ${material.name}`}
        >
          <Trash2 size={18} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Raw Materials</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track perfume oils, ethanol, fixative, usage and wastage.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fetchMaterialsAndSummary()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError('');
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
          >
            <Plus size={17} />
            Add Material
          </button>

          <button
            type="button"
            onClick={() => {
              setUploadResult(null);
              setFile(null);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Upload size={17} />
            Upload Sheet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            label: 'Oil used · Roll-on',
            value: `${oilSummary.usedOilRollOn.toFixed(0)} ml`,
            icon: <Droplet size={16} />,
          },
          {
            label: 'Oil used · Spray',
            value: `${oilSummary.usedOilSpray.toFixed(0)} ml`,
            icon: <FlaskRound size={16} />,
          },
          {
            label: 'Oil wasted',
            value: `${oilSummary.totalWastage.toFixed(0)} ml`,
            icon: <AlertTriangle size={16} />,
          },
          {
            label: 'Total oil stock',
            value: `${oilSummary.totalOilStock.toFixed(0)} ml`,
            icon: <Package size={16} />,
          },
          {
            label: 'Inventory value',
            value: money(inventorySummary.value),
            icon: <Package size={16} />,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.icon}
              {card.label}
            </div>
            <p className="mt-2 text-xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search material or SKU..."
            className={`${fieldClass} pl-10`}
          />
        </label>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className={fieldClass}
          aria-label="Filter material type"
        >
          <option value="all">All types</option>
          <option value="oil">Oil</option>
          <option value="ethanol">Ethanol</option>
          <option value="fixative">Fixative</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={fieldClass}
          aria-label="Filter material status"
        >
          <option value="all">All stock</option>
          <option value="available">Available</option>
          <option value="low">Low (&lt; {LOW_STOCK_ML} ml)</option>
          <option value="out">Stock out</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <RefreshCw className="animate-spin text-brand-primary" size={28} />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400">
          No materials match the current filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredMaterials.map((material) => {
              const stock = number(material.currentStockMl);
              const wasted = number(material.wastedOil);
              const historicalWasted = number(material.historicalWasted);
              const isStockOut = material.isStockOut || stock <= 0;
              const wasRestocked =
                material.lastRestockAt &&
                historicalWasted > 0 &&
                wasted === 0;

              return (
                <article
                  key={material._id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{material.name}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {material.sku} · {material.type}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isStockOut
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : stock < LOW_STOCK_ML
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                    >
                      {isStockOut
                        ? 'Stock out'
                        : stock < LOW_STOCK_ML
                          ? 'Low stock'
                          : 'Available'}
                    </span>
                  </div>

                  {wasRestocked && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <RotateCcw size={12} />
                      New cycle · restocked {timeAgo(material.lastRestockAt)}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Stock</p>
                      <p className="font-semibold">{stock.toFixed(2)} ml</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Stock value</p>
                      <p className="font-semibold">
                        {money(stock * number(material.avgCostPerMl))}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Used</p>
                      <p>{number(material.usedOil).toFixed(0)} ml</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Wasted</p>
                      <p>{wasted.toFixed(0)} ml</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-2 dark:border-slate-800">
                    {renderActions(material)}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Material</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Per ml</th>
                  <th className="px-4 py-3 text-right">Purchased ml</th>
                  <th className="px-4 py-3 text-right">Stock value</th>
                  <th className="px-4 py-3 text-right">Purchase cost</th>
                  <th className="px-4 py-3 text-right">Used</th>
                  <th className="px-4 py-3 text-right">Wasted</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredMaterials.map((material) => {
                  const stock = number(material.currentStockMl);
                  const perMl = number(material.avgCostPerMl);
                  const isOut = material.isStockOut || stock <= 0;
                  const wasRestocked =
                    material.lastRestockAt &&
                    number(material.historicalWasted) > 0 &&
                    number(material.wastedOil) === 0;

                  return (
                    <tr
                      key={material._id}
                      className={`${isOut ? 'bg-red-50/30 dark:bg-red-950/10' : ''} hover:bg-gray-50/70 dark:hover:bg-slate-800/60`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{material.name}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {material.sku}
                          {wasRestocked && (
                            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                              <RotateCcw size={11} />
                              {timeAgo(material.lastRestockAt)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize">{material.type}</td>
                      <td className="px-4 py-3 text-right font-semibold">{stock.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{money(perMl)}</td>
                      <td className="px-4 py-3 text-right">{number(material.totalPurchaseMl).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(stock * perMl)}</td>
                      <td className="px-4 py-3 text-right">{money(material.totalPurchaseCost)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{number(material.usedOil).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{number(material.wastedOil).toFixed(0)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            isOut
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : stock < LOW_STOCK_ML
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {isOut
                            ? 'Stock out'
                            : stock < LOW_STOCK_ML
                              ? 'Low'
                              : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{renderActions(material)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAddModal && (
        <Modal onClose={() => !submitting && setShowAddModal(false)}>
          <h2 className="pr-10 text-xl font-bold">Add Raw Material</h2>
          <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              Name
              <input
                value={newMaterial.name}
                onChange={(event) =>
                  setNewMaterial((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              SKU
              <input
                value={newMaterial.sku}
                onChange={(event) =>
                  setNewMaterial((previous) => ({
                    ...previous,
                    sku: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Type
              <select
                value={newMaterial.type}
                onChange={(event) =>
                  setNewMaterial((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="oil">Oil</option>
                <option value="ethanol">Ethanol</option>
                <option value="fixative">Fixative</option>
              </select>
            </label>

            {modalError && <p className="text-sm text-red-600">{modalError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-primary py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Material'}
            </button>
          </form>
        </Modal>
      )}

      {editingMaterial && (
        <Modal onClose={() => !editSubmitting && setEditingMaterial(null)}>
          <h2 className="pr-10 text-xl font-bold">Edit Material</h2>
          <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              Name
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              SKU
              <input
                value={editForm.sku}
                onChange={(event) =>
                  setEditForm((previous) => ({
                    ...previous,
                    sku: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Type
              <select
                value={editForm.type}
                onChange={(event) =>
                  setEditForm((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="oil">Oil</option>
                <option value="ethanol">Ethanol</option>
                <option value="fixative">Fixative</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800">
              <div><span className="text-gray-500">Stock</span><p className="font-semibold">{number(editingMaterial.currentStockMl).toFixed(2)} ml</p></div>
              <div><span className="text-gray-500">Per ml</span><p className="font-semibold">{money(editingMaterial.avgCostPerMl)}</p></div>
              <div><span className="text-gray-500">Cycle wastage</span><p className="font-semibold">{number(editingMaterial.wastedOil).toFixed(0)} ml</p></div>
              <div><span className="text-gray-500">Lifetime wastage</span><p className="font-semibold">{number(editingMaterial.historicalWasted).toFixed(0)} ml</p></div>
            </div>

            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <button
              type="submit"
              disabled={editSubmitting}
              className="w-full rounded-xl bg-brand-primary py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {editSubmitting ? 'Updating...' : 'Update Material'}
            </button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => !deleting && setDeleteTarget(null)}>
          <h3 className="pr-10 text-xl font-bold">Delete Material?</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-xl border border-gray-300 px-4 py-2 dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {stockOutMaterial && (
        <Modal onClose={() => !stockOutLoading && setStockOutMaterial(null)}>
          <h3 className="pr-10 text-xl font-bold">Stock Out Material</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Mark <strong>{stockOutMaterial.name}</strong> as stock out?
          </p>

          {number(stockOutMaterial.currentStockMl) > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              There are <strong>{number(stockOutMaterial.currentStockMl)} ml</strong> remaining. Your backend stock-out logic will handle the remaining inventory.
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStockOutMaterial(null)}
              disabled={stockOutLoading}
              className="rounded-xl border border-gray-300 px-4 py-2 dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStockOutConfirm}
              disabled={stockOutLoading}
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {stockOutLoading ? 'Processing...' : 'Confirm Stock Out'}
            </button>
          </div>
        </Modal>
      )}

      {adjustMaterial && (
        <Modal onClose={() => !adjustLoading && setAdjustMaterial(null)}>
          <h3 className="pr-10 text-xl font-bold">Adjust Stock</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Correct <strong>{adjustMaterial.name}</strong> to match your physical count.
          </p>

          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800">
            <div className="flex justify-between">
              <span className="text-gray-500">System stock</span>
              <strong>{number(adjustMaterial.currentStockMl).toFixed(2)} ml</strong>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-gray-500">Per ml cost</span>
              <strong>{money(adjustMaterial.avgCostPerMl)}</strong>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              Physical count (ml)
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustForm.newStockMl}
                onChange={(event) =>
                  setAdjustForm((previous) => ({
                    ...previous,
                    newStockMl: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
                autoFocus
              />
            </label>

            {(() => {
              const target = Number(adjustForm.newStockMl);
              const oldStock = number(adjustMaterial.currentStockMl);

              if (!Number.isFinite(target)) return null;

              const delta = target - oldStock;
              if (Math.abs(delta) < 0.01) return null;

              return (
                <p className={`text-sm ${delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(2)} ml change
                  {delta < 0 &&
                    adjustForm.recordAsWastage &&
                    number(adjustMaterial.avgCostPerMl) > 0 && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {' '}· estimated loss {money(Math.abs(delta) * number(adjustMaterial.avgCostPerMl))}
                      </span>
                    )}
                </p>
              );
            })()}

            <label className="block text-sm font-medium">
              Reason
              <select
                value={adjustForm.reason}
                onChange={(event) =>
                  setAdjustForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="recount">Physical recount</option>
                <option value="spillage">Spillage / evaporation</option>
                <option value="missing">Missing / stolen</option>
                <option value="unrecorded-sale">Unrecorded sale</option>
                <option value="correction">Historical correction</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={adjustForm.recordAsWastage}
                onChange={(event) =>
                  setAdjustForm((previous) => ({
                    ...previous,
                    recordAsWastage: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                Record stock shortfall as a wastage expense
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Keeps the expense/P&amp;L record aligned with the physical loss.
                </span>
              </span>
            </label>

            <label className="block text-sm font-medium">
              Notes
              <input
                value={adjustForm.notes}
                onChange={(event) =>
                  setAdjustForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                placeholder="Monthly physical count..."
                className={`${fieldClass} mt-1`}
              />
            </label>

            {adjustError && <p className="text-sm text-red-600">{adjustError}</p>}

            <button
              type="button"
              onClick={handleAdjustConfirm}
              disabled={adjustLoading}
              className="w-full rounded-xl bg-purple-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {adjustLoading ? 'Adjusting...' : 'Confirm Adjustment'}
            </button>
          </div>
        </Modal>
      )}

      {showUploadModal && (
        <Modal
          maxWidth="max-w-xl"
          onClose={() => {
            if (uploading) return;
            setShowUploadModal(false);
            setUploadResult(null);
            setFile(null);
          }}
        >
          <h2 className="pr-10 text-xl font-bold">Bulk Import Materials</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Use Name, Human-Friendly SKU and purchase columns such as QTY1/PR1.
          </p>

          <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploading}
              className={fieldClass}
              required
            />

            {uploadResult && (
              <div
                className={`rounded-xl p-3 text-sm ${
                  uploadResult.success
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {uploadResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <div>
                    <p>
                      {uploadResult.success
                        ? uploadResult.data?.message || 'Import completed.'
                        : uploadResult.message}
                    </p>

                    {uploadResult.success && uploadResult.data?.errors?.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">
                          View errors ({uploadResult.data.errors.length})
                        </summary>
                        <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-xs">
                          {uploadResult.data.errors.map((entry, index) => (
                            <li key={`${entry.error}-${index}`}>• {entry.error}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Materials;
