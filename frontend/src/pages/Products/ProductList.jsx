import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

import API from '../../api/axios';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const BLEND_TOLERANCE = 0.15;

const fieldClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100';

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSize = (value) => {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^([\d.]+)\s*ml\s*(.*)$/i);

  if (!match) return null;

  const sizeMl = Number(match[1]);
  if (!Number.isFinite(sizeMl) || sizeMl <= 0) return null;

  const rawType = normalizeText(match[2]);

  let type = 'spray';

  if (
    rawType.includes('roll') ||
    rawType.includes('role')
  ) {
    type = 'roll-on';
  } else if (rawType.includes('spray')) {
    type = 'spray';
  }

  return {
    sizeMl,
    type,
  };
};

const readSheetRows = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error(
          'Could not read the selected file.'
        )
      );
    };

    reader.onload = (event) => {
      try {
        const data =
          new Uint8Array(
            event.target.result
          );

        const workbook =
          XLSX.read(data, {
            type: 'array',
          });

        const firstSheet =
          workbook.SheetNames[0];

        if (!firstSheet) {
          reject(
            new Error(
              'The spreadsheet does not contain a worksheet.'
            )
          );
          return;
        }

        const rows =
          XLSX.utils.sheet_to_json(
            workbook.Sheets[
              firstSheet
            ],
            {
              defval: '',
            }
          );

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });

const getSizeBlendComponents = (
  size
) =>
  Array.isArray(
    size?.blendComponents
  )
    ? size.blendComponents
    : [];

const getBlendHealth = (
  product
) => {
  if (
    product?.type ===
    'roll-on'
  ) {
    return product.baseOil
      ? {
          status: 'ok',
          label: 'Ready',
          details:
            'Base oil configured',
        }
      : {
          status: 'missing',
          label: 'No oil',
          details:
            'No base oil configured',
        };
  }

  if (
    product?.type !==
    'spray'
  ) {
    return {
      status: 'ok',
      label: 'Ready',
      details:
        'No blend validation required',
    };
  }

  const sizes =
    Array.isArray(
      product.sizes
    )
      ? product.sizes
      : [];

  if (!sizes.length) {
    return {
      status: 'missing',
      label: 'No sizes',
      details:
        'No size variants are configured',
    };
  }

  const invalidSizes = [];

  sizes.forEach((size) => {
    const components =
      getSizeBlendComponents(
        size
      );

    const total =
      components.reduce(
        (sum, component) =>
          sum +
          parseNumber(
            component.percentage
          ),
        0
      );

    const hasInvalidComponent =
      components.some(
        (component) =>
          !(
            component.material ||
            component.name
          ) ||
          parseNumber(
            component.percentage
          ) <= 0
      );

    const isInvalid =
      !components.length ||
      hasInvalidComponent ||
      Math.abs(
        total - 100
      ) >
        BLEND_TOLERANCE;

    if (isInvalid) {
      invalidSizes.push({
        sizeMl:
          size.sizeMl,
        total,
      });
    }
  });

  if (
    invalidSizes.length ===
    sizes.length
  ) {
    return {
      status: 'missing',
      label: 'No blend',
      details:
        'No sale-ready size blend is configured',
      invalidSizes,
    };
  }

  if (invalidSizes.length) {
    return {
      status: 'partial',
      label: 'Partial',
      details:
        `${invalidSizes.length} size(s) need blend attention`,
      invalidSizes,
    };
  }

  return {
    status: 'ok',
    label: 'Ready',
    details:
      'All size blends are configured',
  };
};

const getLowestPrice = (
  product
) => {
  const prices =
    (product?.sizes || [])
      .map((size) =>
        parseNumber(
          size.sellingPrice,
          NaN
        )
      )
      .filter(
        (price) =>
          Number.isFinite(
            price
          ) &&
          price >= 0
      );

  if (!prices.length) {
    return null;
  }

  return Math.min(
    ...prices
  );
};

