import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import API from '../../api/axios';

const Batches = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [batchData, setBatchData] = useState(null);
  const [error, setError] = useState('');

  // Save to inventory states
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const parseBatchSheet = (rows) => {
    // Remove completely empty rows (all cells are empty strings)
    const cleanRows = rows.filter(row => Object.values(row).some(v => v && v.toString().trim() !== ''));

    // Find batch rows by checking if the first column contains "batch" (case‑insensitive)
    const batchRows = cleanRows.filter(row => {
      const firstVal = Object.values(row)[0]?.toString().trim().toLowerCase() || '';
      return firstVal.includes('batch');
    });

    if (!batchRows.length) {
      const firstRowKeys = Object.keys(cleanRows[0] || {}).join(', ');
      throw new Error(`No batch rows found. Ensure the first column contains "Batch 1", "Batch 2", etc. Found columns: ${firstRowKeys}`);
    }

    const priceRow = cleanRows.find(row => {
      const firstVal = Object.values(row)[0]?.toString().trim().toLowerCase() || '';
      return firstVal.includes('price per bottle');
    });

    const headers = Object.keys(cleanRows[0]);
    const sizeColumns = headers.slice(1);

    const prices = {};
    if (priceRow) {
      const values = Object.values(priceRow);
      sizeColumns.forEach((col, i) => {
        const val = parseFloat(values[i + 1]);
        if (!isNaN(val)) prices[col] = val;
      });
    }

    const clean = (v) => {
      if (typeof v === 'string') v = v.replace(/[^\d.-]/g, '');
      return parseFloat(v);
    };

    const batches = batchRows.map(row => {
      const values = Object.values(row);
      const batchName = values[0]?.toString().trim() || 'Unknown';
      const quantities = {};
      let totalUnits = 0, totalCost = 0;
      sizeColumns.forEach((col, i) => {
        const qty = clean(values[i + 1]);
        if (!isNaN(qty) && qty > 0) {
          quantities[col] = qty;
          totalUnits += qty;
          totalCost += qty * (prices[col] || 0);
        } else quantities[col] = 0;
      });
      return { batchName, quantities, totalUnits, totalCost, avgCost: totalUnits ? totalCost / totalUnits : 0 };
    });

    const overall = batches.reduce((acc, b) => ({
      totalUnits: acc.totalUnits + b.totalUnits,
      totalCost: acc.totalCost + b.totalCost
    }), { totalUnits: 0, totalCost: 0 });
    overall.avgCost = overall.totalUnits ? overall.totalCost / overall.totalUnits : 0;

    const columnTotals = {};
    sizeColumns.forEach(col => {
      columnTotals[col] = batches.reduce((sum, b) => sum + (b.quantities[col] || 0), 0);
    });

    return { batches, overall, sizeColumns, prices, columnTotals };
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setBatchData(null);
    setSaveResult(null);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          const result = parseBatchSheet(rows);
          setBatchData(result);
          setFile(null);
        } catch (err) { setError(err.message); }
        finally { setUploading(false); }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) { setError(err.message); setUploading(false); }
  };

  const clearData = () => {
    setBatchData(null);
    setFile(null);
    setError('');
    setSaveResult(null);
  };

  // ---------- Add to Inventory ----------
  const handleAddToInventory = async () => {
    if (!batchData) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const items = batchData.sizeColumns.map(col => {
        const match = col.match(/([\d.]+)\s*ml\s*(.+)/i);
        if (!match) return null;
        const sizeMl = parseFloat(match[1]);
        let type = match[2].toLowerCase().trim();
        if (type.includes('role') || type.includes('roll')) type = 'roll-on';
        else if (type.includes('spray')) type = 'spray';
        else return null;
        const quantity = batchData.columnTotals[col] || 0;
        if (quantity === 0) return null;
        const costPerUnit = batchData.prices[col] || undefined;
        return { sizeMl, type, quantity, costPerUnit };
      }).filter(item => item !== null);

      if (!items.length) {
        setSaveResult({ success: false, message: 'No valid items to add (zero quantities or unrecognised bottle types).' });
        setSaving(false);
        return;
      }

      const response = await API.post('/inventory/bottles/bulk-add-stock', { items });
      setSaveResult({ success: true, data: response.data });

      setTimeout(() => {
        navigate('/inventory/bottles');
      }, 2000);
    } catch (err) {
      setSaveResult({ success: false, message: err.response?.data?.message || 'Failed to add to inventory' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Batch Production</h1>
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload Production Sheet</h2>
        <p className="text-gray-500 text-sm mb-4">
          Upload Excel/CSV with <strong>batch rows</strong> and a <strong>"Price per Bottle"</strong> row.
          After processing, you can <strong>add all produced bottles to inventory</strong> with one click.
        </p>
        <form onSubmit={handleUpload} className="space-y-4">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="w-full border rounded-lg p-2"
            required
          />
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Upload & Process'}
            </button>
            {batchData && (
              <button
                type="button"
                onClick={clearData}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {batchData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow p-6">
              <p className="text-sm text-gray-500">Total Batches</p>
              <p className="text-3xl font-bold">{batchData.batches.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <p className="text-sm text-gray-500">Total Bottles Produced</p>
              <p className="text-3xl font-bold">{batchData.overall.totalUnits}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <p className="text-sm text-gray-500">Average Cost per Bottle</p>
              <p className="text-3xl font-bold">৳{batchData.overall.avgCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Add to Inventory Button */}
          <div className="flex justify-end">
            <button
              onClick={handleAddToInventory}
              disabled={saving || !batchData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Adding...' : 'Add to Inventory'}
            </button>
          </div>

          {/* Save Result */}
          {saveResult && (
            <div
              className={`p-4 rounded-lg ${
                saveResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {saveResult.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{saveResult.data.message}</p>
                    <p className="text-sm">Updated: {saveResult.data.updated?.length || 0}</p>
                    {saveResult.data.errors?.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sm">
                          View errors ({saveResult.data.errors.length})
                        </summary>
                        <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto">
                          {saveResult.data.errors.map((e, i) => (
                            <li key={i}>
                              • {e.error} {e.item && `(item: ${JSON.stringify(e.item)})`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <p className="text-xs mt-2 text-blue-600">Redirecting to Bottles page...</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <span>{saveResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Batches Table */}
          <div className="bg-white rounded-2xl shadow-xl overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  {batchData.sizeColumns.map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {col}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Units</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Cost/Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batchData.batches.map((b, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 font-medium">{b.batchName}</td>
                    {batchData.sizeColumns.map(col => (
                      <td key={col} className="px-6 py-4">{b.quantities[col] || 0}</td>
                    ))}
                    <td className="px-6 py-4 font-semibold">{b.totalUnits}</td>
                    <td className="px-6 py-4">৳{b.totalCost.toFixed(2)}</td>
                    <td className="px-6 py-4">৳{b.avgCost.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-6 py-4">TOTAL</td>
                  {batchData.sizeColumns.map(col => {
                    const total = batchData.batches.reduce((sum, b) => sum + (b.quantities[col] || 0), 0);
                    return <td key={col} className="px-6 py-4">{total}</td>;
                  })}
                  <td className="px-6 py-4">{batchData.overall.totalUnits}</td>
                  <td className="px-6 py-4">৳{batchData.overall.totalCost.toFixed(2)}</td>
                  <td className="px-6 py-4">৳{batchData.overall.avgCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;