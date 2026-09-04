import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Trash2, AlertCircle, Printer } from 'lucide-react';
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
  const [unitPrice, setUnitPrice] = useState('');

  // Channel suggestions
  const channelSuggestions = ['Fair1', 'Fair2', 'Fair3', 'Fair4', 'Fair5', 'August', 'September', 'October', 'November', 'December', 'Online', 'Other'];

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

  // ---------- Print Invoice ----------
  const printInvoice = (sale) => {
    const itemsHtml = sale.items.map(item => {
      const productName = item.product?.name || 'Unknown';
      const size = item.sizeMl || '';
      const qty = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const total = item.totalPrice || 0;
      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${productName}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center;">${size} ml</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center;">${qty}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">৳${unitPrice.toFixed(2)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">৳${total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const totalAmount = sale.totalAmount || 0;
    const logoUrl = window.location.origin + '/logo.jpg';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice ${sale.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #fff; }
            .invoice-box { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b8860b; padding-bottom: 10px; margin-bottom: 20px; }
            .header .brand { display: flex; align-items: center; gap: 12px; }
            .header .brand img { height: 50px; width: auto; object-fit: contain; }
            .header .brand h1 { margin: 0; color: #b8860b; font-size: 24px; }
            .header .payment-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
            .paid { background: #d4edda; color: #155724; }
            .due { background: #fff3cd; color: #856404; }
            .details { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .details .left, .details .right { font-size: 14px; }
            .details .left p, .details .right p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 14px; }
            td { padding: 6px 8px; font-size: 14px; }
            .total-row { font-weight: bold; font-size: 16px; }
            .total-row td { border-top: 2px solid #333; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; }
            @media print {
              body { margin: 0; }
              .invoice-box { box-shadow: none; border: none; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div class="brand">
                <img src="${logoUrl}" alt="Luxe Perfume" />
                <h1>Luxe Perfume</h1>
              </div>
              <div>
                <span class="payment-status ${sale.paymentStatus === 'paid' ? 'paid' : 'due'}">${sale.paymentStatus.toUpperCase()}</span>
              </div>
            </div>
            <div class="details">
              <div class="left">
                <p><strong>Invoice:</strong> ${sale.invoiceNo}</p>
                <p><strong>Date:</strong> ${new Date(sale.saleDate).toLocaleDateString()}</p>
                <p><strong>Channel:</strong> ${sale.channel}</p>
              </div>
              <div class="right">
                ${sale.notes ? `<p><strong>Notes:</strong> ${sale.notes}</p>` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Size (ml)</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Unit Price</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr class="total-row">
                  <td colspan="4" style="text-align:right;">Grand Total</td>
                  <td style="text-align:right;">৳${totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Luxe Perfume • www.luxeperfume.com</p>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow popups to print the invoice.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  // ---------- Handlers ----------
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
      productName: product.name,
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
    if (!form.channel.trim()) {
      setError('Please enter a channel');
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
      const response = await API.post('/sales', payload);
      const createdSale = response.data;

      // Prepare sale data for printing (include product names from form)
      const printData = {
        invoiceNo: createdSale.invoiceNo,
        saleDate: createdSale.saleDate,
        channel: createdSale.channel,
        paymentStatus: createdSale.paymentStatus,
        notes: createdSale.notes,
        items: form.items, // contains productName, sizeMl, etc.
        totalAmount: createdSale.totalAmount,
      };

      // Print the invoice
      printInvoice(printData);

      // Show success and navigate after a short delay
      toast.success('Sale created successfully! Printing invoice...');
      setTimeout(() => {
        navigate('/sales');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create sale');
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = form.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // ---------- Render ----------
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">New Sale</h1>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card dark:shadow-gray-900/30 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel *</label>
              <input
                type="text"
                list="channel-suggestions"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                placeholder="Type or select channel"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                required
              />
              <datalist id="channel-suggestions">
                {channelSuggestions.map(ch => <option key={ch} value={ch} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sale Date</label>
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
              >
                <option value="paid">Paid</option>
                <option value="due">Due</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Add Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedSize('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                >
                  <option value="">Select product</option>
                  {products.filter(p => p.isActive !== false).map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size (ml)</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                >
                  <option value="">Select size</option>
                  {selectedProduct && products.find(p => p._id === selectedProduct)?.sizes.map(s => (
                    <option key={s.sizeMl} value={s.sizeMl}>{s.sizeMl} ml</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Price (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
                  placeholder="Price per unit"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add
                </button>
              </div>
            </div>
          </div>

          {form.items.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size (ml)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {form.items.map((item, idx) => {
                      const product = products.find(p => p._id === item.product);
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{product?.name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{item.sizeMl}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{item.quantity}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">৳{item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">৳{item.totalPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan="4" className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">Grand Total</td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200">৳{totalAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-primary hover:bg-brand-secondary text-white px-6 py-2 rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Sale'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
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