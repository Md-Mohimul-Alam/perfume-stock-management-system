import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import API from '../../api/axios';

import {
  Plus,
  Trash2,
  AlertCircle,
  Printer,
  Package,
  SprayCan,
} from 'lucide-react';

import toast from 'react-hot-toast';

/* ========================================
   HELPERS
======================================== */

const number = (
  value
) => {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
};

const money = (
  value
) =>
  `৳${number(
    value
  ).toFixed(
    2
  )}`;

const getBottleName = (
  bottle
) => {
  if (!bottle) {
    return 'Bottle';
  }

  const type =
    bottle.type ===
    'roll-on'
      ? 'Roll-on'
      : 'Spray';

  return `${bottle.sizeMl}ml ${type} Bottle`;
};

/* ========================================
   PAGE
======================================== */

const NewSale = () => {
  const navigate =
    useNavigate();

  /* ======================================
     DATA
  ====================================== */

  const [
    products,
    setProducts,
  ] =
    useState([]);

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

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  /* ======================================
     SALE FORM
  ====================================== */

  const [
    form,
    setForm,
  ] =
    useState({
      channel:
        '',

      items:
        [],

      paymentStatus:
        'paid',

      saleDate:
        new Date()
          .toISOString()
          .split(
            'T'
          )[0],

      notes:
        '',
    });

  /* ======================================
     ITEM MODE
  ====================================== */

  const [
    itemType,
    setItemType,
  ] =
    useState(
      'product'
    );

  /* ======================================
     PRODUCT ITEM
  ====================================== */

  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    useState('');

  const [
    selectedSize,
    setSelectedSize,
  ] =
    useState('');

  /* ======================================
     BOTTLE ITEM
  ====================================== */

  const [
    selectedBottle,
    setSelectedBottle,
  ] =
    useState('');

  const [
    bottleTypeFilter,
    setBottleTypeFilter,
  ] =
    useState(
      'all'
    );

  /* ======================================
     SHARED ITEM FIELDS
  ====================================== */

  const [
    quantity,
    setQuantity,
  ] =
    useState(1);

  const [
    unitPrice,
    setUnitPrice,
  ] =
    useState('');

  /* ======================================
     CHANNELS
  ====================================== */

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

  /* ========================================
     LOAD PRODUCTS + BOTTLES
  ======================================== */

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData =
    async () => {
      setLoading(
        true
      );

      try {
        const [
          productResponse,
          bottleResponse,
        ] =
          await Promise.all([
            API.get(
              '/products'
            ),

            API.get(
              '/inventory/bottles/with-sales'
            ),
          ]);

        setProducts(
          Array.isArray(
            productResponse.data
          )
            ? productResponse.data
            : []
        );

        setBottles(
          Array.isArray(
            bottleResponse.data
          )
            ? bottleResponse.data
            : []
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        toast.error(
          error.response
            ?.data?.message ||
            'Failed to load sale data'
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  /* ========================================
     PRODUCT DEFAULT PRICE
  ======================================== */

  useEffect(() => {
    if (
      itemType !==
      'product'
    ) {
      return;
    }

    if (
      !selectedProduct ||
      !selectedSize
    ) {
      return;
    }

    const product =
      products.find(
        (
          item
        ) =>
          item._id ===
          selectedProduct
      );

    if (!product) {
      return;
    }

    const sizeVariant =
      product.sizes?.find(
        (
          size
        ) =>
          Number(
            size.sizeMl
          ) ===
          Number(
            selectedSize
          )
      );

    if (
      sizeVariant &&
      sizeVariant
        .sellingPrice !==
        undefined
    ) {
      setUnitPrice(
        String(
          sizeVariant.sellingPrice
        )
      );
    }
  }, [
    itemType,
    selectedProduct,
    selectedSize,
    products,
  ]);

  /* ========================================
     FILTERED BOTTLES
  ======================================== */

  const filteredBottles =
    useMemo(() => {
      return bottles
        .filter(
          (
            bottle
          ) => {
            if (
              bottleTypeFilter ===
              'all'
            ) {
              return true;
            }

            return (
              bottle.type ===
              bottleTypeFilter
            );
          }
        )
        .sort(
          (
            a,
            b
          ) => {
            if (
              a.type !==
              b.type
            ) {
              return String(
                a.type
              ).localeCompare(
                String(
                  b.type
                )
              );
            }

            return (
              number(
                a.sizeMl
              ) -
              number(
                b.sizeMl
              )
            );
          }
        );
    }, [
      bottles,
      bottleTypeFilter,
    ]);

  const selectedBottleData =
    bottles.find(
      (
        bottle
      ) =>
        bottle._id ===
        selectedBottle
    );

  /* ========================================
     CHANGE ITEM TYPE
  ======================================== */

  const handleItemTypeChange =
    (
      type
    ) => {
      setItemType(
        type
      );

      setSelectedProduct(
        ''
      );

      setSelectedSize(
        ''
      );

      setSelectedBottle(
        ''
      );

      setBottleTypeFilter(
        'all'
      );

      setQuantity(
        1
      );

      setUnitPrice(
        ''
      );
    };

  /* ========================================
     ADD ITEM
  ======================================== */

  const handleAddItem =
    () => {
      setError(
        ''
      );

      const qty =
        Number(
          quantity
        );

      const price =
        Number(
          unitPrice
        );

      if (
        !Number.isInteger(
          qty
        ) ||
        qty <= 0
      ) {
        toast.error(
          'Quantity must be a positive whole number'
        );

        return;
      }

      if (
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        toast.error(
          'Please enter a valid unit price'
        );

        return;
      }

      /* ==================================
         PERFUME PRODUCT
      ================================== */

      if (
        itemType ===
        'product'
      ) {
        if (
          !selectedProduct ||
          !selectedSize
        ) {
          toast.error(
            'Please select product and size'
          );

          return;
        }

        const product =
          products.find(
            (
              item
            ) =>
              item._id ===
              selectedProduct
          );

        if (!product) {
          toast.error(
            'Product not found'
          );

          return;
        }

        const sizeVariant =
          product.sizes?.find(
            (
              size
            ) =>
              Number(
                size.sizeMl
              ) ===
              Number(
                selectedSize
              )
          );

        if (
          !sizeVariant
        ) {
          toast.error(
            'Size not found for this product'
          );

          return;
        }

        const sizeMl =
          Number(
            selectedSize
          );

        const existing =
          form.items.find(
            (
              item
            ) =>
              item.itemType ===
                'product' &&
              item.product ===
                selectedProduct &&
              Number(
                item.sizeMl
              ) ===
                sizeMl
          );

        if (existing) {
          toast.error(
            'This perfume and size is already added'
          );

          return;
        }

        const newItem =
          {
            itemType:
              'product',

            product:
              selectedProduct,

            bottle:
              null,

            productName:
              product.name,

            displayName:
              product.name,

            sizeMl,

            quantity:
              qty,

            unitPrice:
              price,

            originalUnitPrice:
              number(
                sizeVariant.sellingPrice
              ),

            totalPrice:
              qty *
              price,
          };

        setForm(
          (
            previous
          ) => ({
            ...previous,

            items: [
              ...previous.items,
              newItem,
            ],
          })
        );

        setSelectedProduct(
          ''
        );

        setSelectedSize(
          ''
        );

        setQuantity(
          1
        );

        setUnitPrice(
          ''
        );

        return;
      }

      /* ==================================
         BOTTLE-ONLY SALE
      ================================== */

      if (
        !selectedBottle
      ) {
        toast.error(
          'Please select a bottle'
        );

        return;
      }

      const bottle =
        bottles.find(
          (
            item
          ) =>
            item._id ===
            selectedBottle
        );

      if (!bottle) {
        toast.error(
          'Bottle not found'
        );

        return;
      }

      const available =
        number(
          bottle.currentStock
        );

      if (
        available <= 0
      ) {
        toast.error(
          'This bottle is out of stock'
        );

        return;
      }

      if (
        qty >
        available
      ) {
        toast.error(
          `Only ${available} bottle(s) available`
        );

        return;
      }

      const existing =
        form.items.find(
          (
            item
          ) =>
            item.itemType ===
              'bottle' &&
            item.bottle ===
              bottle._id
        );

      if (existing) {
        toast.error(
          'This bottle is already added'
        );

        return;
      }

      const newItem =
        {
          itemType:
            'bottle',

          product:
            null,

          bottle:
            bottle._id,

          bottleType:
            bottle.type,

          displayName:
            getBottleName(
              bottle
            ),

          sizeMl:
            number(
              bottle.sizeMl
            ),

          quantity:
            qty,

          unitPrice:
            price,

          totalPrice:
            qty *
            price,

          availableStock:
            available,
        };

      setForm(
        (
          previous
        ) => ({
          ...previous,

          items: [
            ...previous.items,
            newItem,
          ],
        })
      );

      setSelectedBottle(
        ''
      );

      setQuantity(
        1
      );

      setUnitPrice(
        ''
      );
    };

  /* ========================================
     REMOVE ITEM
  ======================================== */

  const removeItem =
    (
      index
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          items:
            previous.items.filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !==
                index
            ),
        })
      );
    };

  /* ========================================
     TOTAL
  ======================================== */

  const totalAmount =
    useMemo(
      () =>
        form.items.reduce(
          (
            total,
            item
          ) =>
            total +
            number(
              item.totalPrice
            ),
          0
        ),
      [
        form.items,
      ]
    );

  /* ========================================
     PRINT INVOICE
  ======================================== */

  const printInvoice =
    (
      sale
    ) => {
      const itemsHtml =
        sale.items
          .map(
            (
              item
            ) => {
              const name =
                item.displayName ||
                item.productName ||
                'Item';

              const itemLabel =
                item.itemType ===
                'bottle'
                  ? 'Bottle Only'
                  : 'Perfume';

              return `
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #ddd;">
                    ${name}
                    <div style="font-size:11px;color:#777;margin-top:3px;">
                      ${itemLabel}
                    </div>
                  </td>

                  <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">
                    ${item.sizeMl} ml
                  </td>

                  <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">
                    ${item.quantity}
                  </td>

                  <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">
                    ৳${number(
                      item.unitPrice
                    ).toFixed(
                      2
                    )}
                  </td>

                  <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">
                    ৳${number(
                      item.totalPrice
                    ).toFixed(
                      2
                    )}
                  </td>
                </tr>
              `;
            }
          )
          .join(
            ''
          );

      const total =
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
                object-fit: contain;
              }

              .brand h1 {
                margin: 0;
                color: #b8860b;
                font-size: 24px;
              }

              .payment-status {
                display: inline-block;
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
                      ৳${total.toFixed(
                        2
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
     SUBMIT SALE
  ======================================== */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        form.items.length ===
        0
      ) {
        setError(
          'At least one item is required'
        );

        return;
      }

      if (
        !form.channel.trim()
      ) {
        setError(
          'Please enter a channel'
        );

        return;
      }

      setSubmitting(
        true
      );

      setError(
        ''
      );

      try {
        const payload =
          {
            channel:
              form.channel.trim(),

            paymentStatus:
              form.paymentStatus,

            saleDate:
              new Date(
                form.saleDate
              ).toISOString(),

            notes:
              form.notes.trim(),

            items:
              form.items.map(
                (
                  item
                ) => {
                  if (
                    item.itemType ===
                    'bottle'
                  ) {
                    return {
                      itemType:
                        'bottle',

                      bottle:
                        item.bottle,

                      sizeMl:
                        item.sizeMl,

                      quantity:
                        item.quantity,

                      unitPrice:
                        item.unitPrice,
                    };
                  }

                  return {
                    itemType:
                      'product',

                    product:
                      item.product,

                    sizeMl:
                      item.sizeMl,

                    quantity:
                      item.quantity,

                    unitPrice:
                      item.unitPrice,
                  };
                }
              ),
          };

        const response =
          await API.post(
            '/sales',
            payload
          );

        const createdSale =
          response.data;

        const printData =
          {
            invoiceNo:
              createdSale.invoiceNo,

            saleDate:
              createdSale.saleDate,

            channel:
              createdSale.channel,

            paymentStatus:
              createdSale.paymentStatus,

            notes:
              createdSale.notes,

            items:
              form.items,

            totalAmount:
              createdSale.totalAmount,
          };

        printInvoice(
          printData
        );

        toast.success(
          'Sale created successfully!'
        );

        setTimeout(
          () => {
            navigate(
              '/sales'
            );
          },
          1500
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setError(
          error.response
            ?.data
            ?.message ||
            'Failed to create sale'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  /* ========================================
     LOADING
  ======================================== */

  if (
    loading
  ) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  /* ========================================
     RENDER
  ======================================== */

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">
        New Sale
      </h1>

      <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-gray-800 dark:shadow-gray-900/30">
        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-6"
        >
          {/* ERROR */}

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              <AlertCircle
                size={
                  20
                }
                className="mt-0.5 flex-shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="mb-1 font-semibold">
                  Cannot create sale
                </p>

                <p className="break-words whitespace-pre-wrap">
                  {
                    error
                  }
                </p>
              </div>
            </div>
          )}

          {/* SALE INFO */}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel *
              </label>

              <input
                type="text"
                list="channel-suggestions"
                value={
                  form.channel
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      channel:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Type or select channel"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-secondary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              />

              <datalist id="channel-suggestions">
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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sale Date
              </label>

              <input
                type="date"
                value={
                  form.saleDate
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      saleDate:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-secondary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Status
              </label>

              <select
                value={
                  form.paymentStatus
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      paymentStatus:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-secondary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="paid">
                  Paid
                </option>

                <option value="due">
                  Due
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>

              <input
                type="text"
                value={
                  form.notes
                }
                onChange={(
                  event
                ) =>
                  setForm(
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
                placeholder="Optional notes"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-secondary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* ITEM TYPE */}

          <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
              What are you selling?
            </h3>

            <div className="grid max-w-xl grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  handleItemTypeChange(
                    'product'
                  )
                }
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
                  itemType ===
                  'product'
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                <SprayCan
                  size={
                    19
                  }
                />

                Perfume
              </button>

              <button
                type="button"
                onClick={() =>
                  handleItemTypeChange(
                    'bottle'
                  )
                }
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
                  itemType ===
                  'bottle'
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                <Package
                  size={
                    19
                  }
                />

                Bottle Only
              </button>
            </div>
          </div>

          {/* PRODUCT FORM */}

          {itemType ===
            'product' && (
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Add Perfume
                </h3>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The perfume bottle is included free. Bottle stock will automatically decrease.
                </p>
              </div>

              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Product
                  </label>

                  <select
                    value={
                      selectedProduct
                    }
                    onChange={(
                      event
                    ) => {
                      setSelectedProduct(
                        event
                          .target
                          .value
                      );

                      setSelectedSize(
                        ''
                      );

                      setUnitPrice(
                        ''
                      );
                    }}
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">
                      Select product
                    </option>

                    {products
                      .filter(
                        (
                          product
                        ) =>
                          product.isActive !==
                          false
                      )
                      .map(
                        (
                          product
                        ) => (
                          <option
                            key={
                              product._id
                            }
                            value={
                              product._id
                            }
                          >
                            {
                              product.name
                            }{' '}
                            ({
                              product.sku
                            })
                          </option>
                        )
                      )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Size
                  </label>

                  <select
                    value={
                      selectedSize
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedSize(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      !selectedProduct
                    }
                    className="w-full rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">
                      Select size
                    </option>

                    {selectedProduct &&
                      products
                        .find(
                          (
                            product
                          ) =>
                            product._id ===
                            selectedProduct
                        )
                        ?.sizes?.map(
                          (
                            size
                          ) => (
                            <option
                              key={
                                size.sizeMl
                              }
                              value={
                                size.sizeMl
                              }
                            >
                              {
                                size.sizeMl
                              }{' '}
                              ml
                            </option>
                          )
                        )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      quantity
                    }
                    onChange={(
                      event
                    ) =>
                      setQuantity(
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Perfume Price (৳)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      unitPrice
                    }
                    onChange={(
                      event
                    ) =>
                      setUnitPrice(
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <button
                  type="button"
                  onClick={
                    handleAddItem
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary py-2 text-white transition hover:bg-brand-secondary"
                >
                  <Plus
                    size={
                      18
                    }
                  />

                  Add
                </button>
              </div>
            </div>
          )}

          {/* BOTTLE-ONLY FORM */}

          {itemType ===
            'bottle' && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900 dark:bg-purple-950/20">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Sell Empty Bottle
                </h3>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Use this only when the customer is buying an empty bottle separately.
                </p>
              </div>

              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Bottle Type
                  </label>

                  <select
                    value={
                      bottleTypeFilter
                    }
                    onChange={(
                      event
                    ) => {
                      setBottleTypeFilter(
                        event
                          .target
                          .value
                      );

                      setSelectedBottle(
                        ''
                      );
                    }}
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="all">
                      All
                    </option>

                    <option value="roll-on">
                      Roll-on / Oil
                    </option>

                    <option value="spray">
                      Spray
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Bottle
                  </label>

                  <select
                    value={
                      selectedBottle
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedBottle(
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">
                      Select bottle
                    </option>

                    {filteredBottles.map(
                      (
                        bottle
                      ) => (
                        <option
                          key={
                            bottle._id
                          }
                          value={
                            bottle._id
                          }
                          disabled={
                            number(
                              bottle.currentStock
                            ) <=
                            0
                          }
                        >
                          {getBottleName(
                            bottle
                          )}{' '}
                          — Stock:{' '}
                          {number(
                            bottle.currentStock
                          )}
                        </option>
                      )
                    )}
                  </select>

                  {selectedBottleData && (
                    <p
                      className={`mt-1 text-xs ${
                        number(
                          selectedBottleData.currentStock
                        ) <=
                        3
                          ? 'text-orange-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      Available:{' '}
                      <strong>
                        {number(
                          selectedBottleData.currentStock
                        )}{' '}
                        pcs
                      </strong>
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    max={
                      selectedBottleData
                        ? number(
                            selectedBottleData.currentStock
                          )
                        : undefined
                    }
                    step="1"
                    value={
                      quantity
                    }
                    onChange={(
                      event
                    ) =>
                      setQuantity(
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Bottle Selling Price (৳)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      unitPrice
                    }
                    onChange={(
                      event
                    ) =>
                      setUnitPrice(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Price per bottle"
                    className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <button
                  type="button"
                  onClick={
                    handleAddItem
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2 text-white transition hover:bg-purple-700"
                >
                  <Plus
                    size={
                      18
                    }
                  />

                  Add
                </button>
              </div>
            </div>
          )}

          {/* ITEMS */}

          {form.items.length >
            0 && (
            <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
              <h3 className="mb-4 text-lg font-semibold">
                Items
              </h3>

              <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
                <table className="min-w-[800px] w-full">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Type
                      </th>

                      <th className="px-4 py-3 text-left">
                        Item
                      </th>

                      <th className="px-4 py-3 text-right">
                        Size
                      </th>

                      <th className="px-4 py-3 text-right">
                        Qty
                      </th>

                      <th className="px-4 py-3 text-right">
                        Unit Price
                      </th>

                      <th className="px-4 py-3 text-right">
                        Total
                      </th>

                      <th className="px-4 py-3 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y dark:divide-gray-700">
                    {form.items.map(
                      (
                        item,
                        index
                      ) => (
                        <tr
                          key={`${item.itemType}-${item.product || item.bottle}-${index}`}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                item.itemType ===
                                'bottle'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              }`}
                            >
                              {item.itemType ===
                              'bottle'
                                ? 'Bottle Only'
                                : 'Perfume'}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {
                              item.displayName
                            }
                          </td>

                          <td className="px-4 py-3 text-right">
                            {
                              item.sizeMl
                            }{' '}
                            ml
                          </td>

                          <td className="px-4 py-3 text-right">
                            {
                              item.quantity
                            }
                          </td>

                          <td className="px-4 py-3 text-right">
                            {money(
                              item.unitPrice
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {money(
                              item.totalPrice
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  index
                                )
                              }
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              <Trash2
                                size={
                                  18
                                }
                              />
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot className="bg-gray-50 font-bold dark:bg-gray-800">
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                        className="px-4 py-3 text-right"
                      >
                        Grand Total
                      </td>

                      <td className="px-4 py-3 text-right">
                        {money(
                          totalAmount
                        )}
                      </td>

                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ACTIONS */}

          <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="submit"
              disabled={
                submitting
              }
              className="rounded-lg bg-brand-primary px-6 py-2 text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {submitting
                ? 'Creating...'
                : 'Create Sale'}
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/sales'
                )
              }
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewSale;