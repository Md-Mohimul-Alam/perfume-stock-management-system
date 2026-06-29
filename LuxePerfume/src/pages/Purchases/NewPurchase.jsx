import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Trash2, Save, X, Package, Droplet } from 'lucide-react';
import toast from 'react-hot-toast';

const NewPurchase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [bottles, setBottles] = useState([]);

  const [form, setForm] = useState({
    invoiceNo: '',
    supplier: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  const [newItem, setNewItem] = useState({
    itemType: 'RawMaterial',
    itemId: '',
    quantity: 1,
    costPerUnit: 0,
  });

  useEffect(() => {
    // Fetch all raw materials and bottles for dropdowns
    const fetchItems = async () => {
      try {
        const [matsRes, botsRes] = await Promise.all([
          API.get('/inventory/materials'),
          API.get('/inventory/bottles'),
        ]);
        setMaterials(matsRes.data);
        setBottles(botsRes.data);
      } catch (error) {
        toast.error('Failed to load items');
      }
    };
    fetchItems();
  }, []);

  // Auto-generate invoice number
  useEffect(() => {
    if (!form.invoiceNo) {
      const now = new Date();
      const prefix = 'PUR-' + now.getFullYear().toString().slice(-2) + 
                     String(now.getMonth()+1).padStart(2,'0') + 
                     String(now.getDate()).padStart(2,'0') + '-';
      // We'll set a placeholder, but user can change it
      setForm(prev => ({ ...prev, invoiceNo: prefix + '001' }));
    }
  }, []);

  const handleAddItem = () => {
    const { itemType, itemId, quantity, costPerUnit } = newItem;
    if (!itemId) {
      toast.error('Please select an item');
      return;
    }
    if (quantity <= 0 || costPerUnit <= 0) {
      toast.error('Quantity and cost must be positive');
      return;
    }

    // Find selected item details
    let itemDetails = null;
    if (itemType === 'RawMaterial') {
      itemDetails = materials.find(m => m._id === itemId);
    } else {
      itemDetails = bottles.find(b => b._id === itemId);
    }
    if (!itemDetails) {
      toast.error('Selected item not found');
      return;
    }

    const totalCost = quantity * costPerUnit;
    const newItemEntry = {
      itemType,
      item: itemId,
      quantity,
      costPerUnit,
      totalCost,
      _tempItem: itemDetails, // for display
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItemEntry],
    }));

    // Reset new item fields
    setNewItem({
      itemType: 'RawMaterial',
      itemId: '',
      quantity: 1,
      costPerUnit: 0,
    });
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateTotal = () => {
    return form.items.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        invoiceNo: form.invoiceNo,
        supplier: form.supplier,
        purchaseDate: form.purchaseDate,
        notes: form.notes,
        items: form.items.map(({ itemType, item, quantity, costPerUnit, totalCost }) => ({
          itemType,
          item,
          quantity,
          costPerUnit,
          totalCost,
        })),
        totalAmount: calculateTotal(),
      };

      await API.post('/purchases', payload);
      toast.success('Purchase created successfully');
      navigate('/purchases');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create purchase');
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (type, id) => {
    if (type === 'RawMaterial') {
      const mat = materials.find(m => m._id === id);
      return mat ? `${mat.name} (${mat.sku})` : 'Unknown';
    } else {
      const bot = bottles.find(b => b._id === id);
      return bot ? `${bot.sizeMl}ml ${bot.type} (${bot.sku})` : 'Unknown';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/purchases')}
          className="text-gray-500 hover:text-gray-700 transition"
        >
          <X size={24} />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">New Purchase</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice & Supplier */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No *</label>
              <input
                type="text"
                value={form.invoiceNo}
                onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Supplier name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="Optional notes"
            />
          </div>
        </div>

        {/* Add Item Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Add Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
              <select
                value={newItem.itemType}
                onChange={(e) => {
                  setNewItem({ ...newItem, itemType: e.target.value, itemId: '' });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="RawMaterial">Raw Material</option>
                <option value="Bottle">Bottle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
              <select
                value={newItem.itemId}
                onChange={(e) => setNewItem({ ...newItem, itemId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="">Select Item</option>
                {newItem.itemType === 'RawMaterial' ? (
                  materials.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.sku}) - {m.stock}ml
                    </option>
                  ))
                ) : (
                  bottles.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.sizeMl}ml {b.type} ({b.sku}) - {b.stock}pcs
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                step="1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit (৳)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.costPerUnit}
                onChange={(e) => setNewItem({ ...newItem, costPerUnit: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="mt-4 flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-200 transition"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* Items List */}
        {form.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Items Added</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {form.items.map((item, idx) => {
                    const itemName = item._tempItem?.name || item._tempItem?.sku || 
                                     getItemName(item.itemType, item.item);
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.itemType === 'RawMaterial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.itemType === 'RawMaterial' ? 'Oil' : 'Bottle'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{itemName}</td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">৳{item.costPerUnit.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold">৳{item.totalCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-600 hover:text-red-800 transition"
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
                    <td colSpan="4" className="px-4 py-3 text-right">Grand Total</td>
                    <td className="px-4 py-3 text-right text-amber-600">৳{calculateTotal().toFixed(2)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || form.items.length === 0}
            className="flex-1 bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {loading ? 'Saving...' : 'Save Purchase'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewPurchase;