import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as XLSX from 'xlsx';

import toast from 'react-hot-toast';

import {
  AlertCircle,
  CheckCircle,
  DollarSign,
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

import API from '../../api/axios';

const LOW_STOCK_LIMIT = 3;

const MAX_UPLOAD_BYTES =
  5 * 1024 * 1024;

/* ========================================
   HELPERS
======================================== */

const number = (value) => {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
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
) =>
  `${number(
    bottle?.sizeMl
  )}ml ${
    bottle?.type ||
    ''
  }`.trim();

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

  /*
    Backward compatibility.
  */
  sold:
    number(
      bottle.sold
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
   READ EXCEL / CSV
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
                  event.target
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

              if (!firstSheet) {
                reject(
                  new Error(
                    'The spreadsheet does not contain a worksheet.'
                  )
                );

                return;
              }

              resolve(
                XLSX.utils
                  .sheet_to_json(
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
   PAGE
======================================== */

const Bottles = () => {
  const [
    bottles,
    setBottles,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  /* ======================================
     FILTERS
  ====================================== */

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState(
      'all'
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      'all'
    );

  /* ======================================
     ADD
  ====================================== */

  const [
    showAddModal,
    setShowAddModal,
  ] =
    useState(false);

  const [
    newBottle,
    setNewBottle,
  ] =
    useState({
      sizeMl:
        '',

      type:
        'spray',

      currentStock:
        0,

      avgCostPerUnit:
        0,
    });

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    modalError,
    setModalError,
  ] =
    useState('');

  /* ======================================
     EDIT
  ====================================== */

  const [
    editingBottle,
    setEditingBottle,
  ] =
    useState(null);

  const [
    editForm,
    setEditForm,
  ] =
    useState({
      sizeMl:
        '',

      type:
        'spray',

      currentStock:
        0,

      avgCostPerUnit:
        0,
    });

  const [
    editSubmitting,
    setEditSubmitting,
  ] =
    useState(false);

  const [
    editError,
    setEditError,
  ] =
    useState('');

  /* ======================================
     DELETE
  ====================================== */

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState(null);

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  /* ======================================
     UPLOAD
  ====================================== */

  const [
    showUploadModal,
    setShowUploadModal,
  ] =
    useState(false);

  const [
    file,
    setFile,
  ] =
    useState(null);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    uploadResult,
    setUploadResult,
  ] =
    useState(null);

  /* ======================================
     PURCHASE
  ====================================== */

  const [
    purchaseBottle,
    setPurchaseBottle,
  ] =
    useState(null);

  const [
    purchaseData,
    setPurchaseData,
  ] =
    useState({
      quantity:
        '',

      costPerUnit:
        '',

      supplier:
        '',

      invoiceNo:
        '',
    });

  const [
    purchasing,
    setPurchasing,
  ] =
    useState(false);

  const [
    purchaseError,
    setPurchaseError,
  ] =
    useState('');

  /* ======================================
     STOCK OUT
  ====================================== */

  const [
    stockOutBottle,
    setStockOutBottle,
  ] =
    useState(null);

  const [
    stockingOut,
    setStockingOut,
  ] =
    useState(false);

  /* ======================================
     WASTAGE
  ====================================== */

  const [
    wasteBottleTarget,
    setWasteBottleTarget,
  ] =
    useState(null);

  const [
    wasteData,
    setWasteData,
  ] =
    useState({
      quantity:
        '',

      notes:
        '',
    });

  const [
    wasting,
    setWasting,
  ] =
    useState(false);

  const [
    wasteError,
    setWasteError,
  ] =
    useState('');

  /* ========================================
     FETCH
  ======================================== */

  const fetchBottlesWithSales =
    async ({
      silent = false,
    } = {}) => {
      if (
        !silent
      ) {
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

        const rows =
          Array.isArray(
            data
          )
            ? data
            : [];

        setBottles(
          rows.map(
            normalizeBottle
          )
        );
      } catch (
        error
      ) {
        console.error(
          'Failed to fetch bottles with sales',
          error
        );

        toast.error(
          error.response
            ?.data
            ?.message ||
            'Failed to load bottles'
        );
      } finally {
        if (
          !silent
        ) {
          setLoading(
            false
          );
        }
      }
    };

  useEffect(() => {
    fetchBottlesWithSales();
  }, []);

  /* ========================================
     FILTERED BOTTLES
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
          const available =
            number(
              bottle.currentStock
            );

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
              available >=
                LOW_STOCK_LIMIT &&
              !bottle.isStockOut
            ) ||
            (
              statusFilter ===
                'low' &&
              available >
                0 &&
              available <
                LOW_STOCK_LIMIT &&
              !bottle.isStockOut
            ) ||
            (
              statusFilter ===
                'out' &&
              (
                available <=
                  0 ||
                bottle.isStockOut
              )
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
     TOTALS
  ======================================== */

  const totals =
    useMemo(
      () =>
        bottles.reduce(
          (
            summary,
            bottle
          ) => {
            const available =
              number(
                bottle.currentStock
              );

            summary.purchased +=
              number(
                bottle.totalPurchased
              );

            summary.produced +=
              number(
                bottle.produced
              );

            summary.usedForPerfume +=
              number(
                bottle.usedForPerfume
              );

            summary.bottleSales +=
              number(
                bottle.bottleSales
              );

            summary.bottleSalesRevenue +=
              number(
                bottle.bottleSalesRevenue
              );

            summary.wasted +=
              number(
                bottle.wasted
              );

            summary.available +=
              available;

            summary.value +=
              available *
              number(
                bottle.avgCostPerUnit
              );

            if (
              available <=
                0 ||
              bottle.isStockOut
            ) {
              summary.out +=
                1;
            } else if (
              available <
              LOW_STOCK_LIMIT
            ) {
              summary.low +=
                1;
            }

            return summary;
          },
          {
            purchased:
              0,

            produced:
              0,

            usedForPerfume:
              0,

            bottleSales:
              0,

            bottleSalesRevenue:
              0,

            wasted:
              0,

            available:
              0,

            value:
              0,

            low:
              0,

            out:
              0,
          }
        ),
      [
        bottles,
      ]
    );

  /* ========================================
     ADD BOTTLE
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
        !Number.isFinite(
          currentStock
        ) ||
        currentStock < 0
      ) {
        setModalError(
          'Stock cannot be negative.'
        );

        return;
      }

      if (
        !Number.isFinite(
          avgCostPerUnit
        ) ||
        avgCostPerUnit <
          0
      ) {
        setModalError(
          'Per-unit cost cannot be negative.'
        );

        return;
      }

      setSubmitting(
        true
      );

      setModalError(
        ''
      );

      try {
        await API.post(
          '/inventory/bottles',
          {
            sizeMl,

            type:
              newBottle.type,

            currentStock,

            avgCostPerUnit,
          }
        );

        toast.success(
          'Bottle added successfully'
        );

        setShowAddModal(
          false
        );

        setNewBottle({
          sizeMl:
            '',

          type:
            'spray',

          currentStock:
            0,

          avgCostPerUnit:
            0,
        });

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
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
     EDIT BOTTLE
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
      });

      setEditError(
        ''
      );
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
        !Number.isFinite(
          currentStock
        ) ||
        currentStock < 0
      ) {
        setEditError(
          'Stock cannot be negative.'
        );

        return;
      }

      if (
        !Number.isFinite(
          avgCostPerUnit
        ) ||
        avgCostPerUnit <
          0
      ) {
        setEditError(
          'Per-unit cost cannot be negative.'
        );

        return;
      }

      setEditSubmitting(
        true
      );

      setEditError(
        ''
      );

      try {
        await API.put(
          `/inventory/bottles/${editingBottle._id}`,
          {
            sizeMl,

            type:
              editForm.type,

            currentStock,

            avgCostPerUnit,
          }
        );

        toast.success(
          'Bottle updated successfully'
        );

        setEditingBottle(
          null
        );

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
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
     DELETE BOTTLE
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

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
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

  const handlePurchaseClick =
    (
      bottle
    ) => {
      setPurchaseBottle(
        bottle
      );

      setPurchaseData({
        quantity:
          '',

        costPerUnit:
          '',

        supplier:
          '',

        invoiceNo:
          '',
      });

      setPurchaseError(
        ''
      );
    };

  const handlePurchaseSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !purchaseBottle
      ) {
        return;
      }

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
        costPerUnit <
          0
      ) {
        setPurchaseError(
          'Cost per unit cannot be negative.'
        );

        return;
      }

      setPurchasing(
        true
      );

      setPurchaseError(
        ''
      );

      try {
        await API.post(
          `/inventory/bottles/${purchaseBottle._id}/purchase`,
          {
            quantity,

            costPerUnit,

            supplier:
              purchaseData.supplier
                .trim() ||
              undefined,

            invoiceNo:
              purchaseData.invoiceNo
                .trim() ||
              undefined,
          }
        );

        toast.success(
          'Purchase recorded'
        );

        setPurchaseBottle(
          null
        );

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
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
     STOCK OUT
  ======================================== */

  const handleStockOutConfirm =
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
          `${bottleLabel(
            stockOutBottle
          )} marked as stock out`
        );

        setStockOutBottle(
          null
        );

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data
            ?.message ||
            'Stock-out failed'
        );
      } finally {
        setStockingOut(
          false
        );
      }
    };

  /* ========================================
     WASTAGE
  ======================================== */

  const handleWasteClick =
    (
      bottle
    ) => {
      setWasteBottleTarget(
        bottle
      );

      setWasteData({
        quantity:
          '',

        notes:
          '',
      });

      setWasteError(
        ''
      );
    };

  const handleWasteSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !wasteBottleTarget
      ) {
        return;
      }

      const quantity =
        Number(
          wasteData.quantity
        );

      const available =
        number(
          wasteBottleTarget.currentStock
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
        available
      ) {
        setWasteError(
          `Only ${available} bottle(s) are currently available.`
        );

        return;
      }

      setWasting(
        true
      );

      setWasteError(
        ''
      );

      try {
        await API.post(
          `/inventory/bottles/${wasteBottleTarget._id}/waste`,
          {
            quantity,

            notes:
              wasteData.notes
                .trim() ||
              undefined,
          }
        );

        toast.success(
          `Recorded ${quantity} bottle(s) as wastage`
        );

        setWasteBottleTarget(
          null
        );

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
      } catch (
        error
      ) {
        setWasteError(
          error.response
            ?.data
            ?.message ||
            'Waste failed'
        );
      } finally {
        setWasting(
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
        setFile(
          null
        );

        setUploadResult(
          {
            success:
              false,

            message:
              'File is too large. Maximum upload size is 5 MB.',
          }
        );

        event.target.value =
          '';

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

        if (
          !rows.length
        ) {
          throw new Error(
            'The spreadsheet does not contain any data rows.'
          );
        }

        const findColumn =
          (
            row,
            names
          ) => {
            const keys =
              Object.keys(
                row
              );

            for (
              const name of
              names
            ) {
              const normalizedName =
                name.toLowerCase();

              const found =
                keys.find(
                  (
                    key
                  ) =>
                    key
                      .trim()
                      .toLowerCase()
                      .includes(
                        normalizedName
                      )
                );

              if (
                found
              ) {
                return found;
              }
            }

            return null;
          };

        const firstRow =
          rows[0] ||
          {};

        const sizeCol =
          findColumn(
            firstRow,
            [
              'sizeml',
              'size',
              'ml',
            ]
          );

        const typeCol =
          findColumn(
            firstRow,
            [
              'bottle type',
              'type',
            ]
          );

        const stockCol =
          findColumn(
            firstRow,
            [
              'stock',
              'qty',
              'quantity',
            ]
          );

        const costCol =
          findColumn(
            firstRow,
            [
              'per unit cost',
              'unit cost',
              'avg cost',
              'cost',
            ]
          );

        if (
          !sizeCol
        ) {
          throw new Error(
            `Could not find a bottle size column. Found: ${
              Object.keys(
                firstRow
              ).join(
                ', '
              ) ||
              'none'
            }.`
          );
        }

        const items =
          rows
            .map(
              (
                row
              ) => {
                const sizeRaw =
                  String(
                    row[
                      sizeCol
                    ] ??
                      ''
                  ).trim();

                const sizeMatch =
                  sizeRaw.match(
                    /([\d.]+)/
                  );

                const sizeMl =
                  sizeMatch
                    ? Number(
                        sizeMatch[1]
                      )
                    : NaN;

                let type =
                  'spray';

                const typeRaw =
                  String(
                    typeCol
                      ? row[
                          typeCol
                        ]
                      : sizeRaw
                  )
                    .toLowerCase()
                    .trim();

                if (
                  typeRaw.includes(
                    'roll'
                  ) ||
                  typeRaw.includes(
                    'role'
                  )
                ) {
                  type =
                    'roll-on';
                } else if (
                  typeRaw.includes(
                    'spray'
                  )
                ) {
                  type =
                    'spray';
                }

                const currentStock =
                  Math.max(
                    0,
                    number(
                      stockCol
                        ? row[
                            stockCol
                          ]
                        : 0
                    )
                  );

                const avgCostPerUnit =
                  Math.max(
                    0,
                    number(
                      costCol
                        ? row[
                            costCol
                          ]
                        : 0
                    )
                  );

                return {
                  sizeMl,

                  type,

                  currentStock,

                  avgCostPerUnit,
                };
              }
            )
            .filter(
              (
                item
              ) =>
                Number.isFinite(
                  item.sizeMl
                ) &&
                item.sizeMl >
                  0 &&
                [
                  'spray',
                  'roll-on',
                ].includes(
                  item.type
                )
            );

        if (
          !items.length
        ) {
          throw new Error(
            'No valid bottle rows were found in the spreadsheet.'
          );
        }

        const response =
          await API.post(
            '/inventory/bottles/bulk',
            {
              items,
            }
          );

        setUploadResult(
          {
            success:
              true,

            data:
              response.data,
          }
        );

        setFile(
          null
        );

        toast.success(
          'Bottles uploaded successfully'
        );

        await fetchBottlesWithSales(
          {
            silent:
              true,
          }
        );
      } catch (
        error
      ) {
        setUploadResult(
          {
            success:
              false,

            message:
              error.response
                ?.data
                ?.message ||
              error.message ||
              'Upload failed',
          }
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /* ========================================
     ACTION BUTTONS
  ======================================== */

  const renderActions =
    (
      bottle
    ) => {
      const available =
        number(
          bottle.currentStock
        );

      const stockOutDisabled =
        bottle.isStockOut ||
        stockingOut;

      return (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() =>
              handlePurchaseClick(
                bottle
              )
            }
            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            title="Record purchase"
          >
            <DollarSign
              size={
                18
              }
            />
          </button>

          <button
            type="button"
            onClick={() =>
              handleWasteClick(
                bottle
              )
            }
            disabled={
              available <=
              0
            }
            className="rounded-lg p-2 text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-orange-950/30"
            title="Record partial wastage"
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
            onClick={() =>
              setStockOutBottle(
                bottle
              )
            }
            disabled={
              stockOutDisabled
            }
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30"
            title={
              bottle.isStockOut
                ? 'Already stock out'
                : 'Stock out all remaining'
            }
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
     RENDER
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
            Track bottles purchased,
            used with perfume,
            sold separately,
            wasted and currently available.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              fetchBottlesWithSales()
            }
            disabled={
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
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
            onClick={() => {
              setUploadResult(
                null
              );

              setFile(
                null
              );

              setShowUploadModal(
                true
              );
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Upload
              size={
                17
              }
            />

            Upload
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError(
                ''
              );

              setShowAddModal(
                true
              );
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus
              size={
                17
              }
            />

            Add Bottle
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Purchased
          </p>

          <p className="mt-1 text-xl font-bold">
            {
              totals.purchased
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Used for Perfume
          </p>

          <p className="mt-1 text-xl font-bold text-blue-600">
            {
              totals.usedForPerfume
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Bottle Sales
          </p>

          <p className="mt-1 text-xl font-bold text-purple-600">
            {
              totals.bottleSales
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Bottle Revenue
          </p>

          <p className="mt-1 text-xl font-bold text-emerald-600">
            {money(
              totals.bottleSalesRevenue
            )}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Wasted
          </p>

          <p className="mt-1 text-xl font-bold text-orange-600">
            {
              totals.wasted
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Available
          </p>

          <p className="mt-1 text-xl font-bold text-emerald-600">
            {
              totals.available
            }
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-gray-500">
            Stock Value
          </p>

          <p className="mt-1 text-xl font-bold">
            {money(
              totals.value
            )}
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <div className="grid gap-3 rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3">
        <div className="relative">
          <Search
            size={
              17
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
                event.target
                  .value
              )
            }
            placeholder="Search size or type..."
            className={`${fieldClass} pl-10`}
          />
        </div>

        <select
          value={
            typeFilter
          }
          onChange={(
            event
          ) =>
            setTypeFilter(
              event.target
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

          <option value="roll-on">
            Roll-on / Oil
          </option>

          <option value="spray">
            Spray
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
              event.target
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
            Low Stock
          </option>

          <option value="out">
            Stock Out
          </option>
        </select>
      </div>

      {/* TABLE */}

      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center">
          <RefreshCw
            size={
              30
            }
            className="animate-spin text-brand-primary"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Size
                  </th>

                  <th className="px-4 py-3 text-left">
                    Type
                  </th>

                  <th className="px-4 py-3 text-right">
                    Purchased
                  </th>

                  <th className="px-4 py-3 text-right">
                    Used for Perfume
                  </th>

                  <th className="px-4 py-3 text-right">
                    Bottle Sales
                  </th>

                  <th className="px-4 py-3 text-right">
                    Wasted
                  </th>

                  <th className="px-4 py-3 text-right">
                    Available
                  </th>

                  <th className="px-4 py-3 text-right">
                    Unit Cost
                  </th>

                  <th className="px-4 py-3 text-right">
                    Stock Value
                  </th>

                  <th className="px-4 py-3 text-right">
                    Bottle Revenue
                  </th>

                  <th className="px-4 py-3 text-center">
                    Status
                  </th>

                  <th className="px-4 py-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredBottles.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={
                        12
                      }
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      No bottles
                      found
                    </td>
                  </tr>
                ) : (
                  filteredBottles.map(
                    (
                      bottle
                    ) => {
                      const purchased =
                        number(
                          bottle.totalPurchased
                        );

                      const produced =
                        number(
                          bottle.produced
                        );

                      const usedForPerfume =
                        number(
                          bottle.usedForPerfume
                        );

                      const bottleSales =
                        number(
                          bottle.bottleSales
                        );

                      const wasted =
                        number(
                          bottle.wasted
                        );

                      const available =
                        number(
                          bottle.currentStock
                        );

                      const expected =
                        purchased -
                        usedForPerfume -
                        bottleSales -
                        wasted;

                      /*
                        If your totalPurchased includes
                        production additions, this formula
                        is correct.

                        Backend rebuild currently sets:
                        totalPurchased =
                        purchases + production.
                      */

                      const mismatch =
                        Math.abs(
                          available -
                            expected
                        ) >
                        0.001;

                      const stockValue =
                        available *
                        number(
                          bottle.avgCostPerUnit
                        );

                      return (
                        <tr
                          key={
                            bottle._id
                          }
                          className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
                        >
                          <td className="px-4 py-3 font-semibold">
                            {number(
                              bottle.sizeMl
                            )}{' '}
                            ml
                          </td>

                          <td className="px-4 py-3 capitalize">
                            {bottle.type ===
                            'roll-on'
                              ? 'Roll-on / Oil'
                              : 'Spray'}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {
                              purchased
                            }

                            {produced >
                              0 && (
                              <span
                                className="ml-1 text-xs text-gray-400"
                                title={`${produced} added through production`}
                              >
                                *
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium text-blue-600">
                            {
                              usedForPerfume
                            }
                          </td>

                          <td className="px-4 py-3 text-right font-medium text-purple-600">
                            {
                              bottleSales
                            }
                          </td>

                          <td className="px-4 py-3 text-right text-orange-600">
                            {
                              wasted
                            }
                          </td>

                          <td className="px-4 py-3 text-right font-bold">
                            {
                              available
                            }

                            {mismatch && (
                              <span
                                className="ml-1 cursor-help text-amber-500"
                                title={`Mismatch: ${purchased} - ${usedForPerfume} - ${bottleSales} - ${wasted} = ${expected}, actual = ${available}`}
                              >
                                ⚠️
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {money(
                              bottle.avgCostPerUnit
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {money(
                              stockValue
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                            {money(
                              bottle.bottleSalesRevenue
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                bottle.isStockOut ||
                                available <=
                                  0
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  : available <
                                      LOW_STOCK_LIMIT
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              }`}
                            >
                              {bottle.isStockOut ||
                              available <=
                                0
                                ? 'Stock out'
                                : available <
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
                  )
                )}
              </tbody>

              <tfoot className="bg-gray-50 font-semibold dark:bg-slate-800">
                <tr>
                  <td
                    colSpan={
                      2
                    }
                    className="px-4 py-3 text-right"
                  >
                    All Inventory
                  </td>

                  <td className="px-4 py-3 text-right">
                    {
                      totals.purchased
                    }
                  </td>

                  <td className="px-4 py-3 text-right text-blue-600">
                    {
                      totals.usedForPerfume
                    }
                  </td>

                  <td className="px-4 py-3 text-right text-purple-600">
                    {
                      totals.bottleSales
                    }
                  </td>

                  <td className="px-4 py-3 text-right text-orange-600">
                    {
                      totals.wasted
                    }
                  </td>

                  <td className="px-4 py-3 text-right">
                    {
                      totals.available
                    }
                  </td>

                  <td />

                  <td className="px-4 py-3 text-right">
                    {money(
                      totals.value
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-emerald-600">
                    {money(
                      totals.bottleSalesRevenue
                    )}
                  </td>

                  <td
                    colSpan={
                      2
                    }
                  />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ADD */}

      {showAddModal && (
        <Modal
          onClose={() =>
            !submitting &&
            setShowAddModal(
              false
            )
          }
        >
          <h2 className="pr-10 text-xl font-bold">
            Add Bottle Type
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
                      previous
                    ) => ({
                      ...previous,

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
                      previous
                    ) => ({
                      ...previous,

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
              Opening stock

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
                      previous
                    ) => ({
                      ...previous,

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
              Per-unit cost
              (৳)

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
                      previous
                    ) => ({
                      ...previous,

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
                      previous
                    ) => ({
                      ...previous,

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
                      previous
                    ) => ({
                      ...previous,

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
              Current stock

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
                      previous
                    ) => ({
                      ...previous,

                      currentStock:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className={`${fieldClass} mt-1`}
              />

              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                Manual stock
                override.
              </span>
            </label>

            <label className="block text-sm font-medium">
              Per-unit cost
              (৳)

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
                      previous
                    ) => ({
                      ...previous,

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

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800">
              <div>
                <span className="text-gray-500">
                  Purchased
                </span>

                <p className="font-semibold">
                  {number(
                    editingBottle.totalPurchased
                  )}
                </p>
              </div>

              <div>
                <span className="text-gray-500">
                  Used for
                  Perfume
                </span>

                <p className="font-semibold text-blue-600">
                  {number(
                    editingBottle.usedForPerfume
                  )}
                </p>
              </div>

              <div>
                <span className="text-gray-500">
                  Bottle Sales
                </span>

                <p className="font-semibold text-purple-600">
                  {number(
                    editingBottle.bottleSales
                  )}
                </p>
              </div>

              <div>
                <span className="text-gray-500">
                  Wasted
                </span>

                <p className="font-semibold text-orange-600">
                  {number(
                    editingBottle.wasted
                  )}
                </p>
              </div>

              <div>
                <span className="text-gray-500">
                  Current
                </span>

                <p className="font-semibold">
                  {number(
                    editingBottle.currentStock
                  )}
                </p>
              </div>

              <div>
                <span className="text-gray-500">
                  Bottle Revenue
                </span>

                <p className="font-semibold text-emerald-600">
                  {money(
                    editingBottle.bottleSalesRevenue
                  )}
                </p>
              </div>
            </div>

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
          <h3 className="pr-10 text-xl font-bold">
            Delete Bottle?
          </h3>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Delete{' '}
            <strong>
              {bottleLabel(
                deleteTarget
              )}
            </strong>
            ? This action
            cannot be undone.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteTarget(
                  null
                )
              }
              disabled={
                deleting
              }
              className="rounded-xl border border-gray-300 px-4 py-2 dark:border-slate-600"
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
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {deleting
                ? 'Deleting...'
                : 'Delete'}
            </button>
          </div>
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
          <h3 className="pr-10 text-xl font-bold">
            Stock Out
            Bottle
          </h3>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Mark{' '}
            <strong>
              {bottleLabel(
                stockOutBottle
              )}
            </strong>{' '}
            as stock out?
          </p>

          {number(
            stockOutBottle.currentStock
          ) >
            0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Remaining{' '}
              <strong>
                {number(
                  stockOutBottle.currentStock
                )}{' '}
                pcs
              </strong>{' '}
              will be
              recorded as
              wastage.
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStockOutBottle(
                  null
                )
              }
              disabled={
                stockingOut
              }
              className="rounded-xl border border-gray-300 px-4 py-2 dark:border-slate-600"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleStockOutConfirm
              }
              disabled={
                stockingOut
              }
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {stockingOut
                ? 'Processing...'
                : 'Confirm Stock Out'}
            </button>
          </div>
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
          <h2 className="pr-10 text-xl font-bold">
            Record Wastage
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {bottleLabel(
              wasteBottleTarget
            )}{' '}
            · Available:{' '}
            {number(
              wasteBottleTarget.currentStock
            )}
          </p>

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
                max={number(
                  wasteBottleTarget.currentStock
                )}
                step="1"
                value={
                  wasteData.quantity
                }
                onChange={(
                  event
                ) =>
                  setWasteData(
                    (
                      previous
                    ) => ({
                      ...previous,

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
                      previous
                    ) => ({
                      ...previous,

                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Broken, damaged during shipping..."
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
              className="w-full rounded-xl bg-orange-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {wasting
                ? 'Recording...'
                : 'Record Wastage'}
            </button>
          </form>
        </Modal>
      )}

      {/* UPLOAD */}

      {showUploadModal && (
        <Modal
          onClose={() => {
            if (
              uploading
            ) {
              return;
            }

            setShowUploadModal(
              false
            );

            setUploadResult(
              null
            );

            setFile(
              null
            );
          }}
        >
          <h2 className="pr-10 text-xl font-bold">
            Bulk Upload
            Bottles
          </h2>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Required:
            bottle size.
            Optional: type,
            stock and
            per-unit cost.
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
              className={
                fieldClass
              }
              required
            />

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

                  <span>
                    {uploadResult.success
                      ? uploadResult
                          .data
                          ?.message ||
                        'Upload completed successfully.'
                      : uploadResult.message}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                uploading ||
                !file
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
          <h2 className="pr-10 text-xl font-bold">
            Record Purchase
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                      previous
                    ) => ({
                      ...previous,

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
              (৳)

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
                      previous
                    ) => ({
                      ...previous,

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
                      previous
                    ) => ({
                      ...previous,

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
              Invoice No.

              <input
                value={
                  purchaseData.invoiceNo
                }
                onChange={(
                  event
                ) =>
                  setPurchaseData(
                    (
                      previous
                    ) => ({
                      ...previous,

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
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {purchasing
                ? 'Recording...'
                : 'Record Purchase'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Bottles;