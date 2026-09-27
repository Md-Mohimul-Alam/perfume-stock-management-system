import { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Loader2, RefreshCw, Eye, Trash2, X, CheckCircle,
  AlertCircle, Phone, MapPin, Building2, User, PackageCheck, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setRefreshing(true);
    try {
      const { data } = await API.get('/orders');
      setOrders(data);
    } catch (error) {
      toast.error('Failed to load orders');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePlaceOrder = async (order) => {
    if (!window.confirm(`Place order ${order.orderNo}? This will create a sale and deduct stock.`)) return;
    setPlacing(true);
    try {
      const { data } = await API.post(`/orders/${order.id || order._id}/place`);
      toast.success(data.message || 'Order placed successfully');
      setShowDetails(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete order ${order.orderNo}?`)) return;
    try {
      await API.delete(`/orders/${order._id}`);
      toast.success('Order deleted');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    try {
      await API.put(`/orders/${order._id}/status`, { status: newStatus });
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full flex items-center gap-1"><Clock size={12}/> Pending</span>;
      case 'placed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1"><CheckCircle size={12}/> Placed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Cancelled</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => filterStatus === 'all' || o.status === filterStatus);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    placed: orders.filter(o => o.status === 'placed').length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Orders</h1>
          <p className="text-gray-500 text-sm">Customer orders from the client site</p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={refreshing}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Placed</p>
          <p className="text-2xl font-bold text-green-700">{stats.placed}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm min-w-[180px]"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="placed">Placed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-gray-500">Loading orders...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">{order.orderNo}</td>
                    <td className="px-4 py-3 text-sm">{order.customer.name}</td>
                    <td className="px-4 py-3 text-sm">{order.customer.mobile}</td>
                    <td className="px-4 py-3 text-sm">{order.customer.city}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 text-sm">
                      ৳{order.totalAmount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => { setSelectedOrder(order); setShowDetails(true); }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handlePlaceOrder(order)}
                            className="text-green-600 hover:text-green-800 p-1"
                            title="Place Order (create sale)"
                          >
                            <PackageCheck size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(order)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                          disabled={!!order.saleId}
                        >
                          <Trash2 size={18} className={order.saleId ? 'opacity-30' : ''} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => { setShowDetails(false); setSelectedOrder(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Order Details</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedOrder.orderNo} · {formatDate(selectedOrder.createdAt)}</p>
              </div>
              {getStatusBadge(selectedOrder.status)}
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Customer</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><User size={16} className="text-gray-400" /> {selectedOrder.customer.name}</div>
                <div className="flex items-center gap-2"><Phone size={16} className="text-gray-400" /> {selectedOrder.customer.mobile}</div>
                <div className="flex items-center gap-2 sm:col-span-2"><MapPin size={16} className="text-gray-400" /> {selectedOrder.customer.address}</div>
                <div className="flex items-center gap-2"><Building2 size={16} className="text-gray-400" /> {selectedOrder.customer.city}</div>
              </div>
            </div>

            {/* Items */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Items</h3>
            <div className="overflow-x-auto mb-5">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-sm">{it.name}</td>
                      <td className="px-3 py-2 text-right text-sm">{it.sizeMl}ml</td>
                      <td className="px-3 py-2 text-right text-sm">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-sm">৳{it.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold">৳{it.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr><td colSpan="4" className="px-3 py-2 text-right text-sm">Subtotal</td><td className="px-3 py-2 text-right text-sm">৳{selectedOrder.subtotal.toFixed(2)}</td></tr>
                  <tr><td colSpan="4" className="px-3 py-2 text-right text-sm">Tax</td><td className="px-3 py-2 text-right text-sm">৳{(selectedOrder.tax || 0).toFixed(2)}</td></tr>
                  <tr><td colSpan="4" className="px-3 py-2 text-right text-sm">Shipping</td><td className="px-3 py-2 text-right text-sm">৳{(selectedOrder.shipping || 0).toFixed(2)}</td></tr>
                  <tr><td colSpan="4" className="px-3 py-2 text-right text-sm">Grand Total</td><td className="px-3 py-2 text-right text-emerald-600">৳{selectedOrder.totalAmount.toFixed(2)}</td></tr>
                </tfoot>
              </table>
            </div>

            {/* Actions */}
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handlePlaceOrder(selectedOrder)}
                  disabled={placing}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {placing ? <><Loader2 size={18} className="animate-spin"/> Placing...</> : <><PackageCheck size={18}/> Place Order & Create Sale</>}
                </button>
                <button
                  onClick={() => handleStatusChange(selectedOrder, 'cancelled')}
                  className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {selectedOrder.saleId && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
                <CheckCircle size={18} />
                Linked to Sale <strong>{selectedOrder.saleId.invoiceNo || selectedOrder.saleId}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;