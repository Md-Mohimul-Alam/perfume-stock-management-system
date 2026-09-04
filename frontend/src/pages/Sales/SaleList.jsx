import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { Plus, Eye, Search, Upload, X, CheckCircle, AlertCircle, Trash2, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const SalesList = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ channel: '', paymentStatus: '' });
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({}); // track which invoices are expanded

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Details modal (still used for full view)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Payment status update
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/sales');
      setSales(data);
    } catch (error) {
      toast.error('Failed to load sales');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  const filteredAndSortedSales = useMemo(() => {
    let filtered = sales;
    if (filter.channel) {
      filtered = filtered.filter(s => s.channel === filter.channel);
    }
    if (filter.paymentStatus) {
      filtered = filtered.filter(s => s.paymentStatus === filter.paymentStatus);
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.invoiceNo.toLowerCase().includes(lowerSearch) ||
        s.channel.toLowerCase().includes(lowerSearch) ||
        s.items.some(item => 
          item.product?.sku?.toLowerCase().includes(lowerSearch)
        )
      );
    }
    if (typeFilter) {
      const mappedType = typeFilter === 'oil' ? 'roll-on' : 'spray';
      filtered = filtered.filter(s =>
        s.items.some(item => item.product?.type === mappedType)
      );
    }

    // Sort by invoice number descending (numeric part)
    return filtered.sort((a, b) => {
      const numA = parseInt(a.invoiceNo.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.invoiceNo.replace(/\D/g, '')) || 0;
      return numB - numA;
    });
  }, [sales, filter, search, typeFilter]);
  // Toggle expand row
  const toggleRow = (invoiceNo) => {
    setExpandedRows(prev => ({
      ...prev,
      [invoiceNo]: !prev[invoiceNo],
    }));
  };

  // Channel suggestions
  const channelSuggestions = ['Fair1', 'Fair2', 'Fair3', 'Fair4', 'Fair5', 'August', 'September', 'October', 'November', 'December', 'Online', 'Other'];
  const paymentStatusOptions = ['paid', 'due'];
  const typeOptions = ['oil', 'perfume'];

  // ---------- Flexible column finder ----------
  const findColumn = (obj, possibleNames) => {
    const keys = Object.keys(obj);
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = keys.find(k => {
        const normalizedKey = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedKey === normalizedName ||
               normalizedKey.includes(normalizedName) ||
               normalizedName.includes(normalizedKey);
      });
      if (found) return found;
    }
    return null;
  };

  // ---------- Upload ----------
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
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
          setUploadResult({ success: false, message: 'File is empty' });
          setUploading(false);
          return;
        }

        const firstRow = rows[0];
        const foundColumns = Object.keys(firstRow).join(', ');

        const skuCol = findColumn(firstRow, ['sku', 'sku code', 'product sku']);
        const sizeCol = findColumn(firstRow, ['size', 'sizeml', 'ml', 'size ml']);
        const priceCol = findColumn(firstRow, ['unitprice', 'unit price', 'price', 'selling price', 'rate', 'unit price (৳)']);
        const totalCol = findColumn(firstRow, ['total', 'total price', 'total amount', 'amount', 'total (৳)']);
        const invoiceCol = findColumn(firstRow, ['invoice', 'invoice no', 'invoiceno', 'invoice number']);
        const qtyCol = findColumn(firstRow, ['quantity', 'qty', 'units']);
        const channelCol = findColumn(firstRow, ['channel', 'sales channel', 'fair', 'store']);
        const dateCol = findColumn(firstRow, ['saledate', 'sale date', 'date', 'transaction date']);
        const paymentCol = findColumn(firstRow, ['paymentstatus', 'payment status', 'status']);
        const notesCol = findColumn(firstRow, ['notes', 'note', 'remarks', 'comment']);

        if (!skuCol || !sizeCol || (!priceCol && !totalCol)) {
          setUploadResult({
            success: false,
            message: `Required: SKU, Size, and either Price or Total. Found columns: ${foundColumns}`,
          });
          setUploading(false);
          return;
        }

        const salesMap = new Map();
        const timestamp = Date.now();

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const sku = String(row[skuCol]).trim();
          const sizeMl = parseFloat(row[sizeCol]);
          const quantity = qtyCol ? parseInt(row[qtyCol]) || 1 : 1;

          let unitPrice = NaN;
          if (priceCol) {
            unitPrice = parseFloat(row[priceCol]);
          }
          if ((isNaN(unitPrice) || unitPrice <= 0) && totalCol) {
            const totalVal = parseFloat(row[totalCol]);
            if (!isNaN(totalVal) && quantity > 0) {
              unitPrice = totalVal / quantity;
            }
          }
          if (isNaN(unitPrice) || unitPrice <= 0) {
            continue;
          }

          const channel = channelCol ? String(row[channelCol]).trim() : 'Other';
          const saleDate = dateCol ? row[dateCol] : '';
          const paymentStatus = paymentCol ? String(row[paymentCol]).toLowerCase().trim() : 'paid';
          const notes = notesCol ? String(row[notesCol]).trim() : '';

          let invoice;
          if (invoiceCol) {
            invoice = String(row[invoiceCol]).trim();
            if (!invoice) invoice = `SALE-${timestamp}-${String(idx + 1).padStart(3, '0')}`;
          } else {
            invoice = `SALE-${timestamp}-${String(idx + 1).padStart(3, '0')}`;
          }

          if (!salesMap.has(invoice)) {
            salesMap.set(invoice, {
              invoiceNo: invoice,
              channel: channel || 'Other',
              saleDate: saleDate || '',
              paymentStatus: paymentStatus || 'paid',
              items: [],
              notes: notes || '',
            });
          }
          const sale = salesMap.get(invoice);
          sale.items.push({ sku, sizeMl, quantity, unitPrice });
        }

        const salesArray = Array.from(salesMap.values()).filter(s => s.items.length > 0);

        if (!salesArray.length) {
          setUploadResult({
            success: false,
            message: `No valid rows. Ensure SKU, Size, and Price/Total are valid. Found: ${foundColumns}`,
          });
          setUploading(false);
          return;
        }

        const response = await API.post('/sales/bulk', { sales: salesArray });
        setUploadResult({ success: true, data: response.data });
        fetchSales();
        setFile(null);
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

  // ---------- View Details ----------
  const handleViewDetails = async (saleId) => {
    setDetailsLoading(true);
    setShowDetailsModal(true);
    try {
      const { data: sale } = await API.get(`/sales/${saleId}`);

      const productIds = sale.items
        .map(item => item.product?._id || item.product)
        .filter(id => id);

      let productsMap = {};
      if (productIds.length > 0) {
        const productPromises = productIds.map(id => API.get(`/products/${id}`));
        const productResponses = await Promise.all(productPromises);
        productsMap = productResponses.reduce((acc, res) => {
          const p = res.data;
          acc[p._id] = p;
          return acc;
        }, {});
      }

      sale.items = sale.items.map(item => {
        const productId = item.product?._id || item.product;
        const product = productsMap[productId] || null;
        return {
          ...item,
          product: product || { name: 'Unknown', description: '' }
        };
      });

      setSelectedSale(sale);
    } catch (error) {
      toast.error('Failed to load sale details');
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ---------- Update Payment Status ----------
  const updatePaymentStatus = async (saleId, newStatus) => {
    setUpdatingStatus(saleId);
    try {
      await API.patch(`/sales/${saleId}`, { paymentStatus: newStatus });
      setSales(prevSales =>
        prevSales.map(s =>
          s._id === saleId ? { ...s, paymentStatus: newStatus } : s
        )
      );
      toast.success(`Payment status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update payment status');
      console.error(error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ---------- Delete ----------
  const handleDeleteClick = (sale) => {
    setSaleToDelete(sale);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    setDeleting(true);
    try {
      await API.delete(`/sales/${saleToDelete._id}`);
      toast.success('Sale deleted successfully');
      setShowDeleteModal(false);
      setSaleToDelete(null);
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Render ----------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Sales</h1>
        <div className="flex gap-3">
          <Link
            to="/sales/new"
            className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-secondary transition"
          >
            <Plus size={18} /> New Sale
          </Link>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Upload size={18} /> Upload Sales
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Invoice, Channel or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none"
          />
        </div>
      </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
          <input
            type="text"
            list="channel-filter-suggestions"
            name="channel"
            value={filter.channel}
            onChange={handleFilterChange}
            placeholder="All or type"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
          />
          <datalist id="channel-filter-suggestions">
            {channelSuggestions.map(ch => <option key={ch} value={ch} />)}
          </datalist>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
          <select
            name="paymentStatus"
            value={filter.paymentStatus}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
          >
            <option value="">All</option>
            {paymentStatusOptions.map(ps => <option key={ps} value={ps}>{ps.charAt(0).toUpperCase() + ps.slice(1)}</option>)}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary outline-none bg-white"
          >
            <option value="">All</option>
            {typeOptions.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <button
          onClick={() => { setFilter({ channel: '', paymentStatus: '' }); setSearch(''); setTypeFilter(''); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading sales...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total (৳)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedSales.map((s) => {
                const isExpanded = expandedRows[s.invoiceNo];
                return (
                  <React.Fragment key={s._id}>
                    {/* Main row */}
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(s.invoiceNo)}>
                      <td className="px-6 py-4 font-medium">{s.invoiceNo}</td>
                      <td className="px-6 py-4">{new Date(s.saleDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{s.channel}</td>
                      <td className="px-6 py-4 font-semibold">৳{s.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <select
                          value={s.paymentStatus}
                          onChange={(e) => updatePaymentStatus(s._id, e.target.value)}
                          disabled={updatingStatus === s._id}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-brand-secondary outline-none cursor-pointer ${
                            s.paymentStatus === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          <option value="paid">Paid</option>
                          <option value="due">Due</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewDetails(s._id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => printInvoice(s)}
                            className="text-green-600 hover:text-green-800"
                            title="Print Invoice"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(s)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-400 hover:text-gray-600 transition">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded row – shows items */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan="7" className="px-6 py-4">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {s.items.map((item, idx) => {
                                  const product = item.product || { name: 'Unknown' };
                                  return (
                                    <tr key={idx}>
                                      <td className="px-4 py-2">{product.name}</td>
                                      <td className="px-4 py-2">{item.sizeMl}</td>
                                      <td className="px-4 py-2">{item.quantity}</td>
                                      <td className="px-4 py-2">৳{item.unitPrice.toFixed(2)}</td>
                                      <td className="px-4 py-2 font-semibold">৳{item.totalPrice.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="font-bold bg-gray-100">
                                  <td colSpan="4" className="px-4 py-2 text-right">Grand Total</td>
                                  <td className="px-4 py-2">৳{s.totalAmount.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredAndSortedSales.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">No sales found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && saleToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Delete Sale</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete sale <strong>{saleToDelete.invoiceNo}</strong>?
              <br />
              <span className="text-sm text-gray-500">This will also remove all associated inventory logs and transactions.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setSaleToDelete(null); }}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
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
            <h2 className="text-2xl font-bold mb-2">Bulk Upload Sales</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with columns: <strong>SKU, Size, Price</strong> (or UnitPrice) <strong>or Total</strong>.
              <br />
              Optional: <strong>Invoice, Quantity, Channel, SaleDate, PaymentStatus, Notes</strong>.
              <br />
              If no Invoice column, each row becomes its own sale. If Invoice column exists, rows with the same Invoice are grouped.
              <br />
              <span className="text-amber-600">Note:</span> Products must already exist in the system.
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
                                  • {e.error} {e.saleData && `(sale: ${JSON.stringify(e.saleData)})`}
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

      {/* Details Modal – added Print button */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Sale Details</h2>
              <div className="flex gap-2">
                {selectedSale && (
                  <button
                    onClick={() => printInvoice(selectedSale)}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    <Printer size={18} /> Print
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedSale(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {detailsLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>Loading sale details...</p>
                </div>
              </div>
            ) : selectedSale ? (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Invoice</p>
                    <p className="font-semibold">{selectedSale.invoiceNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-semibold">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Channel</p>
                    <p className="font-semibold">{selectedSale.channel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedSale.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedSale.paymentStatus}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-2xl font-bold text-brand-primary">৳{selectedSale.totalAmount.toFixed(2)}</p>
                  </div>
                  {selectedSale.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-sm">{selectedSale.notes}</p>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold mb-3">Items</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedSale.items.map((item, idx) => {
                        const productType = item.product?.type || 'N/A';
                        const typeLabel = productType === 'roll-on' ? 'oil' : (productType === 'spray' ? 'perfume' : 'N/A');
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium">{item.product?.name || 'Unknown'}</td>
                            <td className="px-4 py-3 max-w-xs truncate" title={item.product?.description || ''}>
                              {item.product?.description || '—'}
                            </td>
                            <td className="px-4 py-3">{item.sizeMl} ml</td>
                            <td className="px-4 py-3">{typeLabel}</td>
                            <td className="px-4 py-3">{item.quantity}</td>
                            <td className="px-4 py-3">৳{item.unitPrice.toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold">৳{item.totalPrice.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="font-bold bg-gray-50">
                        <td colSpan="6" className="px-4 py-3 text-right">Grand Total</td>
                        <td className="px-4 py-3">৳{selectedSale.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center py-8">No data found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesList;