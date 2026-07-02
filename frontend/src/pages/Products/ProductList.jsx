import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import {
  Plus, Search, Eye, Edit, Trash2,
  X, CheckCircle, AlertCircle, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterIntensity, setFilterIntensity] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Bulk upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/products');
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await API.delete(`/products/${productToDelete._id}`);
      toast.success('Product deactivated');
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  // ---------- Bulk Upload Handlers ----------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('📎 File selected:', file.name, file.size);
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  const parseSize = (sizeStr) => {
    if (!sizeStr) return null;
    const trimmed = String(sizeStr).trim();
    // Try to match "3.5ml Roll-on" or "3ml Spray" etc.
    const match = trimmed.match(/^([\d.]+)\s*ml\s*(.+)$/i);
    if (match) {
      const sizeMl = parseFloat(match[1]);
      let type = match[2].toLowerCase().trim();
      if (type.includes('role') || type.includes('roll')) type = 'roll-on';
      else if (type.includes('spray')) type = 'spray';
      else type = 'spray';
      return { sizeMl, type };
    }
    // Try alternate format: "3ml Role" (common typo)
    const altMatch = trimmed.match(/^([\d.]+)\s*ml\s*(.+)$/i);
    if (altMatch) {
      const sizeMl = parseFloat(altMatch[1]);
      let type = altMatch[2].toLowerCase().trim();
      if (type.includes('role') || type.includes('roll')) type = 'roll-on';
      else if (type.includes('spray')) type = 'spray';
      else type = 'spray';
      return { sizeMl, type };
    }
    console.warn('⚠️ Could not parse size:', sizeStr);
    return null;
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          console.log('📊 Rows found:', rows.length);

          if (!rows.length) {
            setUploadResult({ success: false, message: 'File is empty' });
            setUploading(false);
            return;
          }

          const firstRow = rows[0];
          const columns = Object.keys(firstRow);
          console.log('📋 Columns found:', columns);

          // Column mapping – case insensitive
          const findCol = (possibleNames) => {
            for (const name of possibleNames) {
              const found = columns.find(
                c => c.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
              );
              if (found) return found;
            }
            return null;
          };

          const nameCol = findCol(['product name', 'name', 'productname']);
          const skuCol = findCol(['sku', 'code', 'sku code']);
          const sizeCol = findCol(['size', 'sizeml', 'ml', 'sizeml']);
          const priceCol = findCol(['price', 'sellingprice', 'sellingprice', 'unitprice']);
          const descCol = findCol(['description', 'desc', 'descriptions']);
          const intensityCol = findCol(['intensity', 'strength']);
          const bestForCol = findCol(['best for', 'bestfor', 'occasion']);
          const notesCol = findCol(['notes', 'scent notes', 'scentnotes']);
          const bestsellerCol = findCol(['bestseller', 'isbestseller', 'bestseller']);

          console.log('🔍 Column mapping:', { nameCol, skuCol, sizeCol, priceCol });

          // Validate required
          if (!nameCol || !skuCol || !sizeCol || !priceCol) {
            setUploadResult({
              success: false,
              message: `Missing required columns: Product Name, SKU, Size, Price. Found: ${columns.join(', ')}`
            });
            setUploading(false);
            return;
          }

          const items = [];
          const errors = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
              const name = String(row[nameCol] || '').trim();
              const sku = String(row[skuCol] || '').trim();
              const price = parseFloat(row[priceCol]);
              const sizeInfo = parseSize(String(row[sizeCol] || '').trim());

              if (!name || !sku || isNaN(price) || price < 0 || !sizeInfo) {
                errors.push(`Row ${i+2}: Missing or invalid data (name: "${name}", sku: "${sku}", price: "${price}", size: "${row[sizeCol]}")`);
                continue;
              }

              // Convert bestFor and notes – handle comma-separated strings
              const bestForRaw = descCol ? String(row[bestForCol] || '').trim() : '';
              const notesRaw = notesCol ? String(row[notesCol] || '').trim() : '';

              const item = {
                name,
                sku,
                sellingPrice: price,
                sizeMl: sizeInfo.sizeMl,
                bottleType: sizeInfo.type,
                description: descCol ? String(row[descCol] || '').trim() : '',
                intensity: intensityCol ? String(row[intensityCol] || '').toLowerCase().trim() : 'medium',
                bestFor: bestForRaw ? bestForRaw.split(',').map(s => s.trim()).filter(Boolean) : ['all'],
                notes: notesRaw ? notesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
                isBestseller: bestsellerCol ? String(row[bestsellerCol] || '').toLowerCase().trim() === 'true' : false,
              };

              // Validate intensity
              if (!['light', 'medium', 'strong', 'fresh'].includes(item.intensity)) {
                item.intensity = 'medium';
              }

              items.push(item);
            } catch (err) {
              errors.push(`Row ${i+2}: ${err.message}`);
            }
          }

          console.log('📦 Items prepared:', items.length);

          if (!items.length) {
            setUploadResult({
              success: false,
              message: `No valid rows. Errors: ${errors.join('; ')}`
            });
            setUploading(false);
            return;
          }

          const response = await API.post('/products/bulk', { items });
          console.log('✅ Upload response:', response.data);

          setUploadResult({
            success: true,
            data: response.data,
            errors: errors
          });
          fetchProducts();
          setUploadFile(null);

          // Close modal after 3 seconds on success
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadResult(null);
          }, 3000);

        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          setUploadResult({
            success: false,
            message: parseError.message || 'Failed to parse file'
          });
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadResult({ success: false, message: 'Failed to read file' });
        setUploading(false);
      };

      reader.readAsArrayBuffer(uploadFile);
    } catch (err) {
      console.error('❌ Upload error:', err);
      setUploadResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Upload failed'
      });
      setUploading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesIntensity = filterIntensity === 'all' || p.intensity === filterIntensity;
    return matchesSearch && matchesType && matchesIntensity;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <p className="text-gray-500 text-sm">Manage your product catalog</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              console.log('📤 Opening upload modal');
              setShowUploadModal(true);
              setUploadResult(null);
              setUploadFile(null);
            }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition shadow-md shadow-green-500/30"
          >
            <Upload size={18} /> Bulk Upload
          </button>
          <Link
            to="/products/new"
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition shadow-md shadow-amber-500/30"
          >
            <Plus size={18} /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="all">All Types</option>
            <option value="spray">Spray</option>
            <option value="roll-on">Roll‑on</option>
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Intensity</label>
          <select
            value={filterIntensity}
            onChange={(e) => setFilterIntensity(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="all">All</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </div>

        <button
          onClick={() => { setSearch(''); setFilterType('all'); setFilterIntensity('all'); }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading products...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intensity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best For</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bestseller</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-400">No products found</td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600">{p.sku}</td>
                    <td className="px-6 py-4 capitalize">{p.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{p.description || '-'}</td>
                    <td className="px-6 py-4 capitalize">{p.intensity || 'medium'}</td>
                    <td className="px-6 py-4 text-sm">{p.bestFor?.join(', ') || 'all'}</td>
                    <td className="px-6 py-4 text-sm">{p.notes?.join(', ') || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      {p.isBestseller ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">★</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => navigate(`/products/edit/${p._id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setProductToDelete(p);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Deactivate"
                        >
                          <Trash2 size={18} />
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Deactivate Product</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to deactivate <strong>{productToDelete.name}</strong>?
              <br />
              <span className="text-sm text-gray-500">This will hide it from the storefront.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Deactivate
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Bulk Upload Modal (FIXED) ---------- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadResult(null);
                setUploadFile(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-2">Bulk Upload Products</h2>
            <p className="text-gray-500 text-sm mb-4">
              Upload CSV/Excel with product data.
              <br />
              <span className="text-amber-600 font-medium">Required columns:</span>
              <br />
              <strong>Product Name</strong>, <strong>SKU</strong>, <strong>Size</strong> (e.g., "3.5ml Roll-on"), <strong>Price</strong> (selling price)
              <br />
              <span className="text-gray-400 font-medium">Optional columns:</span>
              <br />
              <strong>Description</strong>, <strong>Intensity</strong> (light/medium/strong/fresh), <strong>Best For</strong> (comma‑separated), <strong>Notes</strong> (comma‑separated), <strong>Bestseller</strong> (TRUE/FALSE)
              <br />
              <span className="text-xs text-gray-400 mt-1 block">
                * If Bestseller is missing, it defaults to FALSE. Intensity defaults to "medium".
                <br />
                * Size format: "3.5ml Roll-on" or "6ml Spray" (case insensitive).
              </span>
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full border rounded-lg p-2 cursor-pointer"
                  required
                />
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-1">
                    ✅ File selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
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
                        <p className="font-medium">{uploadResult.data?.message || 'Upload successful!'}</p>
                        <p className="text-sm">Created: {uploadResult.data?.created?.length || 0}</p>
                        {uploadResult.data?.errors?.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-sm">
                              View errors ({uploadResult.data.errors.length})
                            </summary>
                            <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto">
                              {uploadResult.data.errors.map((e, i) => {
                                let errorMessage = '';
                                if (typeof e === 'string') errorMessage = e;
                                else if (e && typeof e === 'object') {
                                  errorMessage = e.error || e.message || JSON.stringify(e);
                                } else {
                                  errorMessage = String(e);
                                }
                                return <li key={i} className="text-red-600">• {errorMessage}</li>;
                              })}
                            </ul>
                          </details>
                        )}
                        {uploadResult.errors?.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-sm">
                              View warnings ({uploadResult.errors.length})
                            </summary>
                            <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto">
                              {uploadResult.errors.map((e, i) => (
                                <li key={i} className="text-amber-600">⚠️ {e}</li>
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
                  disabled={uploading || !uploadFile}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setUploadFile(null);
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
    </div>
  );
};

export default ProductList;