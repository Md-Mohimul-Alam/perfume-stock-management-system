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

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      await API.post('/expenses', {
        type: 'regular',
        category: 'Wastage',
        amount: parsedAmount,
        date: new Date().toISOString().split('T')[0],
        description: description.trim() || 'Wastage recorded',
        reference: 'Wastage',
      });

      toast.success('Wastage recorded successfully');
      setAmount('');
      setDescription('');
      navigate('/wastage');
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        'Failed to record wastage'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:mt-10 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Record Wastage
      </h1>

      <p className="mb-6 mt-2 text-sm text-gray-500 dark:text-gray-400">
        Enter the amount and description of the wastage. This will be
        recorded as an expense and reduce available cash.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount (৳) *
          </label>

          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
            placeholder="Enter amount"
            required
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
            placeholder="Optional description"
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Wastage'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/wastage')}
            disabled={submitting}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default WastageForm;
