
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const getToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .split('T')[0];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const NewPurchase = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [bottles, setBottles] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [form, setForm] = useState({
    invoiceNo: '',
    supplier: '',
    purchaseDate: getToday(),
    notes: '',
    items: [],
  });

  const [newItem, setNewItem] = useState({
    itemType: 'RawMaterial',
    itemId: '',
    quantity: 1,
    costPerUnit: 0,
  });

  // Quick-add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddType, setQuickAddType] = useState('RawMaterial');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  const [newMaterialData, setNewMaterialData] = useState({
    name: '',
    sku: '',
    type: 'oil',
  });

  const [newBottleData, setNewBottleData] = useState({
    sizeMl: '',
    type: 'spray',
  });

  // ---------------------------------------------
  // FETCH INVENTORY
  // ---------------------------------------------

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);

    try {
      const [materialsRes, bottlesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/inventory/bottles'),
      ]);

      setMaterials(Array.isArray(materialsRes.data) ? materialsRes.data : []);
      setBottles(Array.isArray(bottlesRes.data) ? bottlesRes.data : []);
    } catch (error) {
      toast.error('Failed to load inventory items');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ---------------------------------------------
  // GENERATE INVOICE NUMBER
  // ---------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const generateInvoice = async () => {
      try {
        const { data } = await API.get('/purchases');

        if (cancelled) return;

        const purchases = Array.isArray(data) ? data : [];

        const prefix = (() => {
          const date = new Date();
          return (
            String(date.getFullYear()).slice(-2) +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0')
          );
        })();

        const matchingInvoices = purchases
          .map((purchase) => purchase.invoiceNo || '')
          .map((invoice) => {
            const match = invoice.match(/^PUR-(\d+)-(\d+)$/);
            return match
              ? { prefix: match[1], number: Number(match[2]) }
              : null;
          })
          .filter(Boolean)
          .filter((invoice) => invoice.prefix === prefix);

        const highestNumber = matchingInvoices.reduce(
          (highest, invoice) => Math.max(highest, invoice.number),
          0
        );

        const nextNumber = String(highestNumber + 1).padStart(3, '0');

        if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            invoiceNo: prev.invoiceNo || `PUR-${prefix}-${nextNumber}`,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          const date = new Date();
          const prefix =
            String(date.getFullYear()).slice(-2) +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0');

          setForm((prev) => ({
            ...prev,
            invoiceNo: prev.invoiceNo || `PUR-${prefix}-001`,
          }));
        }
      }
    };

    generateInvoice();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------
  // QUICK ADD
  // ---------------------------------------------

  const openQuickAdd = (type) => {
    setQuickAddType(type);
    setQuickAddError('');

    setNewMaterialData({
      name: '',
      sku: '',
      type: 'oil',
    });

    setNewBottleData({
      sizeMl: '',
      type: 'spray',
    });

    setShowQuickAdd(true);
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();

    if (quickAddSubmitting) return;

    setQuickAddSubmitting(true);
    setQuickAddError('');

    try {
      let response;
      let createdItem;

      if (quickAddType === 'RawMaterial') {
        const name = newMaterialData.name.trim();
        const sku = newMaterialData.sku.trim();

        if (!name || !sku) {
          throw new Error('Name and SKU are required');
        }

        const existing = materials.find(
          (material) =>
            String(material.sku || '').trim().toLowerCase() ===
            sku.toLowerCase()
        );

        if (existing) {
          throw new Error(`SKU "${sku}" already exists`);
        }

        response = await API.post('/inventory/materials', {
          name,
          sku,
          type: newMaterialData.type,
        });

        createdItem = response.data;

        if (!createdItem?._id) {
          throw new Error('Material was created but no item ID was returned');
        }

        setMaterials((prev) => [...prev, createdItem]);

        toast.success('Raw material created successfully');
      } else {
        const size = toNumber(newBottleData.sizeMl);

        if (size <= 0) {
          throw new Error('Please enter a valid bottle size');
        }

        const existing = bottles.find(
          (bottle) =>
            toNumber(bottle.sizeMl) === size &&
            bottle.type === newBottleData.type
        );

        if (existing) {
          throw new Error(
            `Bottle ${size}ml (${newBottleData.type}) already exists`
          );
        }

        response = await API.post('/inventory/bottles', {
          sizeMl: size,
          type: newBottleData.type,
        });

        createdItem = response.data;

        if (!createdItem?._id) {
          throw new Error('Bottle was created but no item ID was returned');
        }

        setBottles((prev) => [...prev, createdItem]);

        toast.success('Bottle created successfully');
      }

      setNewItem((prev) => ({
        ...prev,
        itemType: quickAddType,
        itemId: createdItem._id,
      }));

      setShowQuickAdd(false);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Creation failed';

      setQuickAddError(message);
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  // ---------------------------------------------
  // MAIN FORM HANDLERS
  // ---------------------------------------------

  const handleAddItem = () => {
    const itemType = newItem.itemType;
    const itemId = newItem.itemId;
    const quantity = toNumber(newItem.quantity);
    const costPerUnit = toNumber(newItem.costPerUnit);

    if (!itemId) {
      toast.error('Please select an item');
      return;
    }

    if (quantity <= 0 || costPerUnit <= 0) {
      toast.error('Quantity and cost must be greater than zero');
      return;
    }

    // Bottle quantities must be whole numbers.
    if (itemType === 'Bottle' && !Number.isInteger(quantity)) {
      toast.error('Bottle quantity must be a whole number');
      return;
    }

    const duplicate = form.items.some(
      (item) => item.item === itemId && item.itemType === itemType
    );

    if (duplicate) {
      toast.error('This item is already added to the purchase');
      return;
    }

    const itemDetails =
      itemType === 'RawMaterial'
        ? materials.find((material) => material._id === itemId)
        : bottles.find((bottle) => bottle._id === itemId);

    if (!itemDetails) {
      toast.error('Selected inventory item was not found');
      return;
    }

    const totalCost = Number((quantity * costPerUnit).toFixed(2));

    const newItemEntry = {
      itemType,
      item: itemId,
      quantity,
      costPerUnit,
      totalCost,
      _tempItem: itemDetails,
    };

    setForm((prev) => ({
      ...prev,
      items: [...prev.items, newItemEntry],
    }));

    setNewItem({
      itemType: 'RawMaterial',
      itemId: '',
      quantity: 1,
      costPerUnit: 0,
    });
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateTotal = () => {
    return form.items.reduce(
      (sum, item) => sum + toNumber(item.quantity) * toNumber(item.costPerUnit),
      0
    );
  };

  const getItemName = (type, id) => {
    if (type === 'RawMaterial') {
      const material = materials.find((item) => item._id === id);

      return material
        ? `${material.name} (${material.sku})`
        : 'Unknown material';
    }

    const bottle = bottles.find((item) => item._id === id);

    return bottle
      ? `${bottle.sizeMl}ml ${bottle.type}`
      : 'Unknown bottle';
  };

  // ---------------------------------------------
  // SUBMIT PURCHASE
  // ---------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.invoiceNo.trim()) {
      toast.error('Invoice number is required');
      return;
    }

    if (!form.purchaseDate) {
      toast.error('Purchase date is required');
      return;
    }

    if (form.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    for (let index = 0; index < form.items.length; index++) {
      const item = form.items[index];

      if (!item.item || !item.itemType) {
        toast.error(`Row ${index + 1}: Invalid item`);
        return;
      }

      if (
        toNumber(item.quantity) <= 0 ||
        toNumber(item.costPerUnit) <= 0
      ) {
        toast.error(`Row ${index + 1}: Invalid quantity or cost`);
        return;
      }

      if (
        item.itemType === 'Bottle' &&
        !Number.isInteger(toNumber(item.quantity))
      ) {
        toast.error(`Row ${index + 1}: Bottle quantity must be a whole number`);
        return;
      }
    }

    setLoading(true);

    try {
      const totalAmount = Number(calculateTotal().toFixed(2));

      const payload = {
        invoiceNo: form.invoiceNo.trim(),
        supplier: form.supplier.trim(),
        purchaseDate: form.purchaseDate,
        notes: form.notes.trim(),

        items: form.items.map((item) => ({
          itemType: item.itemType,
          item: item.item,
          quantity: toNumber(item.quantity),
          costPerUnit: toNumber(item.costPerUnit),
          totalCost: Number(
            (toNumber(item.quantity) * toNumber(item.costPerUnit)).toFixed(2)
          ),
        })),

        totalAmount,
      };

      await API.post('/purchases', payload);

      toast.success('Purchase created successfully');

      navigate('/purchases');
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to create purchase'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------
  // RENDER
  // ---------------------------------------------

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate('/purchases')}
          className="text-gray-500 hover:text-gray-700 transition p-1"
          aria-label="Go back"
        >
          <X size={24} />
        </button>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            New Purchase
          </h1>
          <p className="text-sm text-gray-500">
            Record raw material and bottle purchases
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice & Supplier */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice No *
              </label>

              <input
                type="text"
                value={form.invoiceNo}
                onChange={(e) =>
                  setForm({ ...form, invoiceNo: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>

              <input
                type="text"
                value={form.supplier}
                onChange={(e) =>
                  setForm({ ...form, supplier: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
                placeholder="Supplier name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>

              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) =>
                  setForm({ ...form, purchaseDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>

            <input
              type="text"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
              placeholder="Optional notes"
            />
          </div>
        </div>

        {/* Add Item Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Add Items
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Type
              </label>

              <select
                value={newItem.itemType}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    itemType: e.target.value,
                    itemId: '',
                    quantity: 1,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm sm:text-base"
              >
                <option value="RawMaterial">Raw Material</option>
                <option value="Bottle">Bottle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item
              </label>

              <div className="flex gap-2">
                <select
                  value={newItem.itemId}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      itemId: e.target.value,
                    })
                  }
                  disabled={itemsLoading}
                  className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm sm:text-base truncate"
                >
                  <option value="">
                    {itemsLoading ? 'Loading items...' : 'Select Item'}
                  </option>

                  {newItem.itemType === 'RawMaterial'
                    ? materials.map((material) => (
                        <option key={material._id} value={material._id}>
                          {material.name} ({material.sku}) -{' '}
                          {material.currentStockMl || 0}ml
                        </option>
                      ))
                    : bottles.map((bottle) => (
                        <option key={bottle._id} value={bottle._id}>
                          {bottle.sizeMl}ml {bottle.type} -{' '}
                          {bottle.currentStock || 0}pcs
                        </option>
                      ))}
                </select>

                <button
                  type="button"
                  onClick={() => openQuickAdd(newItem.itemType)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap text-sm"
                >
                  + New
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity {newItem.itemType === 'RawMaterial' ? '(ml)' : '(pcs)'}
              </label>

              <input
                type="number"
                min={newItem.itemType === 'RawMaterial' ? '0.01' : '1'}
                step={newItem.itemType === 'RawMaterial' ? '0.01' : '1'}
                value={newItem.quantity}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    quantity:
                      e.target.value === ''
                        ? ''
                        : Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Per Unit (৳)
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.costPerUnit}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    costPerUnit:
                      e.target.value === ''
                        ? ''
                        : Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            disabled={itemsLoading}
            className="mt-4 flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-200 transition text-sm sm:text-base disabled:opacity-50"
          >
            <Plus size={18} />
            Add Item
          </button>
        </div>

        {/* Items List */}
        {form.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Items Added
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
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
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {form.items.map((item, index) => {
                    const itemName =
                      item._tempItem?.name ||
                      item._tempItem?.sku ||
                      getItemName(item.itemType, item.item);

                    return (
                      <tr key={`${item.item}-${index}`}>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.itemType === 'RawMaterial'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {item.itemType === 'RawMaterial' ? 'Oil' : 'Bottle'}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 truncate max-w-[120px] sm:max-w-xs">
                          {itemName}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                          {item.quantity}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                          ৳{toNumber(item.costPerUnit).toFixed(2)}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold">
                          ৳{(
                            toNumber(item.quantity) *
                            toNumber(item.costPerUnit)
                          ).toFixed(2)}
                        </td>

                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800 transition p-1"
                            aria-label="Remove item"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td
                      colSpan="4"
                      className="px-3 sm:px-4 py-2 sm:py-3 text-right"
                    >
                      Grand Total
                    </td>

                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-amber-600">
                      ৳{calculateTotal().toFixed(2)}
                    </td>

                    <td className="px-3 sm:px-4 py-2 sm:py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading || form.items.length === 0}
            className="w-full sm:flex-1 bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Save size={20} />
            {loading ? 'Saving...' : 'Save Purchase'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm sm:text-base"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* QUICK-ADD MODAL */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold mb-2">
              Add New{' '}
              {quickAddType === 'RawMaterial' ? 'Raw Material' : 'Bottle'}
            </h2>

            <p className="text-gray-500 text-sm mb-4">
              Create a new inventory item and select it for this purchase.
            </p>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              {quickAddType === 'RawMaterial' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>

                    <input
                      type="text"
                      value={newMaterialData.name}
                      onChange={(e) =>
                        setNewMaterialData({
                          ...newMaterialData,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU *
                    </label>

                    <input
                      type="text"
                      value={newMaterialData.sku}
                      onChange={(e) =>
                        setNewMaterialData({
                          ...newMaterialData,
                          sku: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>

                    <select
                      value={newMaterialData.type}
                      onChange={(e) =>
                        setNewMaterialData({
                          ...newMaterialData,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                    >
                      <option value="oil">Oil</option>
                      <option value="ethanol">Ethanol</option>
                      <option value="fixative">Fixative</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Size (ml) *
                    </label>

                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={newBottleData.sizeMl}
                      onChange={(e) =>
                        setNewBottleData({
                          ...newBottleData,
                          sizeMl: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>

                    <select
                      value={newBottleData.type}
                      onChange={(e) =>
                        setNewBottleData({
                          ...newBottleData,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                    >
                      <option value="spray">Spray</option>
                      <option value="roll-on">Roll-on</option>
                    </select>
                  </div>
                </>
              )}

              {quickAddError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {quickAddError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={quickAddSubmitting}
                  className="w-full sm:flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {quickAddSubmitting ? 'Creating...' : 'Create & Select'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
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

export default NewPurchase;
