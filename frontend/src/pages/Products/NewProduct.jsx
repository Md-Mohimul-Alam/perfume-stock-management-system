import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Trash2, AlertCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const NewProduct = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Product fields – INCLUDING NEW ONES
  const [product, setProduct] = useState({
    name: '',
    sku: '',
    type: 'spray',
    description: '',
    intensity: 'medium',
    bestFor: [],
    notes: [],
    isBestseller: false,
  });

  // Size variant fields
  const [sizes, setSizes] = useState([]);
  const [sizeForm, setSizeForm] = useState({
    sizeMl: '',
    bottleType: 'spray',
    sellingPrice: '',
  });

  // All bottle types (for dropdown)
  const [bottles, setBottles] = useState([]);

  useEffect(() => {
    fetchBottles();
  }, []);

  const fetchBottles = async () => {
    try {
      const { data } = await API.get('/inventory/bottles');
      setBottles(data);
    } catch (err) {
      toast.error('Failed to load bottles');
    }
  };

  const handleProductChange = (e) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const handleSizeChange = (e) => {
    setSizeForm({ ...sizeForm, [e.target.name]: e.target.value });
  };

  const addSizeVariant = () => {
    const { sizeMl, bottleType, sellingPrice } = sizeForm;
    if (!sizeMl || !sellingPrice) {
      toast.error('Please fill in size and selling price');
      return;
    }
    // Check duplicate
    const exists = sizes.some(s => s.sizeMl === parseFloat(sizeMl) && s.bottleType === bottleType);
    if (exists) {
      toast.error('This size variant already added');
      return;
    }
    setSizes([
      ...sizes,
      {
        sizeMl: parseFloat(sizeMl),
        bottleType,
        sellingPrice: parseFloat(sellingPrice),
        bottleId: bottles.find(b => b.sizeMl === parseFloat(sizeMl) && b.type === bottleType)?._id || '',
      },
    ]);
    // Reset form
    setSizeForm({ sizeMl: '', bottleType: 'spray', sellingPrice: '' });
  };

  const removeSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product.name || !product.sku) {
      setError('Please fill in product name and SKU');
      return;
    }
    if (sizes.length === 0) {
      setError('At least one size variant is required');
      return;
    }
    // Validate each size has a valid bottle reference
    for (const s of sizes) {
      if (!s.bottleId) {
        setError(`Bottle ${s.sizeMl}ml (${s.bottleType}) not found. Please add it first.`);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      // Prepare payload with all fields
      const payload = {
        name: product.name,
        sku: product.sku,
        type: product.type,
        description: product.description,
        intensity: product.intensity,
        bestFor: product.bestFor,
        notes: product.notes,
        isBestseller: product.isBestseller,
        sizes: sizes.map(s => ({
          sizeMl: s.sizeMl,
          bottle: s.bottleId,
          oilMlUsed: 0,
          ethanolMlUsed: 0,
          fixativeMlUsed: 0,
          makingCost: 0,
          sellingPrice: s.sellingPrice,
        })),
        baseOil: null,
        blendComponents: [],
      };
      await API.post('/products', payload);
      toast.success('Product created successfully');
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter bottles by type and size (we need unique combos)
  const uniqueBottleOptions = bottles.reduce((acc, b) => {
    const key = `${b.sizeMl}-${b.type}`;
    if (!acc.find(item => item.sizeMl === b.sizeMl && item.type === b.type)) {
      acc.push({ sizeMl: b.sizeMl, type: b.type });
    }
    return acc;
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Add New Product</h1>
      <div className="bg-white rounded-2xl shadow-card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input
                type="text"
                name="name"
                value={product.name}
                onChange={handleProductChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <input
                type="text"
                name="sku"
                value={product.sku}
                onChange={handleProductChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                name="type"
                value={product.type}
                onChange={handleProductChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
              >
                <option value="spray">Spray</option>
                <option value="roll-on">Roll‑on</option>
              </select>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={product.description}
                onChange={handleProductChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                rows="2"
                placeholder="Short product description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intensity</label>
              <select
                name="intensity"
                value={product.intensity}
                onChange={handleProductChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="strong">Strong</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Best For (comma separated)</label>
              <input
                type="text"
                value={product.bestFor.join(', ')}
                onChange={(e) => {
                  const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setProduct({ ...product, bestFor: val });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                placeholder="e.g. daytime, evening, special"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scent Notes (comma separated)</label>
              <input
                type="text"
                value={product.notes.join(', ')}
                onChange={(e) => {
                  const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setProduct({ ...product, notes: val });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                placeholder="e.g. floral, woody, citrus"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isBestseller"
                checked={product.isBestseller}
                onChange={(e) => setProduct({ ...product, isBestseller: e.target.checked })}
                className="w-4 h-4 text-brand-primary focus:ring-brand-primary"
              />
              <label className="text-sm font-medium text-gray-700">Mark as Bestseller</label>
            </div>
          </div>

          {/* Add Size Variant (unchanged) */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold mb-4">Add Size Variant</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (ml) *</label>
                <input
                  type="number"
                  name="sizeMl"
                  step="0.1"
                  min="0.1"
                  value={sizeForm.sizeMl}
                  onChange={handleSizeChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="e.g. 3.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bottle Type *</label>
                <select
                  name="bottleType"
                  value={sizeForm.bottleType}
                  onChange={handleSizeChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                >
                  <option value="spray">Spray</option>
                  <option value="roll-on">Roll‑on</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (৳) *</label>
                <input
                  type="number"
                  name="sellingPrice"
                  step="0.01"
                  min="0"
                  value={sizeForm.sellingPrice}
                  onChange={handleSizeChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={addSizeVariant}
                  className="w-full bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-secondary transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              The bottle must already exist in the inventory for the selected size and type.
            </p>
          </div>

          {/* Sizes Table (unchanged) */}
          {sizes.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold mb-4">Size Variants ({sizes.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bottle Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sizes.map((s, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">{s.sizeMl}</td>
                        <td className="px-4 py-3 capitalize">{s.bottleType}</td>
                        <td className="px-4 py-3">৳{s.sellingPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeSize(idx)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-brand-secondary transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={18} />
              {submitting ? 'Creating...' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProduct;