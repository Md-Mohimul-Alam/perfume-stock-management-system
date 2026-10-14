import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as XLSX
  from 'xlsx';

import toast
  from 'react-hot-toast';

import {
  AlertCircle,
  CheckCircle,
  CircleDollarSign,
  Image,
  Package,
  PackageCheck,
  PackageMinus,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

import API
  from '../../api/axios';

const LOW_STOCK_LIMIT = 3;

const MAX_UPLOAD_BYTES =
  5 * 1024 * 1024;

/* ========================================
   HELPERS
======================================== */

const number = (value) => {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
};

const money = (value) =>
  new Intl.NumberFormat(
    'en-BD',
    {
      style:
        'currency',

      currency:
        'BDT',

      minimumFractionDigits:
        2,
    }
  ).format(
    number(value)
  );

const bottleLabel = (
  bottle
) => {
  const type =
    bottle?.type ===
    'roll-on'
      ? 'Roll-on'
      : 'Spray';

  return `${number(
    bottle?.sizeMl
  )}ml ${type}`;
};

const cleanImages = (
  images
) => {
  if (
    !Array.isArray(
      images
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      images
        .map((image) =>
          String(
            image || ''
          ).trim()
        )
        .filter(Boolean)
    ),
  ].slice(
    0,
    10
  );
};

const normalizeBottle = (
  bottle = {}
) => ({
  ...bottle,

  currentStock:
    number(
      bottle.currentStock
    ),

  avgCostPerUnit:
    number(
      bottle.avgCostPerUnit
    ),

  sellingPrice:
    number(
      bottle.sellingPrice
    ),

  images:
    Array.isArray(
      bottle.images
    )
      ? bottle.images
      : [],

  totalPurchased:
    number(
      bottle.totalPurchased
    ),

  usedForPerfume:
    number(
      bottle.usedForPerfume
    ),

  bottleSales:
    number(
      bottle.bottleSales
    ),

  bottleSalesRevenue:
    number(
      bottle.bottleSalesRevenue
    ),

  wasted:
    number(
      bottle.wasted
    ),

  produced:
    number(
      bottle.produced
    ),
});

/* ========================================
   FILE READER
======================================== */

const readSheetRows =
  (file) =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onerror =
          () =>
            reject(
              new Error(
                'Could not read the selected file.'
              )
            );

        reader.onload =
          (
            event
          ) => {
            try {
              const data =
                new Uint8Array(
                  event
                    .target
                    .result
                );

              const workbook =
                XLSX.read(
                  data,
                  {
                    type:
                      'array',
                  }
                );

              const firstSheet =
                workbook
                  .SheetNames[0];

              if (
                !firstSheet
              ) {
                reject(
                  new Error(
                    'The spreadsheet does not contain a worksheet.'
                  )
                );

                return;
              }

              resolve(
                XLSX.utils.sheet_to_json(
                  workbook
                    .Sheets[
                      firstSheet
                    ],
                  {
                    defval:
                      '',
                  }
                )
              );
            } catch (
              error
            ) {
              reject(
                error
              );
            }
          };

        reader.readAsArrayBuffer(
          file
        );
      }
    );

/* ========================================
   MODAL
======================================== */

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
          onClick={
            onClose
          }
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X
            size={
              20
            }
          />
        </button>
      )}

      {children}
    </div>
  </div>
);

const fieldClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100';

/* ========================================
   MULTIPLE IMAGE INPUT
======================================== */

const BottleImagesInput = ({
  images,
  setImages,
}) => {
  const safeImages =
    Array.isArray(
      images
    ) &&
    images.length
      ? images
      : [''];

  const changeImage = (
    index,
    value
  ) => {
    const updated =
      [
        ...safeImages,
      ];

    updated[index] =
      value;

    setImages(
      updated
    );
  };

  const removeImage = (
    index
  ) => {
    const updated =
      safeImages.filter(
        (
          _,
          rowIndex
        ) =>
          rowIndex !==
          index
      );

    setImages(
      updated.length
        ? updated
        : ['']
    );
  };

  const addImage =
    () => {
      if (
        safeImages.length >=
        10
      ) {
        toast.error(
          'Maximum 10 images per bottle'
        );

        return;
      }

      setImages([
        ...safeImages,
        '',
      ]);
    };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Bottle Images
        </label>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {cleanImages(
            safeImages
          ).length}
          /10
        </span>
      </div>

      <div className="mt-2 space-y-3">
        {safeImages.map(
          (
            image,
            index
          ) => (
            <div
              key={
                index
              }
              className="rounded-xl border border-gray-200 p-3 dark:border-slate-700"
            >
              <div className="flex gap-2">
                <input
                  type="url"
                  value={
                    image
                  }
                  onChange={(
                    event
                  ) =>
                    changeImage(
                      index,
                      event
                        .target
                        .value
                    )
                  }
                  placeholder={`Image ${index + 1} URL`}
                  className={
                    fieldClass
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    removeImage(
                      index
                    )
                  }
                  disabled={
                    safeImages.length ===
                      1 &&
                    !image
                  }
                  className="rounded-xl border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:border-red-900 dark:hover:bg-red-950/30"
                  title="Remove image"
                >
                  <Trash2
                    size={
                      17
                    }
                  />
                </button>
              </div>

              {image && (
                <div className="mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-800">
                  <img
                    src={
                      image
                    }
                    alt={`Bottle preview ${index + 1}`}
                    className="h-full w-full object-contain p-2"
                    onError={(
                      event
                    ) => {
                      event.currentTarget.style.opacity =
                        '0.25';
                    }}
                    onLoad={(
                      event
                    ) => {
                      event.currentTarget.style.opacity =
                        '1';
                    }}
                  />
                </div>
              )}
            </div>
          )
        )}
      </div>

      <button
        type="button"
        onClick={
          addImage
        }
        disabled={
          safeImages.length >=
          10
        }
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary disabled:opacity-40"
      >
        <Plus
          size={
            15
          }
        />

        Add another image
      </button>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        The first image will be the main image on the customer website.
      </p>
    </div>
  );
};

/* ========================================
   PAGE
======================================== */

const Bottles = () => {
  const [
    bottles,
    setBottles,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    typeFilter,
    setTypeFilter,
  ] = useState(
    'all'
  );

  const [
    statusFilter,
    setStatusFilter,
  ] = useState(
    'all'
  );

  /* ======================================
     ADD
  ====================================== */

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    newBottle,
    setNewBottle,
  ] = useState({
    sizeMl: '',
    type: 'spray',
    currentStock: 0,
    avgCostPerUnit: 0,
    sellingPrice: 0,
    images: [''],
  });

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    modalError,
    setModalError,
  ] = useState('');

  /* ======================================
     EDIT
  ====================================== */

  const [
    editingBottle,
    setEditingBottle,
  ] = useState(null);

  const [
    editForm,
    setEditForm,
  ] = useState({
    sizeMl: '',
    type: 'spray',
    currentStock: 0,
    avgCostPerUnit: 0,
    sellingPrice: 0,
    images: [''],
  });

  const [
    editSubmitting,
    setEditSubmitting,
  ] = useState(false);

  const [
    editError,
    setEditError,
  ] = useState('');

  /* ======================================
     DELETE
  ====================================== */

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /* ======================================
     PURCHASE
  ====================================== */

  const [
    purchaseBottle,
    setPurchaseBottle,
  ] = useState(null);

  const [
    purchaseData,
    setPurchaseData,
  ] = useState({
    quantity: '',
    costPerUnit: '',
    supplier: '',
    invoiceNo: '',
  });

  const [
    purchasing,
    setPurchasing,
  ] = useState(false);

  const [
    purchaseError,
    setPurchaseError,
  ] = useState('');

  /* ======================================
     STOCK OUT
  ====================================== */

  const [
    stockOutBottle,
    setStockOutBottle,
  ] = useState(null);

  const [
    stockingOut,
    setStockingOut,
  ] = useState(false);

  /* ======================================
     WASTE
  ====================================== */

  const [
    wasteBottleTarget,
    setWasteBottleTarget,
  ] = useState(null);

  const [
    wasteData,
    setWasteData,
  ] = useState({
    quantity: '',
    notes: '',
  });

  const [
    wasting,
    setWasting,
  ] = useState(false);

  const [
    wasteError,
    setWasteError,
  ] = useState('');

  /* ======================================
     UPLOAD
  ====================================== */

  const [
    showUploadModal,
    setShowUploadModal,
  ] = useState(false);

  const [
    file,
    setFile,
  ] = useState(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadResult,
    setUploadResult,
  ] = useState(null);

  /* ========================================
     FETCH
  ======================================== */

  const fetchBottles =
    async ({
      silent = false,
    } = {}) => {
      if (!silent) {
        setLoading(
          true
        );
      }

      try {
        const {
          data,
        } =
          await API.get(
            '/inventory/bottles/with-sales'
          );

        setBottles(
          (
            Array.isArray(
              data
            )
              ? data
              : []
          ).map(
            normalizeBottle
          )
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        toast.error(
          error.response
            ?.data
            ?.message ||
            'Failed to load bottles'
        );
      } finally {
        if (!silent) {
          setLoading(
            false
          );
        }
      }
    };

  useEffect(() => {
    fetchBottles();
  }, []);

  /* ========================================
     FILTER
  ======================================== */

  const filteredBottles =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return bottles.filter(
        (
          bottle
        ) => {
          const stock =
            number(
              bottle.currentStock
            );

          const isOut =
            bottle.isStockOut ||
            stock <= 0;

          const matchesSearch =
            !query ||
            bottleLabel(
              bottle
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            String(
              bottle.sizeMl
            ).includes(
              query
            );

          const matchesType =
            typeFilter ===
              'all' ||
            bottle.type ===
              typeFilter;

          const matchesStatus =
            statusFilter ===
              'all' ||
            (
              statusFilter ===
                'available' &&
              !isOut &&
              stock >=
                LOW_STOCK_LIMIT
            ) ||
            (
              statusFilter ===
                'low' &&
              !isOut &&
              stock > 0 &&
              stock <
                LOW_STOCK_LIMIT
            ) ||
            (
              statusFilter ===
                'out' &&
              isOut
            );

          return (
            matchesSearch &&
            matchesType &&
            matchesStatus
          );
        }
      );
    }, [
      bottles,
      search,
      typeFilter,
      statusFilter,
    ]);

  /* ========================================
     SUMMARY
  ======================================== */

  const summary =
    useMemo(
      () =>
        bottles.reduce(
          (
            result,
            bottle
          ) => {
            const stock =
              number(
                bottle.currentStock
              );

            result.used +=
              number(
                bottle.usedForPerfume
              );

            result.sold +=
              number(
                bottle.bottleSales
              );

            result.wasted +=
              number(
                bottle.wasted
              );

            result.available +=
              stock;

            result.value +=
              stock *
              number(
                bottle.avgCostPerUnit
              );

            return result;
          },
          {
            used: 0,
            sold: 0,
            wasted: 0,
            available: 0,
            value: 0,
          }
        ),
      [
        bottles,
      ]
    );

  /* ========================================
     ADD
  ======================================== */

  const handleAddSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      const sizeMl =
        Number(
          newBottle.sizeMl
        );

      const currentStock =
        Number(
          newBottle.currentStock
        );

      const avgCostPerUnit =
        Number(
          newBottle.avgCostPerUnit
        );

      const sellingPrice =
        Number(
          newBottle.sellingPrice
        );

      if (
        !Number.isFinite(
          sizeMl
        ) ||
        sizeMl <= 0
      ) {
        setModalError(
          'Bottle size must be greater than 0.'
        );

        return;
      }

      if (
        !Number.isInteger(
          currentStock
        ) ||
        currentStock < 0
      ) {
        setModalError(
          'Stock must be a non-negative whole number.'
        );

        return;
      }

      if (
        !Number.isFinite(
          avgCostPerUnit
        ) ||
        avgCostPerUnit < 0
      ) {
        setModalError(
          'Unit cost cannot be negative.'
        );

        return;
      }

      if (
        !Number.isFinite(
          sellingPrice
        ) ||
        sellingPrice < 0
      ) {
        setModalError(
          'Selling price cannot be negative.'
        );

        return;
      }

      setSubmitting(
        true
      );

      setModalError('');

      try {
        await API.post(
          '/inventory/bottles',
          {
            sizeMl,

            type:
              newBottle.type,

            currentStock,

            avgCostPerUnit,

            sellingPrice,

            images:
              cleanImages(
                newBottle.images
              ),
          }
        );

        toast.success(
          'Bottle added'
        );

        setShowAddModal(
          false
        );

        setNewBottle({
          sizeMl: '',
          type: 'spray',
          currentStock: 0,
          avgCostPerUnit: 0,
          sellingPrice: 0,
          images: [''],
        });

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        setModalError(
          error.response
            ?.data
            ?.message ||
            'Failed to create bottle'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  /* ========================================
     EDIT
  ======================================== */

  const handleEditClick =
    (
      bottle
    ) => {
      setEditingBottle(
        bottle
      );

      setEditForm({
        sizeMl:
          bottle.sizeMl,

        type:
          bottle.type,

        currentStock:
          number(
            bottle.currentStock
          ),

        avgCostPerUnit:
          number(
            bottle.avgCostPerUnit
          ),

        sellingPrice:
          number(
            bottle.sellingPrice
          ),

        images:
          bottle.images
            ?.length
            ? [
                ...bottle.images,
              ]
            : [''],
      });

      setEditError('');
    };

  const handleEditSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !editingBottle
      ) {
        return;
      }

      const sizeMl =
        Number(
          editForm.sizeMl
        );

      const currentStock =
        Number(
          editForm.currentStock
        );

      const avgCostPerUnit =
        Number(
          editForm.avgCostPerUnit
        );

      const sellingPrice =
        Number(
          editForm.sellingPrice
        );

      if (
        !Number.isFinite(
          sizeMl
        ) ||
        sizeMl <= 0
      ) {
        setEditError(
          'Bottle size must be greater than 0.'
        );

        return;
      }

      if (
        !Number.isInteger(
          currentStock
        ) ||
        currentStock < 0
      ) {
        setEditError(
          'Stock must be a non-negative whole number.'
        );

        return;
      }

      if (
        avgCostPerUnit <
          0 ||
        !Number.isFinite(
          avgCostPerUnit
        )
      ) {
        setEditError(
          'Unit cost cannot be negative.'
        );

        return;
      }

      if (
        sellingPrice <
          0 ||
        !Number.isFinite(
          sellingPrice
        )
      ) {
        setEditError(
          'Selling price cannot be negative.'
        );

        return;
      }

      setEditSubmitting(
        true
      );

      setEditError('');

      try {
        await API.put(
          `/inventory/bottles/${editingBottle._id}`,
          {
            sizeMl,

            type:
              editForm.type,

            currentStock,

            avgCostPerUnit,

            sellingPrice,

            images:
              cleanImages(
                editForm.images
              ),
          }
        );

        toast.success(
          'Bottle updated'
        );

        setEditingBottle(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        setEditError(
          error.response
            ?.data
            ?.message ||
            'Update failed'
        );
      } finally {
        setEditSubmitting(
          false
        );
      }
    };

  /* ========================================
     DELETE
  ======================================== */

  const handleDeleteConfirm =
    async () => {
      if (
        !deleteTarget ||
        deleting
      ) {
        return;
      }

      setDeleting(
        true
      );

      try {
        await API.delete(
          `/inventory/bottles/${deleteTarget._id}`
        );

        toast.success(
          'Bottle deleted'
        );

        setDeleteTarget(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data
            ?.message ||
            'Delete failed'
        );
      } finally {
        setDeleting(
          false
        );
      }
    };

  /* ========================================
     PURCHASE
  ======================================== */

  const openPurchase =
    (
      bottle
    ) => {
      setPurchaseBottle(
        bottle
      );

      setPurchaseData({
        quantity: '',
        costPerUnit: '',
        supplier: '',
        invoiceNo: '',
      });

      setPurchaseError('');
    };

  const handlePurchaseSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      const quantity =
        Number(
          purchaseData.quantity
        );

      const costPerUnit =
        Number(
          purchaseData.costPerUnit
        );

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <= 0
      ) {
        setPurchaseError(
          'Quantity must be a positive whole number.'
        );

        return;
      }

      if (
        !Number.isFinite(
          costPerUnit
        ) ||
        costPerUnit < 0
      ) {
        setPurchaseError(
          'Cost cannot be negative.'
        );

        return;
      }

      setPurchasing(
        true
      );

      setPurchaseError('');

      try {
        await API.post(
          `/inventory/bottles/${purchaseBottle._id}/purchase`,
          {
            quantity,

            costPerUnit,

            supplier:
              purchaseData.supplier
                .trim(),

            invoiceNo:
              purchaseData.invoiceNo
                .trim(),
          }
        );

        toast.success(
          'Purchase recorded'
        );

        setPurchaseBottle(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        setPurchaseError(
          error.response
            ?.data
            ?.message ||
            'Purchase failed'
        );
      } finally {
        setPurchasing(
          false
        );
      }
    };

  /* ========================================
     WASTE
  ======================================== */

  const openWaste =
    (
      bottle
    ) => {
      setWasteBottleTarget(
        bottle
      );

      setWasteData({
        quantity: '',
        notes: '',
      });

      setWasteError('');
    };

  const handleWasteSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      const quantity =
        Number(
          wasteData.quantity
        );

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <= 0
      ) {
        setWasteError(
          'Quantity must be a positive whole number.'
        );

        return;
      }

      if (
        quantity >
        number(
          wasteBottleTarget.currentStock
        )
      ) {
        setWasteError(
          'Quantity exceeds available stock.'
        );

        return;
      }

      setWasting(
        true
      );

      try {
        await API.post(
          `/inventory/bottles/${wasteBottleTarget._id}/waste`,
          {
            quantity,

            notes:
              wasteData.notes
                .trim(),
          }
        );

        toast.success(
          'Wastage recorded'
        );

        setWasteBottleTarget(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        setWasteError(
          error.response
            ?.data
            ?.message ||
            'Wastage failed'
        );
      } finally {
        setWasting(
          false
        );
      }
    };

  /* ========================================
     STOCK OUT
  ======================================== */

  const handleStockOut =
    async () => {
      if (
        !stockOutBottle ||
        stockingOut
      ) {
        return;
      }

      setStockingOut(
        true
      );

      try {
        await API.post(
          `/inventory/bottles/${stockOutBottle._id}/stock-out`
        );

        toast.success(
          'Bottle marked stock out'
        );

        setStockOutBottle(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data
            ?.message ||
            'Stock out failed'
        );
      } finally {
        setStockingOut(
          false
        );
      }
    };

  /* ========================================
     BULK UPLOAD
  ======================================== */

  const handleFileChange =
    (
      event
    ) => {
      const selected =
        event.target
          .files?.[0] ||
        null;

      setUploadResult(
        null
      );

      if (!selected) {
        setFile(
          null
        );

        return;
      }

      if (
        selected.size >
        MAX_UPLOAD_BYTES
      ) {
        setUploadResult({
          success:
            false,

          message:
            'Maximum file size is 5 MB.',
        });

        setFile(
          null
        );

        return;
      }

      setFile(
        selected
      );
    };

  const handleUploadSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !file ||
        uploading
      ) {
        return;
      }

      setUploading(
        true
      );

      setUploadResult(
        null
      );

      try {
        const rows =
          await readSheetRows(
            file
          );

        const items =
          rows
            .map(
              (
                row
              ) => {
                const sizeMl =
                  number(
                    row.sizeMl ??
                    row.Size ??
                    row['Size (ml)']
                  );

                const rawType =
                  String(
                    row.type ??
                    row.Type ??
                    'spray'
                  )
                    .trim()
                    .toLowerCase();

                const type =
                  rawType.includes(
                    'roll'
                  )
                    ? 'roll-on'
                    : 'spray';

                const images = [];

                for (
                  let index = 1;
                  index <= 10;
                  index += 1
                ) {
                  const image =
                    row[
                      `Image${index}`
                    ] ??
                    row[
                      `Image ${index}`
                    ];

                  if (image) {
                    images.push(
                      String(
                        image
                      ).trim()
                    );
                  }
                }

                return {
                  sizeMl,

                  type,

                  currentStock:
                    number(
                      row.currentStock ??
                      row.Stock ??
                      row.Quantity
                    ),

                  avgCostPerUnit:
                    number(
                      row.avgCostPerUnit ??
                      row.Cost ??
                      row['Unit Cost']
                    ),

                  sellingPrice:
                    number(
                      row.sellingPrice ??
                      row['Selling Price'] ??
                      row.Price
                    ),

                  images:
                    cleanImages(
                      images
                    ),
                };
              }
            )
            .filter(
              (
                row
              ) =>
                row.sizeMl >
                0
            );

        if (
          !items.length
        ) {
          throw new Error(
            'No valid bottle rows found.'
          );
        }

        const {
          data,
        } =
          await API.post(
            '/inventory/bottles/bulk',
            {
              items,
            }
          );

        setUploadResult({
          success:
            true,

          message:
            data.message,
        });

        toast.success(
          data.message ||
          'Upload completed'
        );

        setFile(
          null
        );

        await fetchBottles({
          silent: true,
        });
      } catch (
        error
      ) {
        setUploadResult({
          success:
            false,

          message:
            error.response
              ?.data
              ?.message ||
            error.message ||
            'Upload failed',
        });
      } finally {
        setUploading(
          false
        );
      }
    };

  /* ========================================
     ACTIONS
  ======================================== */

  const renderActions =
    (
      bottle
    ) => {
      const stock =
        number(
          bottle.currentStock
        );

      return (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() =>
              openPurchase(
                bottle
              )
            }
            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            title="Purchase"
          >
            <CircleDollarSign
              size={
                18
              }
            />
          </button>

          <button
            type="button"
            disabled={
              stock <= 0
            }
            onClick={() =>
              openWaste(
                bottle
              )
            }
            className="rounded-lg p-2 text-orange-600 hover:bg-orange-50 disabled:opacity-30 dark:hover:bg-orange-950/30"
            title="Wastage"
          >
            <PackageX
              size={
                18
              }
            />
          </button>

          <button
            type="button"
            onClick={() =>
              handleEditClick(
                bottle
              )
            }
            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            title="Edit"
          >
            <Pencil
              size={
                18
              }
            />
          </button>

          <button
            type="button"
            disabled={
              stock <= 0
            }
            onClick={() =>
              setStockOutBottle(
                bottle
              )
            }
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30"
            title="Stock out"
          >
            <XCircle
              size={
                18
              }
            />
          </button>

          <button
            type="button"
            onClick={() =>
              setDeleteTarget(
                bottle
              )
            }
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-slate-800"
            title="Delete"
          >
            <Trash2
              size={
                18
              }
            />
          </button>
        </div>
      );
    };

  /* ========================================
     UI
  ======================================== */

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Bottles
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage bottle stock, selling prices, images, usage and direct bottle sales.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              fetchBottles()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            <RefreshCw
              size={
                17
              }
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              setShowAddModal(
                true
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus
              size={
                17
              }
            />

            Add Bottle
          </button>

          <button
            type="button"
            onClick={() =>
              setShowUploadModal(
                true
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <Upload
              size={
                17
              }
            />

            Upload Sheet
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            label:
              'Used for perfume',
            value:
              `${summary.used} pcs`,
            icon:
              <PackageMinus size={16} />,
          },

          {
            label:
              'Bottle sales',
            value:
              `${summary.sold} pcs`,
            icon:
              <CircleDollarSign size={16} />,
          },

          {
            label:
              'Wasted',
            value:
              `${summary.wasted} pcs`,
            icon:
              <PackageX size={16} />,
          },

          {
            label:
              'Available stock',
            value:
              `${summary.available} pcs`,
            icon:
              <PackageCheck size={16} />,
          },

          {
            label:
              'Inventory value',
            value:
              money(
                summary.value
              ),
            icon:
              <Package size={16} />,
          },
        ].map(
          (
            card
          ) => (
            <div
              key={
                card.label
              }
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                {
                  card.icon
                }

                {
                  card.label
                }
              </div>

              <p className="mt-2 text-xl font-bold">
                {
                  card.value
                }
              </p>
            </div>
          )
        )}
      </div>

      {/* FILTER */}

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search
            size={
              18
            }
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event
                  .target
                  .value
              )
            }
            placeholder="Search bottle..."
            className={`${fieldClass} pl-10`}
          />
        </label>

        <select
          value={
            typeFilter
          }
          onChange={(
            event
          ) =>
            setTypeFilter(
              event
                .target
                .value
            )
          }
          className={
            fieldClass
          }
        >
          <option value="all">
            All types
          </option>

          <option value="spray">
            Spray
          </option>

          <option value="roll-on">
            Roll-on / Oil
          </option>
        </select>

        <select
          value={
            statusFilter
          }
          onChange={(
            event
          ) =>
            setStatusFilter(
              event
                .target
                .value
            )
          }
          className={
            fieldClass
          }
        >
          <option value="all">
            All status
          </option>

          <option value="available">
            Available
          </option>

          <option value="low">
            Low
          </option>

          <option value="out">
            Stock out
          </option>
        </select>
      </div>

      {/* DATA */}

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <RefreshCw
            size={
              30
            }
            className="animate-spin text-brand-primary"
          />
        </div>
      ) : (
        <>
          {/* MOBILE */}

          <div className="grid gap-3 md:hidden">
            {filteredBottles.map(
              (
                bottle
              ) => {
                const stock =
                  number(
                    bottle.currentStock
                  );

                return (
                  <article
                    key={
                      bottle._id
                    }
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-800">
                        {bottle.images?.[0] ? (
                          <img
                            src={
                              bottle.images[0]
                            }
                            alt={
                              bottleLabel(
                                bottle
                              )
                            }
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <Image
                            size={
                              25
                            }
                            className="text-gray-400"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">
                          {bottleLabel(
                            bottle
                          )}
                        </h3>

                        <p className="text-sm text-gray-500">
                          Selling:{' '}
                          <strong className="text-emerald-600">
                            {money(
                              bottle.sellingPrice
                            )}
                          </strong>
                        </p>

                        <p className="text-xs text-gray-500">
                          {bottle.images?.length || 0}{' '}
                          images
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">
                          Available
                        </span>

                        <p className="font-semibold">
                          {
                            stock
                          }
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-500">
                          Unit cost
                        </span>

                        <p>
                          {money(
                            bottle.avgCostPerUnit
                          )}
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-500">
                          Used
                        </span>

                        <p>
                          {number(
                            bottle.usedForPerfume
                          )}
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-500">
                          Bottle sales
                        </span>

                        <p>
                          {number(
                            bottle.bottleSales
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-2 dark:border-slate-800">
                      {renderActions(
                        bottle
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>

          {/* DESKTOP */}

          <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Bottle
                  </th>

                  <th className="px-4 py-3 text-left">
                    Type
                  </th>

                  <th className="px-4 py-3 text-right">
                    Purchased
                  </th>

                  <th className="px-4 py-3 text-right">
                    Used
                  </th>

                  <th className="px-4 py-3 text-right">
                    Bottle sales
                  </th>

                  <th className="px-4 py-3 text-right">
                    Wasted
                  </th>

                  <th className="px-4 py-3 text-right">
                    Available
                  </th>

                  <th className="px-4 py-3 text-right">
                    Unit cost
                  </th>

                  <th className="px-4 py-3 text-right">
                    Selling price
                  </th>

                  <th className="px-4 py-3 text-center">
                    Status
                  </th>

                  <th className="px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredBottles.map(
                  (
                    bottle
                  ) => {
                    const stock =
                      number(
                        bottle.currentStock
                      );

                    const isOut =
                      bottle.isStockOut ||
                      stock <= 0;

                    return (
                      <tr
                        key={
                          bottle._id
                        }
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
                              {bottle.images?.[0] ? (
                                <img
                                  src={
                                    bottle.images[0]
                                  }
                                  alt={
                                    bottleLabel(
                                      bottle
                                    )
                                  }
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <Image
                                  size={
                                    20
                                  }
                                  className="text-gray-400"
                                />
                              )}
                            </div>

                            <div>
                              <p className="font-semibold">
                                {number(
                                  bottle.sizeMl
                                )}
                                ml
                              </p>

                              <p className="text-xs text-gray-500">
                                {bottle.images?.length || 0}{' '}
                                image
                                {(bottle.images?.length || 0) === 1
                                  ? ''
                                  : 's'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {bottle.type ===
                          'roll-on'
                            ? 'Roll-on / Oil'
                            : 'Spray'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {number(
                            bottle.totalPurchased
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-amber-600">
                          {number(
                            bottle.usedForPerfume
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-purple-600">
                          {number(
                            bottle.bottleSales
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-red-600">
                          {number(
                            bottle.wasted
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {
                            stock
                          }
                        </td>

                        <td className="px-4 py-3 text-right">
                          {money(
                            bottle.avgCostPerUnit
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {money(
                            bottle.sellingPrice
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              isOut
                                ? 'bg-red-100 text-red-700'
                                : stock <
                                    LOW_STOCK_LIMIT
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isOut
                              ? 'Stock out'
                              : stock <
                                  LOW_STOCK_LIMIT
                                ? 'Low'
                                : 'OK'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {renderActions(
                            bottle
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

      {/* ADD */}

      {showAddModal && (
        <Modal
          maxWidth="max-w-xl"
          onClose={() =>
            !submitting &&
            setShowAddModal(
              false
            )
          }
        >
          <h2 className="pr-10 text-xl font-bold">
            Add Bottle
          </h2>

          <form
            onSubmit={
              handleAddSubmit
            }
            className="mt-5 space-y-4"
          >
            <label className="block text-sm font-medium">
              Size (ml)

              <input
                type="number"
                min="0.1"
                step="0.1"
                value={
                  newBottle.sizeMl
                }
                onChange={(
                  event
                ) =>
                  setNewBottle(
                    (
                      old
                    ) => ({
                      ...old,
                      sizeMl:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Type

              <select
                value={
                  newBottle.type
                }
                onChange={(
                  event
                ) =>
                  setNewBottle(
                    (
                      old
                    ) => ({
                      ...old,
                      type:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="spray">
                  Spray
                </option>

                <option value="roll-on">
                  Roll-on / Oil
                </option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Opening Stock

              <input
                type="number"
                min="0"
                step="1"
                value={
                  newBottle.currentStock
                }
                onChange={(
                  event
                ) =>
                  setNewBottle(
                    (
                      old
                    ) => ({
                      ...old,
                      currentStock:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium">
              Cost Per Unit (৳)

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  newBottle.avgCostPerUnit
                }
                onChange={(
                  event
                ) =>
                  setNewBottle(
                    (
                      old
                    ) => ({
                      ...old,
                      avgCostPerUnit:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium">
              Empty Bottle Selling Price (৳)

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  newBottle.sellingPrice
                }
                onChange={(
                  event
                ) =>
                  setNewBottle(
                    (
                      old
                    ) => ({
                      ...old,
                      sellingPrice:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Example: 80"
                className={`${fieldClass} mt-1`}
              />

              <span className="mt-1 block text-xs text-gray-500">
                Set 0 if this bottle should not be sold separately.
              </span>
            </label>

            <BottleImagesInput
              images={
                newBottle.images
              }
              setImages={(
                images
              ) =>
                setNewBottle(
                  (
                    old
                  ) => ({
                    ...old,
                    images,
                  })
                )
              }
            />

            {modalError && (
              <p className="text-sm text-red-600">
                {
                  modalError
                }
              </p>
            )}

            <button
              type="submit"
              disabled={
                submitting
              }
              className="w-full rounded-xl bg-brand-primary py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? 'Creating...'
                : 'Create Bottle'}
            </button>
          </form>
        </Modal>
      )}

      {/* EDIT */}

      {editingBottle && (
        <Modal
          maxWidth="max-w-xl"
          onClose={() =>
            !editSubmitting &&
            setEditingBottle(
              null
            )
          }
        >
          <h2 className="pr-10 text-xl font-bold">
            Edit Bottle
          </h2>

          <form
            onSubmit={
              handleEditSubmit
            }
            className="mt-5 space-y-4"
          >
            <label className="block text-sm font-medium">
              Size (ml)

              <input
                type="number"
                min="0.1"
                step="0.1"
                value={
                  editForm.sizeMl
                }
                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      old
                    ) => ({
                      ...old,
                      sizeMl:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Type

              <select
                value={
                  editForm.type
                }
                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      old
                    ) => ({
                      ...old,
                      type:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="spray">
                  Spray
                </option>

                <option value="roll-on">
                  Roll-on / Oil
                </option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Current Stock

              <input
                type="number"
                min="0"
                step="1"
                value={
                  editForm.currentStock
                }
                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      old
                    ) => ({
                      ...old,
                      currentStock:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium">
              Cost Per Unit (৳)

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  editForm.avgCostPerUnit
                }
                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      old
                    ) => ({
                      ...old,
                      avgCostPerUnit:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium">
              Empty Bottle Selling Price (৳)

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  editForm.sellingPrice
                }
                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      old
                    ) => ({
                      ...old,
                      sellingPrice:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <BottleImagesInput
              images={
                editForm.images
              }
              setImages={(
                images
              ) =>
                setEditForm(
                  (
                    old
                  ) => ({
                    ...old,
                    images,
                  })
                )
              }
            />

            {editError && (
              <p className="text-sm text-red-600">
                {
                  editError
                }
              </p>
            )}

            <button
              type="submit"
              disabled={
                editSubmitting
              }
              className="w-full rounded-xl bg-brand-primary py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {editSubmitting
                ? 'Updating...'
                : 'Update Bottle'}
            </button>
          </form>
        </Modal>
      )}

      {/* PURCHASE */}

      {purchaseBottle && (
        <Modal
          onClose={() =>
            !purchasing &&
            setPurchaseBottle(
              null
            )
          }
        >
          <h2 className="text-xl font-bold">
            Record Purchase
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {bottleLabel(
              purchaseBottle
            )}
          </p>

          <form
            onSubmit={
              handlePurchaseSubmit
            }
            className="mt-5 space-y-4"
          >
            <label className="block text-sm font-medium">
              Quantity

              <input
                type="number"
                min="1"
                step="1"
                value={
                  purchaseData.quantity
                }
                onChange={(
                  event
                ) =>
                  setPurchaseData(
                    (
                      old
                    ) => ({
                      ...old,
                      quantity:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Cost per unit

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  purchaseData.costPerUnit
                }
                onChange={(
                  event
                ) =>
                  setPurchaseData(
                    (
                      old
                    ) => ({
                      ...old,
                      costPerUnit:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Supplier

              <input
                value={
                  purchaseData.supplier
                }
                onChange={(
                  event
                ) =>
                  setPurchaseData(
                    (
                      old
                    ) => ({
                      ...old,
                      supplier:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium">
              Invoice No

              <input
                value={
                  purchaseData.invoiceNo
                }
                onChange={(
                  event
                ) =>
                  setPurchaseData(
                    (
                      old
                    ) => ({
                      ...old,
                      invoiceNo:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            {purchaseError && (
              <p className="text-sm text-red-600">
                {
                  purchaseError
                }
              </p>
            )}

            <button
              type="submit"
              disabled={
                purchasing
              }
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white"
            >
              {purchasing
                ? 'Recording...'
                : 'Record Purchase'}
            </button>
          </form>
        </Modal>
      )}

      {/* WASTAGE */}

      {wasteBottleTarget && (
        <Modal
          onClose={() =>
            !wasting &&
            setWasteBottleTarget(
              null
            )
          }
        >
          <h2 className="text-xl font-bold">
            Record Wastage
          </h2>

          <form
            onSubmit={
              handleWasteSubmit
            }
            className="mt-5 space-y-4"
          >
            <label className="block text-sm font-medium">
              Quantity

              <input
                type="number"
                min="1"
                step="1"
                max={number(
                  wasteBottleTarget.currentStock
                )}
                value={
                  wasteData.quantity
                }
                onChange={(
                  event
                ) =>
                  setWasteData(
                    (
                      old
                    ) => ({
                      ...old,
                      quantity:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Notes

              <input
                value={
                  wasteData.notes
                }
                onChange={(
                  event
                ) =>
                  setWasteData(
                    (
                      old
                    ) => ({
                      ...old,
                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />
            </label>

            {wasteError && (
              <p className="text-sm text-red-600">
                {
                  wasteError
                }
              </p>
            )}

            <button
              type="submit"
              disabled={
                wasting
              }
              className="w-full rounded-xl bg-orange-600 py-2.5 font-semibold text-white"
            >
              {wasting
                ? 'Recording...'
                : 'Record Wastage'}
            </button>
          </form>
        </Modal>
      )}

      {/* STOCK OUT */}

      {stockOutBottle && (
        <Modal
          onClose={() =>
            !stockingOut &&
            setStockOutBottle(
              null
            )
          }
        >
          <h3 className="text-xl font-bold">
            Stock Out Bottle?
          </h3>

          <p className="mt-3 text-sm text-gray-500">
            Remaining{' '}
            <strong>
              {number(
                stockOutBottle.currentStock
              )}
            </strong>{' '}
            bottle(s) will be recorded as wastage.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStockOutBottle(
                  null
                )
              }
              className="rounded-xl border px-4 py-2"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleStockOut
              }
              disabled={
                stockingOut
              }
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE */}

      {deleteTarget && (
        <Modal
          onClose={() =>
            !deleting &&
            setDeleteTarget(
              null
            )
          }
        >
          <h3 className="text-xl font-bold">
            Delete Bottle?
          </h3>

          <p className="mt-3 text-sm text-gray-500">
            Delete{' '}
            <strong>
              {bottleLabel(
                deleteTarget
              )}
            </strong>
            ?
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteTarget(
                  null
                )
              }
              className="rounded-xl border px-4 py-2"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleDeleteConfirm
              }
              disabled={
                deleting
              }
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* UPLOAD */}

      {showUploadModal && (
        <Modal
          maxWidth="max-w-xl"
          onClose={() =>
            !uploading &&
            setShowUploadModal(
              false
            )
          }
        >
          <h2 className="text-xl font-bold">
            Bulk Import Bottles
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Supported columns: sizeMl, Type, Stock, Unit Cost, Selling Price, Image1...Image10.
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
              className={
                fieldClass
              }
            />

            {uploadResult && (
              <div
                className={`rounded-xl p-3 text-sm ${
                  uploadResult.success
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                <div className="flex gap-2">
                  {uploadResult.success ? (
                    <CheckCircle
                      size={
                        18
                      }
                    />
                  ) : (
                    <AlertCircle
                      size={
                        18
                      }
                    />
                  )}

                  {
                    uploadResult.message
                  }
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                !file ||
                uploading
              }
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {uploading
                ? 'Uploading...'
                : 'Upload'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Bottles;