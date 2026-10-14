import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import API from '../../api/axios';

import {
  Plus,
  Eye,
  Search,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

/* ========================================
   HELPERS
======================================== */

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const money = (value) =>
  `৳${number(value).toFixed(2)}`;

const getItemType = (item) =>
  item?.itemType || 'product';

const getBottleLabel = (bottle, sizeMl) => {
  if (bottle) {
    const typeLabel =
      bottle.type === 'roll-on'
        ? 'Roll-on'
        : 'Spray';

    return `${number(
      bottle.sizeMl
    )}ml ${typeLabel} Bottle`;
  }

  return `${number(
    sizeMl
  )}ml Bottle`;
};

const getItemName = (item) => {
  const type =
    getItemType(item);

  if (type === 'bottle') {
    return getBottleLabel(
      item.bottle,
      item.sizeMl
    );
  }

  return (
    item.product?.name ||
    'Unknown Product'
  );
};

const getItemTypeLabel = (item) => {
  const type =
    getItemType(item);

  if (type === 'bottle') {
    return 'Bottle Only';
  }

  if (
    item.product?.type ===
    'roll-on'
  ) {
    return 'Oil / Roll-on';
  }

  if (
    item.product?.type ===
    'spray'
  ) {
    return 'Perfume / Spray';
  }

  return 'Perfume';
};

/* ========================================
   PAGE
======================================== */

const SalesList = () => {
  const [
    sales,
    setSales,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    filter,
    setFilter,
  ] = useState({
    channel: '',
    paymentStatus: '',
  });

  const [
    typeFilter,
    setTypeFilter,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    expandedRows,
    setExpandedRows,
  ] = useState({});

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

  /* ======================================
     DETAILS
  ====================================== */

  const [
    showDetailsModal,
    setShowDetailsModal,
  ] = useState(false);

  const [
    selectedSale,
    setSelectedSale,
  ] = useState(null);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  /* ======================================
     DELETE
  ====================================== */

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [
    saleToDelete,
    setSaleToDelete,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /* ======================================
     PAYMENT
  ====================================== */

  const [
    updatingStatus,
    setUpdatingStatus,
  ] = useState(null);

  /* ========================================
     LOAD
  ======================================== */

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales =
    async () => {
      setLoading(
        true
      );

      try {
        const {
          data,
        } =
          await API.get(
            '/sales'
          );

        setSales(
          Array.isArray(
            data
          )
            ? data
            : []
        );
      } catch (error) {
        toast.error(
          error.response
            ?.data?.message ||
            'Failed to load sales'
        );

        console.error(
          error
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  /* ========================================
     FILTERS
  ======================================== */

  const handleFilterChange =
    (event) => {
      setFilter(
        (
          previous
        ) => ({
          ...previous,
          [event.target.name]:
            event.target.value,
        })
      );
    };

  const filteredAndSortedSales =
    useMemo(() => {
      let filtered =
        [...sales];

      if (
        filter.channel
      ) {
        filtered =
          filtered.filter(
            (sale) =>
              sale.channel ===
              filter.channel
          );
      }

      if (
        filter.paymentStatus
      ) {
        filtered =
          filtered.filter(
            (sale) =>
              sale.paymentStatus ===
              filter.paymentStatus
          );
      }

      if (
        search.trim()
      ) {
        const lowerSearch =
          search
            .trim()
            .toLowerCase();

        filtered =
          filtered.filter(
            (sale) => {
              const invoiceMatch =
                String(
                  sale.invoiceNo ||
                    ''
                )
                  .toLowerCase()
                  .includes(
                    lowerSearch
                  );

              const channelMatch =
                String(
                  sale.channel ||
                    ''
                )
                  .toLowerCase()
                  .includes(
                    lowerSearch
                  );

              const itemMatch =
                (
                  sale.items ||
                  []
                ).some(
                  (item) => {
                    const itemName =
                      getItemName(
                        item
                      )
                        .toLowerCase();

                    const sku =
                      String(
                        item.product
                          ?.sku ||
                          ''
                      )
                        .toLowerCase();

                    const bottleType =
                      String(
                        item.bottle
                          ?.type ||
                          ''
                      )
                        .toLowerCase();

                    const size =
                      String(
                        item.sizeMl ||
                          ''
                      );

                    return (
                      itemName.includes(
                        lowerSearch
                      ) ||
                      sku.includes(
                        lowerSearch
                      ) ||
                      bottleType.includes(
                        lowerSearch
                      ) ||
                      size.includes(
                        lowerSearch
                      )
                    );
                  }
                );

              return (
                invoiceMatch ||
                channelMatch ||
                itemMatch
              );
            }
          );
      }

      if (
        typeFilter
      ) {
        filtered =
          filtered.filter(
            (sale) =>
              (
                sale.items ||
                []
              ).some(
                (item) => {
                  const itemType =
                    getItemType(
                      item
                    );

                  if (
                    typeFilter ===
                    'bottle'
                  ) {
                    return (
                      itemType ===
                      'bottle'
                    );
                  }

                  if (
                    itemType ===
                    'bottle'
                  ) {
                    return false;
                  }

                  if (
                    typeFilter ===
                    'oil'
                  ) {
                    return (
                      item.product
                        ?.type ===
                      'roll-on'
                    );
                  }

                  if (
                    typeFilter ===
                    'perfume'
                  ) {
                    return (
                      item.product
                        ?.type ===
                      'spray'
                    );
                  }

                  return true;
                }
              )
          );
      }

      return filtered.sort(
        (
          a,
          b
        ) => {
          const numA =
            parseInt(
              String(
                a.invoiceNo ||
                  ''
              ).replace(
                /\D/g,
                ''
              )
            ) ||
            0;

          const numB =
            parseInt(
              String(
                b.invoiceNo ||
                  ''
              ).replace(
                /\D/g,
                ''
              )
            ) ||
            0;

          return (
            numB -
            numA
          );
        }
      );
    }, [
      sales,
      filter,
      search,
      typeFilter,
    ]);

  /* ========================================
     EXPAND
  ======================================== */

  const toggleRow =
    (
      invoiceNo
    ) => {
      setExpandedRows(
        (
          previous
        ) => ({
          ...previous,

          [invoiceNo]:
            !previous[
              invoiceNo
            ],
        })
      );
    };

  /* ========================================
     OPTIONS
  ======================================== */

  const channelSuggestions =
    [
      'Fair1',
      'Fair2',
      'Fair3',
      'Fair4',
      'Fair5',
      'August',
      'September',
      'October',
      'November',
      'December',
      'Online',
      'Other',
    ];

  const paymentStatusOptions =
    [
      'paid',
      'due',
    ];

  const typeOptions =
    [
      {
        value: 'oil',
        label: 'Oil / Roll-on',
      },

      {
        value: 'perfume',
        label: 'Perfume / Spray',
      },

      {
        value: 'bottle',
        label: 'Bottle Only',
      },
    ];

  /* ========================================
     FLEXIBLE COLUMN FINDER
  ======================================== */

  const findColumn =
    (
      object,
      possibleNames
    ) => {
      const keys =
        Object.keys(
          object
        );

      for (
        const name of
        possibleNames
      ) {
        const normalizedName =
          name
            .toLowerCase()
            .replace(
              /[^a-z0-9]/g,
              ''
            );

        const found =
          keys.find(
            (key) => {
              const normalizedKey =
                key
                  .trim()
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9]/g,
                    ''
                  );

              return (
                normalizedKey ===
                  normalizedName ||
                normalizedKey.includes(
                  normalizedName
                ) ||
                normalizedName.includes(
                  normalizedKey
                )
              );
            }
          );

        if (found) {
          return found;
        }
      }

      return null;
    };

  /* ========================================
     UPLOAD
  ======================================== */

  const handleFileChange =
    (
      event
    ) => {
      const selected =
        event.target
          .files?.[0] ||
        null;

      if (
        selected
      ) {
        setFile(
          selected
        );
      }
    };

  const handleUploadSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (!file) {
        return;
      }

      setUploading(
        true
      );

      setUploadResult(
        null
      );

      try {
        const reader =
          new FileReader();

        reader.onload =
          async (
            readEvent
          ) => {
            try {
              const data =
                new Uint8Array(
                  readEvent
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

              const sheet =
                workbook
                  .Sheets[
                  workbook
                    .SheetNames[0]
                ];

              const rows =
                XLSX.utils
                  .sheet_to_json(
                    sheet,
                    {
                      defval:
                        '',
                    }
                  );

              if (
                !rows.length
              ) {
                setUploadResult(
                  {
                    success:
                      false,

                    message:
                      'File is empty',
                  }
                );

                return;
              }

              /*
                Current upload stays for
                normal perfume sales.

                Bottle-only sales should be
                entered from New Sale for now.
              */

              const firstRow =
                rows[0];

              const foundColumns =
                Object.keys(
                  firstRow
                ).join(
                  ', '
                );

              const skuCol =
                findColumn(
                  firstRow,
                  [
                    'sku',
                    'sku code',
                    'product sku',
                  ]
                );

              const sizeCol =
                findColumn(
                  firstRow,
                  [
                    'size',
                    'sizeml',
                    'ml',
                    'size ml',
                  ]
                );

              const priceCol =
                findColumn(
                  firstRow,
                  [
                    'unitprice',
                    'unit price',
                    'price',
                    'selling price',
                    'rate',
                    'unit price (৳)',
                  ]
                );

              const totalCol =
                findColumn(
                  firstRow,
                  [
                    'total',
                    'total price',
                    'total amount',
                    'amount',
                    'total (৳)',
                  ]
                );

              const invoiceCol =
                findColumn(
                  firstRow,
                  [
                    'invoice',
                    'invoice no',
                    'invoiceno',
                    'invoice number',
                  ]
                );

              const qtyCol =
                findColumn(
                  firstRow,
                  [
                    'quantity',
                    'qty',
                    'units',
                  ]
                );

              const channelCol =
                findColumn(
                  firstRow,
                  [
                    'channel',
                    'sales channel',
                    'fair',
                    'store',
                  ]
                );

              const dateCol =
                findColumn(
                  firstRow,
                  [
                    'saledate',
                    'sale date',
                    'date',
                    'transaction date',
                  ]
                );

              const paymentCol =
                findColumn(
                  firstRow,
                  [
                    'paymentstatus',
                    'payment status',
                    'status',
                  ]
                );

              const notesCol =
                findColumn(
                  firstRow,
                  [
                    'notes',
                    'note',
                    'remarks',
                    'comment',
                  ]
                );

              if (
                !skuCol ||
                !sizeCol ||
                (
                  !priceCol &&
                  !totalCol
                )
              ) {
                setUploadResult(
                  {
                    success:
                      false,

                    message:
                      `Required: SKU, Size, and either Price or Total. Found columns: ${foundColumns}`,
                  }
                );

                return;
              }

              const salesMap =
                new Map();

              const timestamp =
                Date.now();

              for (
                let index = 0;
                index <
                rows.length;
                index += 1
              ) {
                const row =
                  rows[index];

                const sku =
                  String(
                    row[
                      skuCol
                    ]
                  ).trim();

                const sizeMl =
                  parseFloat(
                    row[
                      sizeCol
                    ]
                  );

                const quantity =
                  qtyCol
                    ? parseInt(
                        row[
                          qtyCol
                        ]
                      ) ||
                      1
                    : 1;

                let unitPrice =
                  NaN;

                if (
                  priceCol
                ) {
                  unitPrice =
                    parseFloat(
                      row[
                        priceCol
                      ]
                    );
                }

                if (
                  (
                    Number.isNaN(
                      unitPrice
                    ) ||
                    unitPrice <=
                      0
                  ) &&
                  totalCol
                ) {
                  const totalValue =
                    parseFloat(
                      row[
                        totalCol
                      ]
                    );

                  if (
                    !Number.isNaN(
                      totalValue
                    ) &&
                    quantity >
                      0
                  ) {
                    unitPrice =
                      totalValue /
                      quantity;
                  }
                }

                if (
                  Number.isNaN(
                    unitPrice
                  ) ||
                  unitPrice <=
                    0
                ) {
                  continue;
                }

                const channel =
                  channelCol
                    ? String(
                        row[
                          channelCol
                        ]
                      ).trim()
                    : 'Other';

                const saleDate =
                  dateCol
                    ? row[
                        dateCol
                      ]
                    : '';

                const paymentStatus =
                  paymentCol
                    ? String(
                        row[
                          paymentCol
                        ]
                      )
                        .toLowerCase()
                        .trim()
                    : 'paid';

                const notes =
                  notesCol
                    ? String(
                        row[
                          notesCol
                        ]
                      ).trim()
                    : '';

                let invoice;

                if (
                  invoiceCol
                ) {
                  invoice =
                    String(
                      row[
                        invoiceCol
                      ]
                    ).trim();

                  if (!invoice) {
                    invoice =
                      `SALE-${timestamp}-${String(
                        index +
                          1
                      ).padStart(
                        3,
                        '0'
                      )}`;
                  }
                } else {
                  invoice =
                    `SALE-${timestamp}-${String(
                      index +
                        1
                    ).padStart(
                      3,
                      '0'
                    )}`;
                }

                if (
                  !salesMap.has(
                    invoice
                  )
                ) {
                  salesMap.set(
                    invoice,
                    {
                      invoiceNo:
                        invoice,

                      channel:
                        channel ||
                        'Other',

                      saleDate:
                        saleDate ||
                        '',

                      paymentStatus:
                        paymentStatus ||
                        'paid',

                      items:
                        [],

                      notes:
                        notes ||
                        '',
                    }
                  );
                }

                const sale =
                  salesMap.get(
                    invoice
                  );

                sale.items.push(
                  {
                    itemType:
                      'product',

                    sku,

                    sizeMl,

                    quantity,

                    unitPrice,
                  }
                );
              }

              const salesArray =
                Array.from(
                  salesMap.values()
                ).filter(
                  (sale) =>
                    sale.items
                      .length >
                    0
                );

              if (
                !salesArray.length
              ) {
                setUploadResult(
                  {
                    success:
                      false,

                    message:
                      `No valid rows. Ensure SKU, Size, and Price/Total are valid. Found: ${foundColumns}`,
                  }
                );

                return;
              }

              const response =
                await API.post(
                  '/sales/bulk',
                  {
                    sales:
                      salesArray,
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

              await fetchSales();

              setFile(
                null
              );

              setTimeout(
                () =>
                  setShowUploadModal(
                    false
                  ),
                3000
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

        reader.onerror =
          () => {
            setUploadResult(
              {
                success:
                  false,

                message:
                  'Could not read the selected file.',
              }
            );

            setUploading(
              false
            );
          };

        reader.readAsArrayBuffer(
          file
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
              'Upload failed',
          }
        );

        setUploading(
          false
        );
      }
    };

  /* ========================================
     PRINT
  ======================================== */

  const printInvoice =
    (
      sale
    ) => {
      const itemsHtml =
        (
          sale.items ||
          []
        )
          .map(
            (
              item
            ) => {
              const name =
                getItemName(
                  item
                );

              const typeLabel =
                getItemTypeLabel(
                  item
                );

              return `
                <tr>
                  <td style="padding:6px 8px;border-bottom:1px solid #ddd;">
                    ${name}
                    <div style="font-size:11px;color:#777;margin-top:3px;">
                      ${typeLabel}
                    </div>
                  </td>

                  <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">
                    ${number(
                      item.sizeMl
                    )} ml
                  </td>

                  <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">
                    ${number(
                      item.quantity
                    )}
                  </td>

                  <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">
                    ${money(
                      item.unitPrice
                    )}
                  </td>

                  <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">
                    ${money(
                      item.totalPrice
                    )}
                  </td>
                </tr>
              `;
            }
          )
          .join(
            ''
          );

      const totalAmount =
        number(
          sale.totalAmount
        );

      const logoUrl =
        `${window.location.origin}/logo.png`;

      const html =
        `
        <!DOCTYPE html>

        <html>
          <head>
            <meta charset="UTF-8">

            <title>
              Invoice ${sale.invoiceNo}
            </title>

            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                background: #fff;
              }

              .invoice-box {
                max-width: 800px;
                margin: auto;
                padding: 20px;
                border: 1px solid #eee;
              }

              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #b8860b;
                padding-bottom: 10px;
                margin-bottom: 20px;
              }

              .brand {
                display: flex;
                align-items: center;
                gap: 12px;
              }

              .brand img {
                height: 50px;
                width: auto;
              }

              .brand h1 {
                margin: 0;
                color: #b8860b;
                font-size: 24px;
              }

              .payment-status {
                padding: 4px 12px;
                border-radius: 20px;
                font-weight: bold;
              }

              .paid {
                background: #d4edda;
                color: #155724;
              }

              .due {
                background: #fff3cd;
                color: #856404;
              }

              .details {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
              }

              .details p {
                margin: 4px 0;
                font-size: 14px;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }

              th {
                background: #f5f5f5;
                text-align: left;
                padding: 8px;
                font-size: 14px;
              }

              td {
                font-size: 14px;
              }

              .total-row {
                font-weight: bold;
                font-size: 16px;
              }

              .total-row td {
                border-top: 2px solid #333;
              }

              .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #888;
              }

              @media print {
                body {
                  margin: 0;
                }

                .invoice-box {
                  border: none;
                }
              }
            </style>
          </head>

          <body>
            <div class="invoice-box">
              <div class="header">
                <div class="brand">
                  <img
                    src="${logoUrl}"
                    alt="Luxe Perfume"
                  />

                  <h1>
                    Luxe Perfume
                  </h1>
                </div>

                <span
                  class="payment-status ${
                    sale.paymentStatus ===
                    'paid'
                      ? 'paid'
                      : 'due'
                  }"
                >
                  ${String(
                    sale.paymentStatus
                  ).toUpperCase()}
                </span>
              </div>

              <div class="details">
                <div>
                  <p>
                    <strong>
                      Invoice:
                    </strong>
                    ${sale.invoiceNo}
                  </p>

                  <p>
                    <strong>
                      Date:
                    </strong>
                    ${new Date(
                      sale.saleDate
                    ).toLocaleDateString()}
                  </p>

                  <p>
                    <strong>
                      Channel:
                    </strong>
                    ${sale.channel}
                  </p>
                </div>

                <div>
                  ${
                    sale.notes
                      ? `
                        <p>
                          <strong>
                            Notes:
                          </strong>
                          ${sale.notes}
                        </p>
                      `
                      : ''
                  }
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>
                      Item
                    </th>

                    <th style="text-align:center;">
                      Size
                    </th>

                    <th style="text-align:center;">
                      Qty
                    </th>

                    <th style="text-align:right;">
                      Unit Price
                    </th>

                    <th style="text-align:right;">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${itemsHtml}

                  <tr class="total-row">
                    <td
                      colspan="4"
                      style="text-align:right;padding:8px;"
                    >
                      Grand Total
                    </td>

                    <td
                      style="text-align:right;padding:8px;"
                    >
                      ${money(
                        totalAmount
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="footer">
                <p>
                  Thank you for choosing Luxe Perfume!
                </p>

                <p>
                  Luxury captured in every drop.
                </p>
              </div>
            </div>

            <script>
              window.onload = function () {
                window.print();
              };
            </script>
          </body>
        </html>
      `;

      const printWindow =
        window.open(
          '',
          '_blank',
          'width=800,height=600'
        );

      if (
        !printWindow
      ) {
        toast.error(
          'Please allow popups to print the invoice.'
        );

        return;
      }

      printWindow.document.write(
        html
      );

      printWindow.document.close();

      printWindow.focus();
    };

  /* ========================================
     VIEW DETAILS
  ======================================== */

  const handleViewDetails =
    async (
      saleId
    ) => {
      setDetailsLoading(
        true
      );

      setShowDetailsModal(
        true
      );

      try {
        const {
          data: sale,
        } =
          await API.get(
            `/sales/${saleId}`
          );

        /*
          Backend now populates:
          items.product
          items.bottle

          No extra API requests required.
        */

        setSelectedSale(
          sale
        );
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data?.message ||
            'Failed to load sale details'
        );

        setShowDetailsModal(
          false
        );
      } finally {
        setDetailsLoading(
          false
        );
      }
    };

  /* ========================================
     PAYMENT STATUS
  ======================================== */

  const updatePaymentStatus =
    async (
      saleId,
      newStatus
    ) => {
      setUpdatingStatus(
        saleId
      );

      try {
        await API.patch(
          `/sales/${saleId}`,
          {
            paymentStatus:
              newStatus,
          }
        );

        setSales(
          (
            previous
          ) =>
            previous.map(
              (
                sale
              ) =>
                sale._id ===
                saleId
                  ? {
                      ...sale,

                      paymentStatus:
                        newStatus,
                    }
                  : sale
            )
        );

        toast.success(
          `Payment status updated to ${newStatus}`
        );
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data?.message ||
            'Failed to update payment status'
        );
      } finally {
        setUpdatingStatus(
          null
        );
      }
    };

  /* ========================================
     DELETE
  ======================================== */

  const handleDeleteClick =
    (
      sale
    ) => {
      setSaleToDelete(
        sale
      );

      setShowDeleteModal(
        true
      );
    };

  const handleDeleteConfirm =
    async () => {
      if (
        !saleToDelete
      ) {
        return;
      }

      setDeleting(
        true
      );

      try {
        await API.delete(
          `/sales/${saleToDelete._id}`
        );

        toast.success(
          'Sale deleted successfully'
        );

        setShowDeleteModal(
          false
        );

        setSaleToDelete(
          null
        );

        await fetchSales();
      } catch (
        error
      ) {
        toast.error(
          error.response
            ?.data?.message ||
            'Failed to delete sale'
        );
      } finally {
        setDeleting(
          false
        );
      }
    };

  /* ========================================
     RENDER
  ======================================== */

  return (
    <div>
      {/* HEADER */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">
          Sales
        </h1>

        <div className="flex gap-3">
          <Link
            to="/sales/new"
            className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-white transition hover:bg-brand-secondary"
          >
            <Plus
              size={
                18
              }
            />

            New Sale
          </Link>

          <button
            type="button"
            onClick={() =>
              setShowUploadModal(
                true
              )
            }
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
          >
            <Upload
              size={
                18
              }
            />

            Upload Sales
          </button>
        </div>
      </div>

      {/* FILTERS */}

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow-card dark:bg-gray-800">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium">
            Search
          </label>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={
                18
              }
            />

            <input
              type="text"
              placeholder="Invoice, channel, SKU or bottle..."
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
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-medium">
            Channel
          </label>

          <input
            type="text"
            list="channel-filter-suggestions"
            name="channel"
            value={
              filter.channel
            }
            onChange={
              handleFilterChange
            }
            placeholder="All or type"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          />

          <datalist id="channel-filter-suggestions">
            {channelSuggestions.map(
              (
                channel
              ) => (
                <option
                  key={
                    channel
                  }
                  value={
                    channel
                  }
                />
              )
            )}
          </datalist>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-medium">
            Payment
          </label>

          <select
            name="paymentStatus"
            value={
              filter.paymentStatus
            }
            onChange={
              handleFilterChange
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">
              All
            </option>

            {paymentStatusOptions.map(
              (
                status
              ) => (
                <option
                  key={
                    status
                  }
                  value={
                    status
                  }
                >
                  {status
                    .charAt(
                      0
                    )
                    .toUpperCase() +
                    status.slice(
                      1
                    )}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-[170px]">
          <label className="mb-1 block text-sm font-medium">
            Type
          </label>

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
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">
              All
            </option>

            {typeOptions.map(
              (
                option
              ) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setFilter({
              channel:
                '',

              paymentStatus:
                '',
            });

            setSearch(
              ''
            );

            setTypeFilter(
              ''
            );
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>

      {/* SALES TABLE */}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />

            <p>
              Loading sales...
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-card dark:bg-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Invoice
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Channel
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Total
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Payment
                </th>

                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>

                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  Expand
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedSales.map(
                (
                  sale
                ) => {
                  const isExpanded =
                    expandedRows[
                      sale.invoiceNo
                    ];

                  return (
                    <React.Fragment
                      key={
                        sale._id
                      }
                    >
                      <tr
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        onClick={() =>
                          toggleRow(
                            sale.invoiceNo
                          )
                        }
                      >
                        <td className="px-6 py-4 font-medium">
                          {
                            sale.invoiceNo
                          }
                        </td>

                        <td className="px-6 py-4">
                          {new Date(
                            sale.saleDate
                          ).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4">
                          {
                            sale.channel
                          }
                        </td>

                        <td className="px-6 py-4 font-semibold">
                          {money(
                            sale.totalAmount
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <select
                            value={
                              sale.paymentStatus
                            }
                            onChange={(
                              event
                            ) =>
                              updatePaymentStatus(
                                sale._id,
                                event
                                  .target
                                  .value
                              )
                            }
                            disabled={
                              updatingStatus ===
                              sale._id
                            }
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                            className={`cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-medium ${
                              sale.paymentStatus ===
                              'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            <option value="paid">
                              Paid
                            </option>

                            <option value="due">
                              Due
                            </option>
                          </select>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div
                            className="flex justify-center gap-2"
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDetails(
                                  sale._id
                                )
                              }
                              className="text-blue-600 hover:text-blue-800"
                              title="View Details"
                            >
                              <Eye
                                size={
                                  18
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                printInvoice(
                                  sale
                                )
                              }
                              className="text-green-600 hover:text-green-800"
                              title="Print Invoice"
                            >
                              <Printer
                                size={
                                  18
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteClick(
                                  sale
                                )
                              }
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2
                                size={
                                  18
                                }
                              />
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center">
                          {isExpanded ? (
                            <ChevronDown
                              size={
                                20
                              }
                            />
                          ) : (
                            <ChevronRight
                              size={
                                20
                              }
                            />
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED ITEMS */}

                      {isExpanded && (
                        <tr className="bg-gray-50 dark:bg-gray-800/60">
                          <td
                            colSpan={
                              7
                            }
                            className="px-6 py-4"
                          >
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                  <tr>
                                    <th className="px-4 py-2 text-left">
                                      Type
                                    </th>

                                    <th className="px-4 py-2 text-left">
                                      Item
                                    </th>

                                    <th className="px-4 py-2 text-left">
                                      Size
                                    </th>

                                    <th className="px-4 py-2 text-left">
                                      Qty
                                    </th>

                                    <th className="px-4 py-2 text-left">
                                      Unit Price
                                    </th>

                                    <th className="px-4 py-2 text-left">
                                      Total
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {(
                                    sale.items ||
                                    []
                                  ).map(
                                    (
                                      item,
                                      index
                                    ) => (
                                      <tr
                                        key={
                                          item._id ||
                                          index
                                        }
                                      >
                                        <td className="px-4 py-2">
                                          <span
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                              getItemType(
                                                item
                                              ) ===
                                              'bottle'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-blue-100 text-blue-700'
                                            }`}
                                          >
                                            {getItemTypeLabel(
                                              item
                                            )}
                                          </span>
                                        </td>

                                        <td className="px-4 py-2 font-medium">
                                          {getItemName(
                                            item
                                          )}
                                        </td>

                                        <td className="px-4 py-2">
                                          {
                                            item.sizeMl
                                          }{' '}
                                          ml
                                        </td>

                                        <td className="px-4 py-2">
                                          {
                                            item.quantity
                                          }
                                        </td>

                                        <td className="px-4 py-2">
                                          {money(
                                            item.unitPrice
                                          )}
                                        </td>

                                        <td className="px-4 py-2 font-semibold">
                                          {money(
                                            item.totalPrice
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  )}

                                  <tr className="bg-gray-100 font-bold dark:bg-gray-700">
                                    <td
                                      colSpan={
                                        5
                                      }
                                      className="px-4 py-2 text-right"
                                    >
                                      Grand Total
                                    </td>

                                    <td className="px-4 py-2">
                                      {money(
                                        sale.totalAmount
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }
              )}

              {filteredAndSortedSales.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      7
                    }
                    className="py-8 text-center text-gray-500"
                  >
                    No sales
                    found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DELETE MODAL */}

      {showDeleteModal &&
        saleToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
              <h2 className="mb-2 text-xl font-bold">
                Delete Sale
              </h2>

              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Delete{' '}
                <strong>
                  {
                    saleToDelete.invoiceNo
                  }
                </strong>
                ?
                <br />

                <span className="text-sm text-gray-500">
                  The deducted perfume materials and/or bottles will be restored.
                </span>
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={
                    handleDeleteConfirm
                  }
                  disabled={
                    deleting
                  }
                  className="flex-1 rounded-lg bg-red-600 py-2 text-white disabled:opacity-50"
                >
                  {deleting
                    ? 'Deleting...'
                    : 'Delete'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(
                      false
                    );

                    setSaleToDelete(
                      null
                    );
                  }}
                  className="flex-1 rounded-lg border py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      {/* UPLOAD MODAL */}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <button
              type="button"
              onClick={() => {
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
              className="absolute right-4 top-4 text-gray-400"
            >
              <X
                size={
                  24
                }
              />
            </button>

            <h2 className="mb-2 text-2xl font-bold">
              Bulk Upload Sales
            </h2>

            <p className="mb-4 text-sm text-gray-500">
              Bulk upload currently supports normal perfume/roll-on sales using SKU, Size and Price/Total.
              Bottle-only sales should be entered from New Sale.
            </p>

            <form
              onSubmit={
                handleUploadSubmit
              }
              className="space-y-4"
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={
                  handleFileChange
                }
                className="w-full rounded-lg border p-2"
                required
              />

              {uploadResult && (
                <div
                  className={`rounded-lg p-3 ${
                    uploadResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {uploadResult.success ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle
                        size={
                          20
                        }
                      />

                      <div>
                        <p className="font-medium">
                          {
                            uploadResult
                              .data
                              ?.message
                          }
                        </p>

                        <p className="text-sm">
                          Created:{' '}
                          {uploadResult
                            .data
                            ?.created
                            ?.length ||
                            0}
                        </p>

                        {uploadResult
                          .data
                          ?.errors
                          ?.length >
                          0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-sm">
                              View
                              errors (
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
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    •{' '}
                                    {
                                      item.error
                                    }
                                  </li>
                                )
                              )}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={
                          20
                        }
                      />

                      <span>
                        {
                          uploadResult.message
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={
                    uploading ||
                    !file
                  }
                  className="flex-1 rounded-lg bg-green-600 py-2 text-white disabled:opacity-50"
                >
                  {uploading
                    ? 'Uploading...'
                    : 'Upload'}
                </button>

                <button
                  type="button"
                  onClick={() => {
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
                  className="rounded-lg border px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}

      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-2xl font-bold">
                Sale Details
              </h2>

              <div className="flex gap-2">
                {selectedSale && (
                  <button
                    type="button"
                    onClick={() =>
                      printInvoice(
                        selectedSale
                      )
                    }
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white"
                  >
                    <Printer
                      size={
                        18
                      }
                    />

                    Print
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(
                      false
                    );

                    setSelectedSale(
                      null
                    );
                  }}
                  className="text-gray-400"
                >
                  <X
                    size={
                      24
                    }
                  />
                </button>
              </div>
            </div>

            {detailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
              </div>
            ) : selectedSale ? (
              <div>
                <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                  <div>
                    <p className="text-sm text-gray-500">
                      Invoice
                    </p>

                    <p className="font-semibold">
                      {
                        selectedSale.invoiceNo
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Date
                    </p>

                    <p className="font-semibold">
                      {new Date(
                        selectedSale.saleDate
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Channel
                    </p>

                    <p className="font-semibold">
                      {
                        selectedSale.channel
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Payment
                    </p>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        selectedSale.paymentStatus ===
                        'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {
                        selectedSale.paymentStatus
                      }
                    </span>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">
                      Total Amount
                    </p>

                    <p className="text-2xl font-bold text-brand-primary">
                      {money(
                        selectedSale.totalAmount
                      )}
                    </p>
                  </div>

                  {selectedSale.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">
                        Notes
                      </p>

                      <p className="text-sm">
                        {
                          selectedSale.notes
                        }
                      </p>
                    </div>
                  )}
                </div>

                <h3 className="mb-3 text-lg font-semibold">
                  Items
                </h3>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Type
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Item
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Description
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Size
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Qty
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Unit Price
                        </th>

                        <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(
                        selectedSale.items ||
                        []
                      ).map(
                        (
                          item,
                          index
                        ) => {
                          const itemType =
                            getItemType(
                              item
                            );

                          const description =
                            itemType ===
                            'bottle'
                              ? 'Empty bottle sold separately'
                              : item.product
                                  ?.description ||
                                '—';

                          return (
                            <tr
                              key={
                                item._id ||
                                index
                              }
                            >
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    itemType ===
                                    'bottle'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {getItemTypeLabel(
                                    item
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3 font-medium">
                                {getItemName(
                                  item
                                )}
                              </td>

                              <td className="max-w-xs truncate px-4 py-3">
                                {
                                  description
                                }
                              </td>

                              <td className="px-4 py-3">
                                {
                                  item.sizeMl
                                }{' '}
                                ml
                              </td>

                              <td className="px-4 py-3">
                                {
                                  item.quantity
                                }
                              </td>

                              <td className="px-4 py-3">
                                {money(
                                  item.unitPrice
                                )}
                              </td>

                              <td className="px-4 py-3 font-semibold">
                                {money(
                                  item.totalPrice
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}

                      <tr className="bg-gray-50 font-bold dark:bg-gray-700">
                        <td
                          colSpan={
                            6
                          }
                          className="px-4 py-3 text-right"
                        >
                          Grand Total
                        </td>

                        <td className="px-4 py-3">
                          {money(
                            selectedSale.totalAmount
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center">
                No data found.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesList;