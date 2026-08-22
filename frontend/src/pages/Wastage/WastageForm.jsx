import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const WastageForm = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await API.post('/expenses', {
        type: 'regular',
        category: 'Wastage',
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        description: description || 'Wastage recorded',
        reference: 'Wastage',
      });
      toast.success('Wastage recorded successfully');
      setAmount('');
      setDescription('');
      navigate('/wastage');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record wastage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Record Wastage</h1>
      <p className="text-gray-500 text-sm mb-6">
        Enter the amount and description of the wastage. This will be added as an expense and will reduce your available cash.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            placeholder="Enter amount"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            placeholder="Optional description"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Recording...' : 'Record Wastage'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/wastage')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default WastageForm;