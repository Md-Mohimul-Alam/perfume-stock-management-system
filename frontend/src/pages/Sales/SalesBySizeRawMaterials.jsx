import { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Droplet,
  FlaskRound,
  Package,
  Loader2,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';

const SalesBySizeRawMaterials = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [aggregatedData, setAggregatedData] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [allSizes, setAllSizes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [materialsRes, productsRes, salesRes] = await Promise.all([
        API.get('/inventory/materials'),
        API.get('/products'),
        API.get('/sales'),
      ]);

      const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : [];

      setMaterials(materials);

      // Build product map
      const productMap = {};
      products.forEach(p => {
        productMap[p._id] = p;
      });

      // Build material name and SKU maps for matching
      const materialNameMap = {};
      const materialSkuMap = {};
      materials.forEach(m => {
        if (m.name) materialNameMap[m.name.toLowerCase()] = m._id;
        if (m.sku) materialSkuMap[m.sku.toLowerCase()] = m._id;
      });

      // Initialize aggregation structure for ALL materials (including virtual ones if present)
      const agg = {};
      materials.forEach(m => {
        agg[m._id] = {
          name: m.name,
          sku: m.sku,
          sizes: {},
          totalUnits: 0,
          totalMl: 0,
        };
      });

      const sizeSet = new Set();

      // Helper: parse blendComponents (handles array or string)
      const parseBlendComponents = (product) => {
        const comps = product.blendComponents;
        if (!comps) return [];
        if (Array.isArray(comps)) {
          return comps
            .filter(c => c.material && c.percentage)
            .map(c => ({ material: c.material, percentage: c.percentage }));
        }
        // If it's a string like "Oil A (50%); Oil B (50%)"
        const str = String(comps);
        const parts = str.split(';').map(s => s.trim());
        const parsed = [];
        for (const part of parts) {
          const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/);
          if (match) {
            const name = match[1].trim();
            const percentage = parseFloat(match[2]);
            parsed.push({ material: name, percentage });
          }
        }
        return parsed;
      };

      // Process sales
      sales.forEach(sale => {
        if (!sale.items) return;
        sale.items.forEach(item => {
          const productId = item.product?._id || item.product;
          if (!productId) return;
          const product = productMap[productId];
          if (!product) return;

          const size = item.sizeMl || 0;
          const qty = item.quantity || 0;
          if (size === 0 || qty === 0) return;

          sizeSet.add(size);

          // Determine raw material usage
          let usageList = [];

          if (product.type === 'roll-on') {
            const oilId = product.baseOil?._id || product.baseOil;
            if (oilId) {
              usageList.push({ materialId: oilId, percentage: 100 });
            }
          } else if (product.type === 'spray') {
            const comps = parseBlendComponents(product);
            comps.forEach(comp => {
              let materialId = null;
              // 1. Try direct ID from object
              if (comp.material && typeof comp.material === 'object') {
                materialId = comp.material._id || comp.material;
              } else if (typeof comp.material === 'string') {
                // 2. Try as ID (could be a MongoDB ID)
                materialId = comp.material;
                // 3. Try as name (case-insensitive)
                if (!materialId || !materials.some(m => m._id === materialId)) {
                  const lowerName = comp.material.toLowerCase();
                  if (materialNameMap[lowerName]) {
                    materialId = materialNameMap[lowerName];
                  }
                }
                // 4. Try as SKU (case-insensitive)
                if (!materialId || !materials.some(m => m._id === materialId)) {
                  const lowerSku = comp.material.toLowerCase();
                  if (materialSkuMap[lowerSku]) {
                    materialId = materialSkuMap[lowerSku];
                  }
                }
              }

              if (materialId) {
                // Verify materialId actually exists in materials list
                const matExists = materials.some(m => m._id === materialId);
                if (matExists) {
                  usageList.push({ materialId, percentage: comp.percentage });
                }
              }
            });
          }

          // Apply usage
          usageList.forEach(usage => {
            const matId = usage.materialId;
            if (!agg[matId]) return; // material not in list (shouldn't happen)
            const mlPerUnit = (size * usage.percentage) / 100;
            const totalMl = mlPerUnit * qty;

            if (!agg[matId].sizes[size]) {
              agg[matId].sizes[size] = { units: 0, ml: 0 };
            }
            agg[matId].sizes[size].units += qty;
            agg[matId].sizes[size].ml += totalMl;
            agg[matId].totalUnits += qty;
            agg[matId].totalMl += totalMl;
          });
        });
      });

      setAggregatedData(agg);
      setAllSizes(Array.from(sizeSet).sort((a, b) => a - b));
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Prepare chart data for selected material
  const prepareChartData = (materialId) => {
    const mat = aggregatedData[materialId];
    if (!mat) return [];
    return allSizes.map(size => {
      const data = mat.sizes[size] || { units: 0, ml: 0 };
      return {
        size: `${size}ml`,
        ml: data.ml,
        units: data.units,
      };
    });
  };

  const selectedMaterialData = selectedMaterial ? aggregatedData[selectedMaterial] : null;
  const chartData = selectedMaterial ? prepareChartData(selectedMaterial) : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales by Size (Raw Materials)</h1>
          <p className="text-gray-500 text-sm">Raw material consumption broken down by product size</p>
        </div>
        <button
          onClick={fetchData}
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
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Raw Materials</p>
          <p className="text-2xl font-bold text-gray-800">{materials.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Units Sold (All Materials)</p>
          <p className="text-2xl font-bold text-gray-800">
            {Object.values(aggregatedData).reduce((sum, m) => sum + m.totalUnits, 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Raw Material Used (ml)</p>
          <p className="text-2xl font-bold text-gray-800">
            {Object.values(aggregatedData).reduce((sum, m) => sum + m.totalMl, 0).toFixed(0)}
          </p>
        </div>
      </div>

      {/* Material Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Raw Material</label>
        <select
          value={selectedMaterial}
          onChange={(e) => setSelectedMaterial(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
        >
          <option value="">-- All Materials (Table Below) --</option>
          {materials.map(m => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.sku})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-gray-500">Loading data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Selected Material Chart & Table */}
          {selectedMaterial && selectedMaterialData && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                {selectedMaterialData.name} ({selectedMaterialData.sku})
              </h2>

              {/* Chart */}
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ml" name="Used (ml)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Material Used (ml)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allSizes.map(size => {
                      const data = selectedMaterialData.sizes[size] || { units: 0, ml: 0 };
                      return (
                        <tr key={size} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{size}</td>
                          <td className="px-4 py-2 text-sm text-right font-semibold">{data.units}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">{data.ml.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-sm">Total</td>
                      <td className="px-4 py-2 text-sm text-right">{selectedMaterialData.totalUnits}</td>
                      <td className="px-4 py-2 text-sm text-right">{selectedMaterialData.totalMl.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Materials Accordion/Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-700">All Raw Materials Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Units</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Used (ml)</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Expand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {materials.map(material => {
                    const mat = aggregatedData[material._id];
                    if (!mat) return null;
                    return (
                      <MaterialRow
                        key={material._id}
                        material={mat}
                        allSizes={allSizes}
                        onExpand={() => setSelectedMaterial(material._id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper component: MaterialRow with expandable details
const MaterialRow = ({ material, allSizes, onExpand }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    setExpanded(!expanded);
    if (!expanded) onExpand();
  };

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={toggle}>
        <td className="px-4 py-2 text-sm font-medium">{material.name} ({material.sku})</td>
        <td className="px-4 py-2 text-sm text-right">{material.totalUnits}</td>
        <td className="px-4 py-2 text-sm text-right">{material.totalMl.toFixed(1)}</td>
        <td className="px-4 py-2 text-center">
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan="4" className="px-4 py-2">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Size (ml)</th>
                    <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 uppercase">Units</th>
                    <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 uppercase">Used (ml)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allSizes.map(size => {
                    const d = material.sizes[size] || { units: 0, ml: 0 };
                    return (
                      <tr key={size}>
                        <td className="px-3 py-1">{size}</td>
                        <td className="px-3 py-1 text-right">{d.units}</td>
                        <td className="px-3 py-1 text-right">{d.ml.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="px-3 py-1">Total</td>
                    <td className="px-3 py-1 text-right">{material.totalUnits}</td>
                    <td className="px-3 py-1 text-right">{material.totalMl.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default SalesBySizeRawMaterials;