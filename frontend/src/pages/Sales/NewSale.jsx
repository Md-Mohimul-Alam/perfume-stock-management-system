import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const NewSale = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    channel: '',
    items: [],
    paymentStatus: 'paid',
    saleDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [error, setError] = useState('');

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(''); // new state for editable unit price

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await API.get('/products');
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // When product or size changes, update the default unit price
  useEffect(() => {
    if (selectedProduct && selectedSize) {
      const product = products.find(p => p._id === selectedProduct);
      if (product) {
        const sizeVariant = product.sizes.find(s => s.sizeMl === parseFloat(selectedSize));
        if (sizeVariant && sizeVariant.sellingPrice) {
          setUnitPrice(sizeVariant.sellingPrice.toString());
        }
      }
    }
  }, [selectedProduct, selectedSize, products]);

  const handleAddItem = () => {
    if (!selectedProduct || !selectedSize || !quantity || quantity <= 0) {
      toast.error('Please select product, size and enter valid quantity');
      return;
    }
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit price');
      return;
    }
    const product = products.find(p => p._id === selectedProduct);
    if (!product) return;
    const sizeVariant = product.sizes.find(s => s.sizeMl === parseFloat(selectedSize));
    if (!sizeVariant) {
      toast.error('Size not found for this product');
      return;
    }
    const existing = form.items.find(
      item => item.product === selectedProduct && item.sizeMl === parseFloat(selectedSize)
    );
    if (existing) {
      toast.error('Item already added');
      return;
    }
    const newItem = {
      product: selectedProduct,
      sizeMl: parseFloat(selectedSize),
      quantity: parseInt(quantity),
      unitPrice: price,
      totalPrice: parseInt(quantity) * price,
    };
    setForm({ ...form, items: [...form.items, newItem] });
    // Reset fields
    setSelectedProduct('');
    setSelectedSize('');
    setQuantity(1);
    setUnitPrice('');
  };

  const removeItem = (index) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      setError('At least one item is required');
      return;
    }
    if (!form.channel) {
      setError('Please select a channel');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        saleDate: new Date(form.saleDate).toISOString(),
        items: form.items.map(item => ({
          product: item.product,
          sizeMl: item.sizeMl,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      };
      await API.post('/sales', payload);
      toast.success('Sale created successfully');
      navigate('/sales');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create sale');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = form.items.reduce((sum, item) => sum + item.totalPrice, 0);

  const channelOptions = ['Fair1', 'Fair2', 'Fair3', 'Fair4', 'Fair5', 'August', 'September', 'October', 'November', 'December', 'Online', 'Other'];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">New Sale</h1>
      <div className="bg-white rounded-2xl shadow-card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel *</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                required
              >
                <option value="">Select channel</option>
                {channelOptions.map(ch => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
              >
                <option value="paid">Paid</option>
                <option value="due">Due</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold mb-4">Add Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedSize('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                >
                  <option value="">Select product</option>
                  {products.filter(p => p.isActive !== false).map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (ml)</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
                >
                  <option value="">Select size</option>
                  {selectedProduct && products.find(p => p._id === selectedProduct)?.sizes.map(s => (
                    <option key={s.sizeMl} value={s.sizeMl}>{s.sizeMl} ml</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="Price per unit"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-secondary transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add
                </button>
              </div>
            </div>
          </div>

          {form.items.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold mb-4">Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {form.items.map((item, idx) => {
                      const product = products.find(p => p._id === item.product);
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-3">{product?.name || 'Unknown'}</td>
                          <td className="px-4 py-3">{item.sizeMl}</td>
                          <td className="px-4 py-3">{item.quantity}</td>
                          <td className="px-4 py-3">৳{item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 font-semibold">৳{item.totalPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-gray-50">
                      <td colSpan="4" className="px-4 py-3 text-right">Grand Total</td>
                      <td className="px-4 py-3">৳{totalAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-brand-secondary transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Sale'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales')}
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

export default NewSale;