const formatMoney = (
  value
) =>
  new Intl.NumberFormat(
    'en-BD',
    {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    parseNumber(value)
  );

const Modal = ({
  children,
  onClose,
  maxWidth = 'max-w-md',
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
    <div
      className={`relative my-auto w-full ${maxWidth} rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6`}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}

      {children}
    </div>
  </div>
);

const StatusPill = ({
  type,
  children,
}) => {
  const styles = {
    green:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    red:
      'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    gray:
      'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300',
    blue:
      'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[type] ||
        styles.gray
      }`}
    >
      {children}
    </span>
  );
};

const ProductList = () => {
  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    materials,
    setMaterials,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    filterType,
    setFilterType,
  ] = useState('all');

  const [
    filterIntensity,
    setFilterIntensity,
  ] = useState('all');

  const [
    filterStock,
    setFilterStock,
  ] = useState('all');

  const [
    filterVisibility,
    setFilterVisibility,
  ] = useState('all');

  const [
    filterBlend,
    setFilterBlend,
  ] = useState('all');

  const [
    pendingIds,
    setPendingIds,
  ] = useState(
    () => new Set()
  );

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [
    productToDelete,
    setProductToDelete,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    showEditModal,
    setShowEditModal,
  ] = useState(false);

  const [
    productToEdit,
    setProductToEdit,
  ] = useState(null);

  const [
    editLoading,
    setEditLoading,
  ] = useState(false);

  const [
    fetchingProduct,
    setFetchingProduct,
  ] = useState(false);

  const [
    editForm,
    setEditForm,
  ] = useState({
    name: '',
    sku: '',
    description: '',
    intensity: 'medium',
    bestFor: '',
    notes: '',
    isBestseller: false,
    showOnClient: false,
    isStockOut: false,
    sizes: [],
    baseOil: '',
    legacyBlendComponents: [],
  });

  const [
    showUploadModal,
    setShowUploadModal,
  ] = useState(false);

  const [
    uploadFile,
    setUploadFile,
  ] = useState(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadResult,
    setUploadResult,
  ] = useState(null);

  const setPending = (
    id,
    pending
  ) => {
    setPendingIds(
      (previous) => {
        const next =
          new Set(
            previous
          );

        if (pending) {
          next.add(id);
        } else {
          next.delete(id);
        }

        return next;
      }
    );
  };

  const fetchData = async ({
    silent = false,
  } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        productsRes,
        materialsRes,
      ] =
        await Promise.all([
          API.get(
            '/products'
          ),
          API.get(
            '/inventory/materials'
          ),
        ]);

      setProducts(
        Array.isArray(
          productsRes.data
        )
          ? productsRes.data
          : []
      );

      setMaterials(
        Array.isArray(
          materialsRes.data
        )
          ? materialsRes.data
          : []
      );
    } catch (error) {
      console.error(
        'Failed to load products',
        error
      );

      toast.error(
        error.response?.data
          ?.message ||
          'Failed to load products'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary =
    useMemo(() => {
      return products.reduce(
        (
          result,
          product
        ) => {
          result.total += 1;

          if (
            product.type ===
            'spray'
          ) {
            result.spray += 1;
          }

          if (
            product.type ===
            'roll-on'
          ) {
            result.rollOn += 1;
          }

          if (
            product.showOnClient
          ) {
            result.visible += 1;
          }

          if (
            product.isStockOut
          ) {
            result.stockOut += 1;
          }

          const health =
            getBlendHealth(
              product
            );

          if (
            health.status !==
            'ok'
          ) {
            result.blendIssues +=
              1;
          }

          return result;
        },
        {
          total: 0,
          spray: 0,
          rollOn: 0,
          visible: 0,
          stockOut: 0,
          blendIssues: 0,
        }
      );
    }, [products]);

  const filteredProducts =
    useMemo(() => {
      const query =
        normalizeText(
          search
        );

      return products.filter(
        (product) => {
          const health =
            getBlendHealth(
              product
            );

          const searchText = [
            product.name,
            product.sku,
            product.description,
            product.type,
            ...(product.bestFor ||
              []),
            ...(product.notes ||
              []),
          ]
            .map(
              normalizeText
            )
            .join(' ');

          const matchesSearch =
            !query ||
            searchText.includes(
              query
            );

          const matchesType =
            filterType ===
              'all' ||
            product.type ===
              filterType;

          const matchesIntensity =
            filterIntensity ===
              'all' ||
            product.intensity ===
              filterIntensity;

          const matchesStock =
            filterStock ===
              'all' ||
            (filterStock ===
              'in' &&
              !product.isStockOut) ||
            (filterStock ===
              'out' &&
              product.isStockOut);

          const matchesVisibility =
            filterVisibility ===
              'all' ||
            (filterVisibility ===
              'visible' &&
              product.showOnClient) ||
            (filterVisibility ===
              'hidden' &&
              !product.showOnClient);

          const matchesBlend =
            filterBlend ===
              'all' ||
            (filterBlend ===
              'ready' &&
              health.status ===
                'ok') ||
            (filterBlend ===
              'issue' &&
              health.status !==
                'ok');

          return (
            matchesSearch &&
            matchesType &&
            matchesIntensity &&
            matchesStock &&
            matchesVisibility &&
            matchesBlend
          );
        }
      );
    }, [
      products,
      search,
      filterType,
      filterIntensity,
      filterStock,
      filterVisibility,
      filterBlend,
    ]);

  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterIntensity(
      'all'
    );
    setFilterStock('all');
    setFilterVisibility(
      'all'
    );
    setFilterBlend('all');
  };

  const toggleShowOnClient =
    async (product) => {
      if (
        pendingIds.has(
          product._id
        )
      ) {
        return;
      }

      const newValue =
        !product.showOnClient;

      setPending(
        product._id,
        true
      );

      setProducts(
        (previous) =>
          previous.map(
            (item) =>
              item._id ===
              product._id
                ? {
                    ...item,
                    showOnClient:
                      newValue,
                  }
                : item
          )
      );

      try {
        await API.patch(
          `/products/${product._id}`,
          {
            showOnClient:
              newValue,
          }
        );

        toast.success(
          newValue
            ? 'Visible on client'
            : 'Hidden from client'
        );
      } catch (error) {
        setProducts(
          (previous) =>
            previous.map(
              (item) =>
                item._id ===
                product._id
                  ? {
                      ...item,
                      showOnClient:
                        !newValue,
                    }
                  : item
            )
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Failed to update visibility'
        );
      } finally {
        setPending(
          product._id,
          false
        );
      }
    };

  const toggleStockOut =
    async (product) => {
      if (
        pendingIds.has(
          product._id
        )
      ) {
        return;
      }

      const newValue =
        !product.isStockOut;

      setPending(
        product._id,
        true
      );

      setProducts(
        (previous) =>
          previous.map(
            (item) =>
              item._id ===
              product._id
                ? {
                    ...item,
                    isStockOut:
                      newValue,
                  }
                : item
          )
      );

      try {
        await API.patch(
          `/products/${product._id}`,
          {
            isStockOut:
              newValue,
          }
        );

        toast.success(
          newValue
            ? 'Marked as stock out'
            : 'Marked as in stock'
        );
      } catch (error) {
        setProducts(
          (previous) =>
            previous.map(
              (item) =>
                item._id ===
                product._id
                  ? {
                      ...item,
                      isStockOut:
                        !newValue,
                    }
                  : item
            )
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Failed to update stock status'
        );
      } finally {
        setPending(
          product._id,
          false
        );
      }
    };

  const openEditModal =
    async (product) => {
      if (
        fetchingProduct
      ) {
        return;
      }

      setFetchingProduct(
        true
      );

      try {
        const { data } =
          await API.get(
            `/products/${product._id}`
          );

        const sizes =
          (data.sizes || []).map(
            (size) => ({
              _id: size._id,
              sizeMl:
                parseNumber(
                  size.sizeMl
                ),
              sellingPrice:
                parseNumber(
                  size.sellingPrice
                ),
              image:
                size.image || '',
              bottleId:
                size.bottle?._id ||
                size.bottle ||
                '',
              /*
                Preserve per-size blends when saving.
                The previous version omitted them from
                the PUT payload, which could remove
                blend data if the backend replaces sizes.
              */
              blendComponents:
                (
                  size.blendComponents ||
                  []
                ).map(
                  (
                    component
                  ) => ({
                    material:
                      component
                        .material
                        ?._id ||
                      component
                        .material ||
                      '',
                    name:
                      component.name ||
                      '',
                    percentage:
                      parseNumber(
                        component.percentage
                      ),
                  })
                ),
              oilMlUsed:
                parseNumber(
                  size.oilMlUsed
                ),
              ethanolMlUsed:
                parseNumber(
                  size.ethanolMlUsed
                ),
              fixativeMlUsed:
                parseNumber(
                  size.fixativeMlUsed
                ),
              makingCost:
                parseNumber(
                  size.makingCost
                ),
            })
          );

        setProductToEdit(
          data
        );

        setEditForm({
          name:
            data.name || '',
          sku:
            data.sku || '',
          description:
            data.description ||
            '',
          intensity:
            data.intensity ||
            'medium',
          bestFor:
            (
              data.bestFor ||
              []
            ).join(', '),
          notes:
            (
              data.notes ||
              []
            ).join(', '),
          isBestseller:
            Boolean(
              data.isBestseller
            ),
          showOnClient:
            Boolean(
              data.showOnClient
            ),
          isStockOut:
            Boolean(
              data.isStockOut
            ),
          sizes,
          baseOil:
            data.baseOil?._id ||
            data.baseOil ||
            '',
          legacyBlendComponents:
            (
              data.blendComponents ||
              []
            ).map(
              (component) => ({
                material:
                  component
                    .material
                    ?._id ||
                  component
                    .material ||
                  '',
                percentage:
                  parseNumber(
                    component.percentage
                  ),
              })
            ),
        });

        setShowEditModal(
          true
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Failed to load product details'
        );
      } finally {
        setFetchingProduct(
          false
        );
      }
    };

  const handleEditChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setEditForm(
      (previous) => ({
        ...previous,
        [name]:
          type ===
          'checkbox'
            ? checked
            : value,
      })
    );
  };

  const handleSizeChange = (
    index,
    field,
    value
  ) => {
    setEditForm(
      (previous) => ({
        ...previous,
        sizes:
          previous.sizes.map(
            (size, sizeIndex) =>
              sizeIndex === index
                ? {
                    ...size,
                    [field]:
                      value,
                  }
                : size
          ),
      })
    );
  };

  const handleSizeImageUpload =
    async (
      index,
      event
    ) => {
      const file =
        event.target.files?.[0];

      if (!file) return;

      if (
        !file.type.startsWith(
          'image/'
        )
      ) {
        toast.error(
          'Please choose an image file'
        );
        event.target.value =
          '';
        return;
      }

      if (
        file.size >
        MAX_UPLOAD_BYTES
      ) {
        toast.error(
          'Image must be 5 MB or smaller'
        );
        event.target.value =
          '';
        return;
      }

      const formData =
        new FormData();

      formData.append(
        'image',
        file
      );

      try {
        const response =
          await API.post(
            '/upload',
            formData,
            {
              headers: {
                'Content-Type':
                  'multipart/form-data',
              },
            }
          );

        const imageUrl =
          response.data?.url;

        if (!imageUrl) {
          throw new Error(
            'Upload completed without an image URL'
          );
        }

        handleSizeChange(
          index,
          'image',
          imageUrl
        );

        toast.success(
          'Image uploaded'
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            'Image upload failed'
        );
      } finally {
        event.target.value =
          '';
      }
    };

  const handleEditSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !productToEdit ||
        editLoading
      ) {
        return;
      }

      const name =
        editForm.name.trim();

      const sku =
        editForm.sku.trim();

      if (!name || !sku) {
        toast.error(
          'Product name and SKU are required'
        );
        return;
      }

      if (
        editForm.sizes.some(
          (size) =>
            parseNumber(
              size.sizeMl
            ) <= 0 ||
            parseNumber(
              size.sellingPrice,
              NaN
            ) < 0
        )
      ) {
        toast.error(
          'Every size must have a valid size and selling price'
        );
        return;
      }

      const type =
        productToEdit.type;

      if (
        type ===
          'roll-on' &&
        !editForm.baseOil
      ) {
        toast.error(
          'Please select a base oil for the roll-on product'
        );
        return;
      }

      if (
        type === 'spray'
      ) {
        const invalidSizes =
          editForm.sizes.filter(
            (size) => {
              const components =
                size.blendComponents ||
                [];

              const total =
                components.reduce(
                  (
                    sum,
                    component
                  ) =>
                    sum +
                    parseNumber(
                      component.percentage
                    ),
                  0
                );

              return (
                !components.length ||
                Math.abs(
                  total - 100
                ) >
                  BLEND_TOLERANCE
              );
            }
          );

        if (
          invalidSizes.length
        ) {
          toast.error(
            `Blend setup is incomplete for ${invalidSizes
              .map(
                (size) =>
                  `${size.sizeMl}ml`
              )
              .join(', ')}`
          );
          return;
        }
      }

      setEditLoading(true);

      try {
        const payload = {
          name,
          sku,
          description:
            editForm.description.trim(),
          intensity:
            editForm.intensity,
          bestFor:
            editForm.bestFor
              .split(',')
              .map(
                (item) =>
                  item.trim()
              )
              .filter(Boolean),
          notes:
            editForm.notes
              .split(',')
              .map(
                (item) =>
                  item.trim()
              )
              .filter(Boolean),
          isBestseller:
            editForm.isBestseller,
          showOnClient:
            editForm.showOnClient,
          isStockOut:
            editForm.isStockOut,
          sizes:
            editForm.sizes.map(
              (size) => ({
                _id:
                  size._id,
                sizeMl:
                  parseNumber(
                    size.sizeMl
                  ),
                bottle:
                  size.bottleId,
                sellingPrice:
                  parseNumber(
                    size.sellingPrice
                  ),
                image:
                  size.image ||
                  '',
                blendComponents:
                  (
                    size.blendComponents ||
                    []
                  ).map(
                    (
                      component
                    ) => ({
                      material:
                        component.material ||
                        undefined,
                      name:
                        component.name ||
                        undefined,
                      percentage:
                        parseNumber(
                          component.percentage
                        ),
                    })
                  ),
                oilMlUsed:
                  parseNumber(
                    size.oilMlUsed
                  ),
                ethanolMlUsed:
                  parseNumber(
                    size.ethanolMlUsed
                  ),
                fixativeMlUsed:
                  parseNumber(
                    size.fixativeMlUsed
                  ),
                makingCost:
                  parseNumber(
                    size.makingCost
                  ),
              })
            ),
          baseOil:
            type ===
            'roll-on'
              ? editForm.baseOil
              : null,
        };

        if (
          editForm
            .legacyBlendComponents
            .length
        ) {
          payload.blendComponents =
            editForm
              .legacyBlendComponents;
        }

        await API.put(
          `/products/${productToEdit._id}`,
          payload
        );

        toast.success(
          'Product updated successfully'
        );

        setShowEditModal(
          false
        );

        setProductToEdit(
          null
        );

        await fetchData({
          silent: true,
        });
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Update failed'
        );
      } finally {
        setEditLoading(
          false
        );
      }
    };

  const handleDelete =
    async () => {
      if (
        !productToDelete ||
        deleting
      ) {
        return;
      }

      setDeleting(true);

      try {
        await API.delete(
          `/products/${productToDelete._id}`
        );

        toast.success(
          'Product deactivated'
        );

        setShowDeleteModal(
          false
        );

        setProductToDelete(
          null
        );

        await fetchData({
          silent: true,
        });
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Deactivate failed'
        );
      } finally {
        setDeleting(false);
      }
    };

  const handleFileChange = (
    event
  ) => {
    const file =
      event.target.files?.[0] ||
      null;

    setUploadResult(null);

    if (!file) {
      setUploadFile(null);
      return;
    }

    if (
      file.size >
      MAX_UPLOAD_BYTES
    ) {
      setUploadFile(null);

      setUploadResult({
        success: false,
        message:
          'File is too large. Maximum upload size is 5 MB.',
      });

      event.target.value =
        '';
      return;
    }

    setUploadFile(file);
  };

  const handleUploadSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !uploadFile ||
        uploading
      ) {
        return;
      }

      setUploading(true);
      setUploadResult(null);

      try {
        const rows =
          await readSheetRows(
            uploadFile
          );

        if (!rows.length) {
          throw new Error(
            'The spreadsheet is empty.'
          );
        }

        const firstRow =
          rows[0];

        const columns =
          Object.keys(
            firstRow
          );

        const normalizeColumn = (
          value
        ) =>
          normalizeText(value).replace(
            /[^a-z0-9]/g,
            ''
          );

        const findColumn = (
          possibleNames
        ) => {
          const normalizedNames =
            possibleNames.map(
              normalizeColumn
            );

          return (
            columns.find(
              (column) =>
                normalizedNames.includes(
                  normalizeColumn(
                    column
                  )
                )
            ) || null
          );
        };

        const nameCol =
          findColumn([
            'product name',
            'name',
            'productname',
          ]);

        const skuCol =
          findColumn([
            'sku',
            'code',
            'sku code',
          ]);

        const sizeCol =
          findColumn([
            'size',
            'size ml',
            'sizeml',
            'ml',
          ]);

        const priceCol =
          findColumn([
            'price',
            'selling price',
            'sellingprice',
            'unit price',
            'unitprice',
          ]);

        const descCol =
          findColumn([
            'description',
            'desc',
          ]);

        const intensityCol =
          findColumn([
            'intensity',
            'strength',
          ]);

        const bestForCol =
          findColumn([
            'best for',
            'bestfor',
            'occasion',
          ]);

        const notesCol =
          findColumn([
            'notes',
            'scent notes',
            'scentnotes',
          ]);

        const bestsellerCol =
          findColumn([
            'bestseller',
            'isbestseller',
          ]);

        const showOnClientCol =
          findColumn([
            'show on client',
            'showonclient',
            'visible',
          ]);

        if (
          !nameCol ||
          !skuCol ||
          !sizeCol ||
          !priceCol
        ) {
          throw new Error(
            `Missing required columns. Required: Product Name, SKU, Size, Price. Found: ${columns.join(
              ', '
            )}`
          );
        }

        const items = [];
        const warnings = [];

        rows.forEach(
          (row, index) => {
            try {
              const name =
                String(
                  row[
                    nameCol
                  ] || ''
                ).trim();

              const sku =
                String(
                  row[
                    skuCol
                  ] || ''
                ).trim();

              const price =
                Number(
                  row[
                    priceCol
                  ]
                );

              const sizeInfo =
                parseSize(
                  row[
                    sizeCol
                  ]
                );

              if (
                !name ||
                !sku ||
                !Number.isFinite(
                  price
                ) ||
                price < 0 ||
                !sizeInfo
              ) {
                warnings.push(
                  `Row ${
                    index + 2
                  }: skipped because name, SKU, size or price is invalid.`
                );
                return;
              }

              const intensity =
                normalizeText(
                  intensityCol
                    ? row[
                        intensityCol
                      ]
                    : 'medium'
                ) ||
                'medium';

              const bestForRaw =
                bestForCol
                  ? String(
                      row[
                        bestForCol
                      ] || ''
                    ).trim()
                  : '';

              const notesRaw =
                notesCol
                  ? String(
                      row[
                        notesCol
                      ] || ''
                    ).trim()
                  : '';

              const allowedIntensity =
                [
                  'light',
                  'medium',
                  'strong',
                  'fresh',
                ].includes(
                  intensity
                )
                  ? intensity
                  : 'medium';

              items.push({
                name,
                sku,
                sellingPrice:
                  price,
                sizeMl:
                  sizeInfo.sizeMl,
                bottleType:
                  sizeInfo.type,
                description:
                  descCol
                    ? String(
                        row[
                          descCol
                        ] || ''
                      ).trim()
                    : '',
                intensity:
                  allowedIntensity,
                bestFor:
                  bestForRaw
                    ? bestForRaw
                        .split(',')
                        .map(
                          (
                            item
                          ) =>
                            item.trim()
                        )
                        .filter(
                          Boolean
                        )
                    : [
                        'all',
                      ],
                notes:
                  notesRaw
                    ? notesRaw
                        .split(',')
                        .map(
                          (
                            item
                          ) =>
                            item.trim()
                        )
                        .filter(
                          Boolean
                        )
                    : [],
                isBestseller:
                  bestsellerCol
                    ? [
                        'true',
                        'yes',
                        '1',
                      ].includes(
                        normalizeText(
                          row[
                            bestsellerCol
                          ]
                        )
                      )
                    : false,
                showOnClient:
                  showOnClientCol
                    ? [
                        'true',
                        'yes',
                        '1',
                      ].includes(
                        normalizeText(
                          row[
                            showOnClientCol
                          ]
                        )
                      )
                    : false,
              });
            } catch (
              rowError
            ) {
              warnings.push(
                `Row ${
                  index + 2
                }: ${
                  rowError.message
                }`
              );
            }
          }
        );

        if (!items.length) {
          throw new Error(
            warnings.length
              ? `No valid rows found. ${warnings.join(
                  ' '
                )}`
              : 'No valid rows found.'
          );
        }

        const response =
          await API.post(
            '/products/bulk',
            {
              items,
            }
          );

        setUploadResult({
          success: true,
          data:
            response.data,
          warnings,
        });

        setUploadFile(null);

        toast.success(
          response.data
            ?.message ||
            'Products uploaded successfully'
        );

        await fetchData({
          silent: true,
        });
      } catch (error) {
        setUploadResult({
          success: false,
          message:
            error.response?.data
              ?.message ||
            error.message ||
            'Upload failed',
        });
      } finally {
        setUploading(false);
      }
    };

  const renderBlendPill = (
    product
  ) => {
    const health =
      getBlendHealth(
        product
      );

    if (
      health.status ===
      'ok'
    ) {
      return (
        <StatusPill type="green">
          Blend ready
        </StatusPill>
      );
    }

    if (
      health.status ===
      'partial'
    ) {
      return (
        <StatusPill type="amber">
          Partial blend
        </StatusPill>
      );
    }

    return (
      <StatusPill type="red">
        {product.type ===
        'roll-on'
          ? 'No oil'
          : 'No blend'}
      </StatusPill>
    );
  };

  const renderActions = (
    product
  ) => {
    const pending =
      pendingIds.has(
        product._id
      );

    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() =>
            openEditModal(
              product
            )
          }
          disabled={
            pending ||
            fetchingProduct
          }
          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-blue-950/30"
          title="Edit"
          aria-label={`Edit ${product.name}`}
        >
          <Edit size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            setProductToDelete(
              product
            );
            setShowDeleteModal(
              true
            );
          }}
          disabled={pending}
          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/30"
          title="Deactivate"
          aria-label={`Deactivate ${product.name}`}
        >
          <Trash2
            size={18}
          />
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-gray-900 dark:text-gray-100 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Products
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage catalog visibility, stock status, size pricing and blend readiness.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              fetchData({
                silent: true,
              })
            }
            disabled={
              refreshing ||
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setShowUploadModal(
                true
              );
              setUploadResult(
                null
              );
              setUploadFile(
                null
              );
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Upload size={17} />
            Bulk Upload
          </button>

          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
          >
            <Plus size={17} />
            Add Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [
            'Total',
            summary.total,
          ],
          [
            'Sprays',
            summary.spray,
          ],
          [
            'Roll-ons',
            summary.rollOn,
          ],
          [
            'Visible',
            summary.visible,
          ],
          [
            'Stock out',
            summary.stockOut,
          ],
          [
            'Blend issues',
            summary.blendIssues,
          ],
        ].map(
          ([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
              </p>

              <p className="mt-1 text-xl font-bold">
                {value}
              </p>
            </div>
          )
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(130px,auto))_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search name, SKU, notes..."
              className={`${fieldClass} pl-10`}
            />
          </label>

          <select
            value={filterType}
            onChange={(
              event
            ) =>
              setFilterType(
                event.target
                  .value
              )
            }
            className={fieldClass}
            aria-label="Filter product type"
          >
            <option value="all">
              All types
            </option>
            <option value="spray">
              Spray
            </option>
            <option value="roll-on">
              Roll-on
            </option>
          </select>

          <select
            value={
              filterIntensity
            }
            onChange={(
              event
            ) =>
              setFilterIntensity(
                event.target
                  .value
              )
            }
            className={fieldClass}
            aria-label="Filter intensity"
          >
            <option value="all">
              All intensity
            </option>
            <option value="light">
              Light
            </option>
            <option value="medium">
              Medium
            </option>
            <option value="strong">
              Strong
            </option>
            <option value="fresh">
              Fresh
            </option>
          </select>

          <select
            value={filterStock}
            onChange={(
              event
            ) =>
              setFilterStock(
                event.target
                  .value
              )
            }
            className={fieldClass}
            aria-label="Filter stock status"
          >
            <option value="all">
              All stock
            </option>
            <option value="in">
              In stock
            </option>
            <option value="out">
              Stock out
            </option>
          </select>

          <select
            value={
              filterVisibility
            }
            onChange={(
              event
            ) =>
              setFilterVisibility(
                event.target
                  .value
              )
            }
            className={fieldClass}
            aria-label="Filter client visibility"
          >
            <option value="all">
              All visibility
            </option>
            <option value="visible">
              Visible
            </option>
            <option value="hidden">
              Hidden
            </option>
          </select>

          <select
            value={filterBlend}
            onChange={(
              event
            ) =>
              setFilterBlend(
                event.target
                  .value
              )
            }
            className={fieldClass}
            aria-label="Filter blend status"
          >
            <option value="all">
              All blends
            </option>
            <option value="ready">
              Blend ready
            </option>
            <option value="issue">
              Blend issue
            </option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Clear
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Showing{' '}
          <strong>
            {filteredProducts.length}
          </strong>{' '}
          of{' '}
          <strong>
            {products.length}
          </strong>{' '}
          products
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <Loader2
              size={32}
              className="animate-spin text-brand-primary"
            />

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading products...
            </p>
          </div>
        </div>
      ) : filteredProducts.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Package
            size={36}
            className="mx-auto text-gray-300 dark:text-slate-600"
          />

          <p className="mt-3 font-medium">
            No products found
          </p>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try changing the filters or search text.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredProducts.map(
              (product) => {
                const health =
                  getBlendHealth(
                    product
                  );

                const price =
                  getLowestPrice(
                    product
                  );

                const pending =
                  pendingIds.has(
                    product._id
                  );

                return (
                  <article
                    key={
                      product._id
                    }
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">
                          {
                            product.name
                          }
                        </h2>

                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {
                            product.sku
                          }{' '}
                          ·{' '}
                          {
                            product.type
                          }
                        </p>
                      </div>

                      {product.isStockOut ? (
                        <StatusPill type="red">
                          Stock out
                        </StatusPill>
                      ) : (
                        <StatusPill type="green">
                          In stock
                        </StatusPill>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {renderBlendPill(
                        product
                      )}

                      {product.isBestseller && (
                        <StatusPill type="amber">
                          ★ Bestseller
                        </StatusPill>
                      )}

                      {product.showOnClient ? (
                        <StatusPill type="blue">
                          Visible
                        </StatusPill>
                      ) : (
                        <StatusPill type="gray">
                          Hidden
                        </StatusPill>
                      )}
                    </div>

                    {health.status !==
                      'ok' && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        {
                          health.details
                        }
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Sizes
                        </p>
                        <p className="font-semibold">
                          {
                            (
                              product.sizes ||
                              []
                            )
                              .map(
                                (
                                  size
                                ) =>
                                  `${size.sizeMl}ml`
                              )
                              .join(
                                ', '
                              ) ||
                            '-'
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          From
                        </p>
                        <p className="font-semibold">
                          {price ===
                          null
                            ? '-'
                            : formatMoney(
                                price
                              )}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Intensity
                        </p>
                        <p className="capitalize">
                          {product.intensity ||
                            'medium'}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Client
                        </p>

                        <button
                          type="button"
                          disabled={
                            pending
                          }
                          onClick={() =>
                            toggleShowOnClient(
                              product
                            )
                          }
                          className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 disabled:opacity-40"
                        >
                          {product.showOnClient ? (
                            <Eye
                              size={
                                15
                              }
                            />
                          ) : (
                            <EyeOff
                              size={
                                15
                              }
                            />
                          )}

                          {product.showOnClient
                            ? 'Visible'
                            : 'Hidden'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={
                          pending
                        }
                        onClick={() =>
                          toggleStockOut(
                            product
                          )
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          product.isStockOut
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                        } disabled:opacity-40`}
                      >
                        {product.isStockOut
                          ? 'Mark in stock'
                          : 'Mark stock out'}
                      </button>

                      {renderActions(
                        product
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Product
                  </th>

                  <th className="px-4 py-3 text-left">
                    Type
                  </th>

                  <th className="px-4 py-3 text-left">
                    Sizes
                  </th>

                  <th className="px-4 py-3 text-right">
                    From
                  </th>

                  <th className="px-4 py-3 text-left">
                    Intensity
                  </th>

                  <th className="px-4 py-3 text-center">
                    Blend
                  </th>

                  <th className="px-4 py-3 text-center">
                    Client
                  </th>

                  <th className="px-4 py-3 text-center">
                    Stock
                  </th>

                  <th className="px-4 py-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredProducts.map(
                  (product) => {
                    const price =
                      getLowestPrice(
                        product
                      );

                    const pending =
                      pendingIds.has(
                        product._id
                      );

                    return (
                      <tr
                        key={
                          product._id
                        }
                        className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {
                                  product.name
                                }
                              </p>

                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {
                                  product.sku
                                }
                              </p>
                            </div>

                            {product.isBestseller && (
                              <span
                                className="text-amber-500"
                                title="Bestseller"
                              >
                                ★
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 capitalize">
                          {
                            product.type
                          }
                        </td>

                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {
                            (
                              product.sizes ||
                              []
                            )
                              .map(
                                (
                                  size
                                ) =>
                                  `${size.sizeMl}ml`
                              )
                              .join(
                                ', '
                              ) ||
                            '-'
                          }
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {price ===
                          null
                            ? '-'
                            : formatMoney(
                                price
                              )}
                        </td>

                        <td className="px-4 py-3 capitalize">
                          {product.intensity ||
                            'medium'}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {renderBlendPill(
                            product
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={
                              pending
                            }
                            onClick={() =>
                              toggleShowOnClient(
                                product
                              )
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-40 ${
                              product.showOnClient
                                ? 'bg-emerald-500'
                                : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                            aria-label={`${
                              product.showOnClient
                                ? 'Hide'
                                : 'Show'
                            } ${
                              product.name
                            } on client`}
                            title={
                              product.showOnClient
                                ? 'Visible on client'
                                : 'Hidden from client'
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                product.showOnClient
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={
                              pending
                            }
                            onClick={() =>
                              toggleStockOut(
                                product
                              )
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-40 ${
                              product.isStockOut
                                ? 'bg-red-500'
                                : 'bg-emerald-500'
                            }`}
                            aria-label={`Mark ${
                              product.name
                            } ${
                              product.isStockOut
                                ? 'in stock'
                                : 'stock out'
                            }`}
                            title={
                              product.isStockOut
                                ? 'Stock out'
                                : 'In stock'
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                product.isStockOut
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              }`}
                            />
                          </button>

                          <p
                            className={`mt-1 text-[10px] font-semibold ${
                              product.isStockOut
                                ? 'text-red-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {product.isStockOut
                              ? 'OUT'
                              : 'IN'}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {renderActions(
                            product
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showDeleteModal &&
        productToDelete && (
          <Modal
            onClose={() => {
              if (deleting)
                return;

              setShowDeleteModal(
                false
              );
              setProductToDelete(
                null
              );
            }}
          >
            <h2 className="pr-10 text-xl font-bold">
              Deactivate Product
            </h2>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Deactivate{' '}
              <strong>
                {
                  productToDelete.name
                }
              </strong>
              ? It will be removed according to your backend deactivate/delete logic.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(
                    false
                  );
                  setProductToDelete(
                    null
                  );
                }}
                disabled={
                  deleting
                }
                className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium disabled:opacity-50 dark:border-slate-600"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleDelete
                }
                disabled={
                  deleting
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {deleting
                  ? 'Deactivating...'
                  : 'Deactivate'}
              </button>
            </div>
          </Modal>
        )}

      {showEditModal &&
        productToEdit && (
          <Modal
            maxWidth="max-w-5xl"
            onClose={() => {
              if (
                editLoading
              ) {
                return;
              }

              setShowEditModal(
                false
              );
              setProductToEdit(
                null
              );
            }}
          >
            <h2 className="pr-10 text-xl font-bold sm:text-2xl">
              Edit Product
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update product details, prices and images without dropping the existing per-size blend configuration.
            </p>

            <form
              onSubmit={
                handleEditSubmit
              }
              className="mt-6 space-y-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Product Name *
                  <input
                    name="name"
                    value={
                      editForm.name
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    className={`${fieldClass} mt-1`}
                    required
                  />
                </label>

                <label className="block text-sm font-medium">
                  SKU *
                  <input
                    name="sku"
                    value={
                      editForm.sku
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    className={`${fieldClass} mt-1`}
                    required
                  />
                </label>

                <label className="block text-sm font-medium">
                  Intensity
                  <select
                    name="intensity"
                    value={
                      editForm.intensity
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    className={`${fieldClass} mt-1`}
                  >
                    <option value="light">
                      Light
                    </option>
                    <option value="medium">
                      Medium
                    </option>
                    <option value="strong">
                      Strong
                    </option>
                    <option value="fresh">
                      Fresh
                    </option>
                  </select>
                </label>

                <div className="flex flex-wrap items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="isBestseller"
                      checked={
                        editForm.isBestseller
                      }
                      onChange={
                        handleEditChange
                      }
                      disabled={
                        editLoading
                      }
                    />
                    Bestseller
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="showOnClient"
                      checked={
                        editForm.showOnClient
                      }
                      onChange={
                        handleEditChange
                      }
                      disabled={
                        editLoading
                      }
                    />
                    Show on client
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="isStockOut"
                      checked={
                        editForm.isStockOut
                      }
                      onChange={
                        handleEditChange
                      }
                      disabled={
                        editLoading
                      }
                    />
                    Stock out
                  </label>
                </div>

                <label className="block text-sm font-medium sm:col-span-2">
                  Description
                  <textarea
                    name="description"
                    value={
                      editForm.description
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    rows={3}
                    className={`${fieldClass} mt-1`}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Best For
                  <input
                    name="bestFor"
                    value={
                      editForm.bestFor
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    placeholder="daytime, evening, unisex"
                    className={`${fieldClass} mt-1`}
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    Comma separated
                  </span>
                </label>

                <label className="block text-sm font-medium">
                  Scent Notes
                  <input
                    name="notes"
                    value={
                      editForm.notes
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      editLoading
                    }
                    placeholder="floral, woody, citrus"
                    className={`${fieldClass} mt-1`}
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    Comma separated
                  </span>
                </label>
              </div>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
                <h3 className="font-semibold">
                  Raw Material Assignment
                </h3>

                {productToEdit.type ===
                'roll-on' ? (
                  <label className="mt-4 block text-sm font-medium">
                    Base Oil *
                    <select
                      name="baseOil"
                      value={
                        editForm.baseOil
                      }
                      onChange={
                        handleEditChange
                      }
                      disabled={
                        editLoading
                      }
                      className={`${fieldClass} mt-1`}
                    >
                      <option value="">
                        Select base oil
                      </option>

                      {materials
                        .filter(
                          (
                            material
                          ) =>
                            material.type ===
                            'oil'
                        )
                        .map(
                          (
                            material
                          ) => (
                            <option
                              key={
                                material._id
                              }
                              value={
                                material._id
                              }
                            >
                              {
                                material.name
                              }{' '}
                              (
                              {
                                material.sku
                              }
                              ) ·{' '}
                              {parseNumber(
                                material.currentStockMl
                              ).toFixed(
                                2
                              )}
                              ml
                            </option>
                          )
                        )}
                    </select>
                  </label>
                ) : (
                  <div className="mt-4 space-y-3">
                    {editForm.sizes.map(
                      (
                        size,
                        index
                      ) => {
                        const components =
                          size.blendComponents ||
                          [];

                        const total =
                          components.reduce(
                            (
                              sum,
                              component
                            ) =>
                              sum +
                              parseNumber(
                                component.percentage
                              ),
                            0
                          );

                        const ready =
                          components.length >
                            0 &&
                          Math.abs(
                            total -
                              100
                          ) <=
                            BLEND_TOLERANCE;

                        return (
                          <div
                            key={
                              size._id ||
                              `${size.sizeMl}-${index}`
                            }
                            className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">
                                {
                                  size.sizeMl
                                }
                                ml
                              </p>

                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {
                                  components.length
                                }{' '}
                                component(s) ·{' '}
                                {total.toFixed(
                                  2
                                )}
                                %
                              </p>
                            </div>

                            {ready ? (
                              <StatusPill type="green">
                                Ready
                              </StatusPill>
                            ) : (
                              <StatusPill type="red">
                                Needs blend
                              </StatusPill>
                            )}
                          </div>
                        );
                      }
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Per-size blends are preserved when the product is updated. Manage blend composition using your existing stock/rebuild workflow.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    Size Variants
                  </h3>

                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {
                      editForm.sizes
                        .length
                    }{' '}
                    size(s)
                  </span>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {editForm.sizes.map(
                    (
                      size,
                      index
                    ) => (
                      <div
                        key={
                          size._id ||
                          index
                        }
                        className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <strong>
                            {
                              size.sizeMl
                            }
                            ml
                          </strong>

                          <span className="text-xs text-gray-500">
                            {formatMoney(
                              size.sellingPrice
                            )}
                          </span>
                        </div>

                        <label className="mt-3 block text-xs font-medium">
                          Selling Price
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              size.sellingPrice
                            }
                            onChange={(
                              event
                            ) =>
                              handleSizeChange(
                                index,
                                'sellingPrice',
                                event
                                  .target
                                  .value
                              )
                            }
                            className={`${fieldClass} mt-1`}
                          />
                        </label>

                        <label className="mt-3 block text-xs font-medium">
                          Image URL
                          <input
                            value={
                              size.image ||
                              ''
                            }
                            onChange={(
                              event
                            ) =>
                              handleSizeChange(
                                index,
                                'image',
                                event
                                  .target
                                  .value
                              )
                            }
                            className={`${fieldClass} mt-1`}
                          />
                        </label>

                        <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white">
                          Upload Image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(
                              event
                            ) =>
                              handleSizeImageUpload(
                                index,
                                event
                              )
                            }
                          />
                        </label>

                        {size.image && (
                          <img
                            src={
                              size.image
                            }
                            alt={`${productToEdit.name} ${size.sizeMl}ml`}
                            className="mt-3 h-16 w-16 rounded-lg border border-gray-200 object-cover dark:border-slate-700"
                          />
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          Size
                        </th>

                        <th className="px-3 py-2 text-left">
                          Selling Price
                        </th>

                        <th className="px-3 py-2 text-left">
                          Image
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {editForm.sizes.map(
                        (
                          size,
                          index
                        ) => (
                          <tr
                            key={
                              size._id ||
                              index
                            }
                          >
                            <td className="px-3 py-3 font-medium">
                              {
                                size.sizeMl
                              }
                              ml
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  size.sellingPrice
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleSizeChange(
                                    index,
                                    'sellingPrice',
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-32 rounded-lg border border-gray-300 bg-white px-2 py-2 text-[16px] dark:border-slate-600 dark:bg-slate-800"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <div className="flex min-w-[320px] items-center gap-2">
                                <input
                                  value={
                                    size.image ||
                                    ''
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleSizeChange(
                                      index,
                                      'image',
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder="Image URL"
                                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-800"
                                />

                                <label className="cursor-pointer rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white">
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(
                                      event
                                    ) =>
                                      handleSizeImageUpload(
                                        index,
                                        event
                                      )
                                    }
                                  />
                                </label>

                                {size.image && (
                                  <img
                                    src={
                                      size.image
                                    }
                                    alt={`${productToEdit.name} ${size.sizeMl}ml`}
                                    className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-slate-700"
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-slate-700 sm:flex-row">
                <button
                  type="submit"
                  disabled={
                    editLoading
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save
                        size={18}
                      />
                      Update Product
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(
                      false
                    );
                    setProductToEdit(
                      null
                    );
                  }}
                  disabled={
                    editLoading
                  }
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

      {showUploadModal && (
        <Modal
          maxWidth="max-w-2xl"
          onClose={() => {
            if (uploading) {
              return;
            }

            setShowUploadModal(
              false
            );
            setUploadFile(
              null
            );
            setUploadResult(
              null
            );
          }}
        >
          <h2 className="pr-10 text-xl font-bold sm:text-2xl">
            Bulk Upload Products
          </h2>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Required columns: Product Name, SKU, Size and Price.
            Size examples: <strong>3.5ml Roll-on</strong> or <strong>6ml Spray</strong>.
          </p>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Optional: Description, Intensity, Best For, Notes, Bestseller, Show On Client.
            Maximum file size: 5 MB.
          </p>

          <form
            onSubmit={
              handleUploadSubmit
            }
            className="mt-5 space-y-4"
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={
                handleFileChange
              }
              disabled={
                uploading
              }
              className={fieldClass}
              required
            />

            {uploadFile && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Selected:{' '}
                {
                  uploadFile.name
                }{' '}
                (
                {(
                  uploadFile.size /
                  1024
                ).toFixed(
                  1
                )}{' '}
                KB)
              </p>
            )}

            {uploadResult && (
              <div
                className={`rounded-xl p-3 text-sm ${
                  uploadResult.success
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {uploadResult.success ? (
                    <CheckCircle
                      size={18}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0"
                    />
                  )}

                  <div className="min-w-0">
                    <p className="font-medium">
                      {uploadResult.success
                        ? uploadResult.data
                            ?.message ||
                          'Upload completed successfully.'
                        : uploadResult.message}
                    </p>

                    {uploadResult.success &&
                      uploadResult.data
                        ?.created && (
                        <p className="mt-1 text-xs">
                          Created:{' '}
                          {Array.isArray(
                            uploadResult
                              .data
                              .created
                          )
                            ? uploadResult
                                .data
                                .created
                                .length
                            : uploadResult
                                .data
                                .created}
                        </p>
                      )}

                    {uploadResult
                      .warnings
                      ?.length >
                      0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">
                          View warnings (
                          {
                            uploadResult
                              .warnings
                              .length
                          }
                          )
                        </summary>

                        <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
                          {uploadResult.warnings.map(
                            (
                              warning,
                              index
                            ) => (
                              <li
                                key={`${warning}-${index}`}
                              >
                                •{' '}
                                {
                                  warning
                                }
                              </li>
                            )
                          )}
                        </ul>
                      </details>
                    )}

                    {uploadResult.success &&
                      uploadResult.data
                        ?.errors
                        ?.length >
                        0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer">
                            Server errors (
                            {
                              uploadResult
                                .data
                                .errors
                                .length
                            }
                            )
                          </summary>

                          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
                            {uploadResult.data.errors.map(
                              (
                                item,
                                index
                              ) => {
                                const message =
                                  typeof item ===
                                  'string'
                                    ? item
                                    : item?.error ||
                                      item?.message ||
                                      JSON.stringify(
                                        item
                                      );

                                return (
                                  <li
                                    key={`${message}-${index}`}
                                  >
                                    •{' '}
                                    {
                                      message
                                    }
                                  </li>
                                );
                              }
                            )}
                          </ul>
                        </details>
                      )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={
                  uploading ||
                  !uploadFile
                }
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {uploading
                  ? 'Uploading...'
                  : 'Upload Products'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(
                    false
                  );
                  setUploadFile(
                    null
                  );
                  setUploadResult(
                    null
                  );
                }}
                disabled={
                  uploading
                }
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ProductList;
