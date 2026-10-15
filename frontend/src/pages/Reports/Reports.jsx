import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import toast from 'react-hot-toast';

import {
  BarChart3,
  Building2,
  DollarSign,
  Download,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

import API from '../../api/axios';

/* ========================================
   HELPERS
======================================== */

const toNumber = (
  value
) => {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
};

const formatCurrency = (
  amount
) => {
  return `৳${toNumber(
    amount
  ).toFixed(2)}`;
};

const formatNumber = (
  value
) => {
  return toNumber(
    value
  ).toLocaleString();
};

/* ========================================
   REPORTS
======================================== */

const Reports =
  () => {
    const [
      activeTab,
      setActiveTab,
    ] = useState(
      'overview'
    );

    const [
      loading,
      setLoading,
    ] = useState(
      true
    );

    const [
      refreshing,
      setRefreshing,
    ] = useState(
      false
    );

    const [
      dateRange,
      setDateRange,
    ] = useState({
      start:
        new Date(
          new Date().setDate(
            1
          )
        )
          .toISOString()
          .split(
            'T'
          )[0],

      end:
        new Date()
          .toISOString()
          .split(
            'T'
          )[0],
    });

    /* ======================================
       REPORT DATA
    ====================================== */

    const [
      stockReport,
      setStockReport,
    ] = useState(
      null
    );

    const [
      salesReport,
      setSalesReport,
    ] = useState(
      null
    );

    const [
      profitReport,
      setProfitReport,
    ] = useState(
      null
    );

    const [
      investorProfit,
      setInvestorProfit,
    ] = useState(
      null
    );

    const [
      availableCash,
      setAvailableCash,
    ] = useState(
      0
    );

    /* ======================================
       TAB LOADING
    ====================================== */

    const [
      loadingStock,
      setLoadingStock,
    ] = useState(
      false
    );

    const [
      loadingSales,
      setLoadingSales,
    ] = useState(
      false
    );

    const [
      loadingProfit,
      setLoadingProfit,
    ] = useState(
      false
    );

    const [
      loadingInvestor,
      setLoadingInvestor,
    ] = useState(
      false
    );

    /* ======================================
       API
    ====================================== */

    const fetchStockReport =
      async () => {
        setLoadingStock(
          true
        );

        try {
          const {
            data,
          } =
            await API.get(
              '/reports/stock'
            );

          setStockReport(
            data
          );
        } catch (
          error
        ) {
          console.error(
            'Stock report error:',
            error
          );
        } finally {
          setLoadingStock(
            false
          );
        }
      };

    const fetchSalesReport =
      async () => {
        setLoadingSales(
          true
        );

        try {
          const params =
            new URLSearchParams();

          if (
            dateRange.start
          ) {
            params.append(
              'startDate',
              dateRange.start
            );
          }

          if (
            dateRange.end
          ) {
            params.append(
              'endDate',
              dateRange.end
            );
          }

          const {
            data,
          } =
            await API.get(
              `/reports/sales?${params.toString()}`
            );

          setSalesReport(
            data
          );
        } catch (
          error
        ) {
          console.error(
            'Sales report error:',
            error
          );
        } finally {
          setLoadingSales(
            false
          );
        }
      };

    const fetchProfitReport =
      async () => {
        setLoadingProfit(
          true
        );

        try {
          const params =
            new URLSearchParams();

          if (
            dateRange.start
          ) {
            params.append(
              'startDate',
              dateRange.start
            );
          }

          if (
            dateRange.end
          ) {
            params.append(
              'endDate',
              dateRange.end
            );
          }

          const {
            data,
          } =
            await API.get(
              `/reports/profit?${params.toString()}`
            );

          setProfitReport(
            data
          );
        } catch (
          error
        ) {
          console.error(
            'Profit report error:',
            error
          );
        } finally {
          setLoadingProfit(
            false
          );
        }
      };

    const fetchInvestorReport =
      async () => {
        setLoadingInvestor(
          true
        );

        try {
          const params =
            new URLSearchParams();

          if (
            dateRange.start
          ) {
            params.append(
              'startDate',
              dateRange.start
            );
          }

          if (
            dateRange.end
          ) {
            params.append(
              'endDate',
              dateRange.end
            );
          }

          const {
            data,
          } =
            await API.get(
              `/reports/investor-profit?${params.toString()}`
            );

          setInvestorProfit(
            data
          );
        } catch (
          error
        ) {
          console.error(
            'Investor report error:',
            error
          );
        } finally {
          setLoadingInvestor(
            false
          );
        }
      };

    const fetchAvailableCash =
      async () => {
        try {
          const {
            data,
          } =
            await API.get(
              '/reports/available-cash'
            );

          setAvailableCash(
            toNumber(
              data?.availableCash
            )
          );
        } catch (
          error
        ) {
          console.error(
            'Available cash error:',
            error
          );

          setAvailableCash(
            0
          );
        }
      };

    const fetchAllReports =
      async () => {
        setLoading(
          true
        );

        try {
          await Promise.all([
            fetchStockReport(),
            fetchSalesReport(),
            fetchProfitReport(),
            fetchInvestorReport(),
            fetchAvailableCash(),
          ]);
        } finally {
          setLoading(
            false
          );
        }
      };

    /* ======================================
       INITIAL LOAD
    ====================================== */

    useEffect(() => {
      fetchAllReports();

      // Initial load only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ======================================
       REFRESH
    ====================================== */

    const refreshData =
      async () => {
        setRefreshing(
          true
        );

        try {
          await fetchAllReports();

          toast.success(
            'Reports refreshed'
          );
        } finally {
          setRefreshing(
            false
          );
        }
      };

    /* ======================================
       APPLY DATE RANGE
    ====================================== */

    const handleDateChange =
      async () => {
        if (
          dateRange.start &&
          dateRange.end &&
          new Date(
            dateRange.start
          ) >
            new Date(
              dateRange.end
            )
        ) {
          toast.error(
            'From date cannot be after To date'
          );

          return;
        }

        await Promise.all([
          fetchSalesReport(),
          fetchProfitReport(),
          fetchInvestorReport(),
        ]);

        toast.success(
          'Reports updated with new date range'
        );
      };

    /* ======================================
       TABS
    ====================================== */

    const tabs = [
      {
        id:
          'overview',

        label:
          'Overview',

        icon:
          BarChart3,
      },

      {
        id:
          'stock',

        label:
          'Stock',

        icon:
          Package,
      },

      {
        id:
          'sales',

        label:
          'Sales',

        icon:
          ShoppingBag,
      },

      {
        id:
          'profit',

        label:
          'Profit & Loss',

        icon:
          TrendingUp,
      },

      {
        id:
          'investors',

        label:
          'Investors',

        icon:
          Users,
      },
    ];

    /* ======================================
       CALCULATED VALUES
    ====================================== */

    const inventoryValue =
      toNumber(
        stockReport
          ?.summary
          ?.totalInventoryValue
      );

    /*
      IMPORTANT:

      Total Business Value =
      Available Cash
      +
      Current Inventory Value

      The old code incorrectly used:

      Net Profit + Inventory
    */

    const totalBusinessValue =
      availableCash +
      inventoryValue;

    /* ======================================
       INITIAL LOADING
    ====================================== */

    if (
      loading
    ) {
      return (
        <div
          className="
            flex
            h-96
            items-center
            justify-center
          "
        >
          <div
            className="
              flex
              flex-col
              items-center
              gap-4
            "
          >
            <Loader2
              className="
                h-12
                w-12
                animate-spin
                text-amber-500
              "
            />

            <p
              className="
                text-gray-500

                dark:text-gray-400
              "
            >
              Loading reports...
            </p>
          </div>
        </div>
      );
    }

    /* ======================================
       UI
    ====================================== */

    return (
      <div
        className="
          mx-auto
          max-w-7xl

          p-4

          sm:p-6
        "
      >
        {/* ==================================
            HEADER
        ================================== */}

        <div
          className="
            mb-6

            flex
            flex-col

            gap-4

            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <h1
              className="
                text-2xl
                font-bold

                text-gray-800

                dark:text-gray-100

                sm:text-3xl
              "
            >
              Reports
            </h1>

            <p
              className="
                mt-1

                text-sm

                text-gray-500

                dark:text-gray-400
              "
            >
              Comprehensive business analytics
            </p>
          </div>

          <div
            className="
              flex
              flex-wrap
              gap-3
            "
          >
            <button
              type="button"
              onClick={
                refreshData
              }
              disabled={
                refreshing
              }
              className="
                flex
                min-h-[42px]
                items-center
                gap-2

                rounded-lg

                bg-gray-100

                px-4
                py-2

                text-gray-700

                transition

                hover:bg-gray-200

                disabled:cursor-not-allowed
                disabled:opacity-50

                dark:bg-slate-700
                dark:text-gray-200
                dark:hover:bg-slate-600
              "
            >
              <RefreshCw
                size={
                  18
                }
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh
            </button>

            {/*
              Export UI is kept visible.

              There is currently no export
              implementation attached to
              this button.
            */}

            <button
              type="button"
              className="
                flex
                min-h-[42px]
                items-center
                gap-2

                rounded-lg

                bg-amber-600

                px-4
                py-2

                text-white

                transition

                hover:bg-amber-700
              "
            >
              <Download
                size={
                  18
                }
              />

              Export
            </button>
          </div>
        </div>

        {/* ==================================
            DATE FILTER
        ================================== */}

        <div
          className="
            mb-6

            flex
            flex-col

            gap-4

            rounded-2xl

            border
            border-gray-200

            bg-white

            p-4

            shadow-sm

            dark:border-slate-700
            dark:bg-slate-800

            sm:flex-row
            sm:flex-wrap
            sm:items-end
          "
        >
          <div
            className="
              flex-1

              sm:min-w-[180px]
            "
          >
            <label
              className="
                mb-1
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              From
            </label>

            <input
              type="date"
              value={
                dateRange.start
              }
              onChange={(
                event
              ) =>
                setDateRange(
                  (
                    previous
                  ) => ({
                    ...previous,

                    start:
                      event.target
                        .value,
                  })
                )
              }
              className="
                w-full

                rounded-lg

                border
                border-gray-300

                bg-white

                px-4
                py-2

                text-[16px]

                outline-none

                focus:ring-2
                focus:ring-amber-500

                dark:border-slate-600
                dark:bg-slate-900
                dark:text-white
              "
            />
          </div>

          <div
            className="
              flex-1

              sm:min-w-[180px]
            "
          >
            <label
              className="
                mb-1
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              To
            </label>

            <input
              type="date"
              value={
                dateRange.end
              }
              onChange={(
                event
              ) =>
                setDateRange(
                  (
                    previous
                  ) => ({
                    ...previous,

                    end:
                      event.target
                        .value,
                  })
                )
              }
              className="
                w-full

                rounded-lg

                border
                border-gray-300

                bg-white

                px-4
                py-2

                text-[16px]

                outline-none

                focus:ring-2
                focus:ring-amber-500

                dark:border-slate-600
                dark:bg-slate-900
                dark:text-white
              "
            />
          </div>

          <button
            type="button"
            onClick={
              handleDateChange
            }
            className="
              min-h-[42px]

              rounded-lg

              bg-amber-600

              px-6
              py-2

              font-medium

              text-white

              transition

              hover:bg-amber-700
            "
          >
            Apply
          </button>
        </div>

        {/* ==================================
            TABS
        ================================== */}

        <div
          className="
            mb-6

            overflow-x-auto

            border-b
            border-gray-200

            dark:border-slate-700
          "
        >
          <div
            className="
              flex
              min-w-max
              gap-1
            "
          >
            {tabs.map(
              (
                tab
              ) => {
                const Icon =
                  tab.icon;

                return (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                    className={`
                      flex
                      min-h-[44px]
                      items-center
                      gap-2

                      whitespace-nowrap

                      border-b-2

                      px-4
                      py-3

                      font-medium

                      transition-all
                      duration-200

                      ${
                        activeTab ===
                        tab.id
                          ? `
                            border-amber-600
                            text-amber-600
                          `
                          : `
                            border-transparent
                            text-gray-500

                            hover:text-gray-700

                            dark:text-gray-400
                            dark:hover:text-gray-200
                          `
                      }
                    `}
                  >
                    <Icon
                      size={
                        18
                      }
                    />

                    {
                      tab.label
                    }
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ==================================
            CONTENT
        ================================== */}

        <div
          className="
            space-y-6
          "
        >
          {/* ==================================
              OVERVIEW
          ================================== */}

          {activeTab ===
            'overview' && (
            <>
              <div
                className="
                  grid
                  grid-cols-1

                  gap-4

                  sm:grid-cols-2
                  xl:grid-cols-4
                "
              >
                {/* Available Cash */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-4

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <div
                    className="
                      mb-1

                      flex
                      items-center
                      justify-between
                      gap-2
                    "
                  >
                    <p
                      className="
                        text-xs
                        uppercase
                        tracking-wider

                        text-gray-500

                        dark:text-gray-400
                      "
                    >
                      Available Cash
                    </p>

                    <DollarSign
                      size={
                        18
                      }
                      className="
                        text-emerald-600
                      "
                    />
                  </div>

                  <p
                    className="
                      break-words

                      text-2xl
                      font-bold

                      text-emerald-600
                    "
                  >
                    {formatCurrency(
                      availableCash
                    )}
                  </p>
                </div>

                {/* Inventory */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-4

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <div
                    className="
                      mb-1

                      flex
                      items-center
                      justify-between
                      gap-2
                    "
                  >
                    <p
                      className="
                        text-xs
                        uppercase
                        tracking-wider

                        text-gray-500

                        dark:text-gray-400
                      "
                    >
                      Total Inventory Value
                    </p>

                    <Package
                      size={
                        18
                      }
                      className="
                        text-blue-600
                      "
                    />
                  </div>

                  <p
                    className="
                      break-words

                      text-2xl
                      font-bold

                      text-blue-600
                    "
                  >
                    {stockReport
                      ? formatCurrency(
                          inventoryValue
                        )
                      : '—'}
                  </p>
                </div>

                {/* Revenue */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-4

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <div
                    className="
                      mb-1

                      flex
                      items-center
                      justify-between
                      gap-2
                    "
                  >
                    <p
                      className="
                        text-xs
                        uppercase
                        tracking-wider

                        text-gray-500

                        dark:text-gray-400
                      "
                    >
                      Total Revenue
                    </p>

                    <TrendingUp
                      size={
                        18
                      }
                      className="
                        text-purple-600
                      "
                    />
                  </div>

                  <p
                    className="
                      break-words

                      text-2xl
                      font-bold

                      text-purple-600
                    "
                  >
                    {profitReport
                      ? formatCurrency(
                          profitReport
                            .totalRevenue
                        )
                      : '—'}
                  </p>
                </div>

                {/* Net Profit */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-4

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <div
                    className="
                      mb-1

                      flex
                      items-center
                      justify-between
                      gap-2
                    "
                  >
                    <p
                      className="
                        text-xs
                        uppercase
                        tracking-wider

                        text-gray-500

                        dark:text-gray-400
                      "
                    >
                      Net Profit
                    </p>

                    <TrendingUp
                      size={
                        18
                      }
                      className="
                        text-amber-600
                      "
                    />
                  </div>

                  <p
                    className={`
                      break-words

                      text-2xl
                      font-bold

                      ${
                        toNumber(
                          profitReport
                            ?.netProfit
                        ) >= 0
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }
                    `}
                  >
                    {profitReport
                      ? formatCurrency(
                          profitReport
                            .netProfit
                        )
                      : '—'}
                  </p>
                </div>
              </div>

              {/* ==================================
                  BUSINESS VALUE
              ================================== */}

              <div
                className="
                  rounded-2xl

                  border
                  border-amber-200

                  bg-gradient-to-r
                  from-amber-50
                  to-orange-50

                  p-5

                  dark:border-amber-900/50
                  dark:from-amber-950/30
                  dark:to-orange-950/20

                  sm:p-6
                "
              >
                <div
                  className="
                    flex
                    flex-col

                    gap-4

                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm

                        text-gray-600

                        dark:text-gray-300
                      "
                    >
                      Total Business Value
                    </p>

                    <p
                      className="
                        mt-1

                        break-words

                        text-2xl
                        font-bold

                        text-amber-700

                        dark:text-amber-400

                        sm:text-3xl
                      "
                    >
                      {stockReport
                        ? formatCurrency(
                            totalBusinessValue
                          )
                        : '—'}
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      items-center
                      gap-2

                      text-sm

                      text-gray-500

                      dark:text-gray-400
                    "
                  >
                    <Building2
                      size={
                        18
                      }
                    />

                    <span>
                      Available Cash + Inventory
                    </span>
                  </div>
                </div>
              </div>

              {/* ==================================
                  QUICK SUMMARY
              ================================== */}

              <div
                className="
                  grid
                  grid-cols-1

                  gap-6

                  lg:grid-cols-2
                "
              >
                {/* Sales */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-5

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <h3
                    className="
                      mb-4

                      flex
                      items-center
                      gap-2

                      text-sm
                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    <ShoppingBag
                      size={
                        16
                      }
                      className="
                        text-amber-600
                      "
                    />

                    Sales Summary
                  </h3>

                  {profitReport ? (
                    <div
                      className="
                        space-y-2
                      "
                    >
                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          border-b
                          border-gray-100

                          py-2

                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Revenue
                        </span>

                        <span
                          className="
                            text-right
                            font-semibold

                            dark:text-gray-100
                          "
                        >
                          {formatCurrency(
                            profitReport
                              .totalRevenue
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          border-b
                          border-gray-100

                          py-2

                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Total Sales
                        </span>

                        <span
                          className="
                            font-semibold

                            dark:text-gray-100
                          "
                        >
                          {formatNumber(
                            salesReport
                              ?.sales
                              ?.length ||
                              0
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          py-2
                        "
                      >
                        <span
                          className="
                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Total Units Sold
                        </span>

                        <span
                          className="
                            font-semibold

                            dark:text-gray-100
                          "
                        >
                          {formatNumber(
                            salesReport
                              ?.totalUnits
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="
                        text-sm
                        text-gray-400
                      "
                    >
                      No sales data available
                    </p>
                  )}
                </div>

                {/* Inventory */}

                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-5

                    shadow-sm

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <h3
                    className="
                      mb-4

                      flex
                      items-center
                      gap-2

                      text-sm
                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    <Package
                      size={
                        16
                      }
                      className="
                        text-blue-600
                      "
                    />

                    Inventory Summary
                  </h3>

                  {stockReport ? (
                    <div
                      className="
                        space-y-2
                      "
                    >
                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          border-b
                          border-gray-100

                          py-2

                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Raw Materials Value
                        </span>

                        <span
                          className="
                            text-right
                            font-semibold

                            dark:text-gray-100
                          "
                        >
                          {formatCurrency(
                            stockReport
                              .summary
                              ?.totalMaterialValue
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          border-b
                          border-gray-100

                          py-2

                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Bottles Value
                        </span>

                        <span
                          className="
                            text-right
                            font-semibold

                            dark:text-gray-100
                          "
                        >
                          {formatCurrency(
                            stockReport
                              .summary
                              ?.totalBottleValue
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          py-2
                        "
                      >
                        <span
                          className="
                            font-medium

                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Total Inventory
                        </span>

                        <span
                          className="
                            text-right
                            font-bold

                            text-blue-600
                          "
                        >
                          {formatCurrency(
                            inventoryValue
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="
                        text-sm
                        text-gray-400
                      "
                    >
                      No inventory data available
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ==================================
              STOCK
          ================================== */}

          {activeTab ===
            'stock' && (
            <div
              className="
                overflow-hidden

                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800
              "
            >
              <div
                className="
                  border-b
                  border-gray-200

                  p-5

                  dark:border-slate-700
                "
              >
                <h3
                  className="
                    text-lg
                    font-semibold

                    text-gray-800

                    dark:text-gray-100
                  "
                >
                  Inventory Stock Report
                </h3>

                <p
                  className="
                    text-sm

                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  Current stock levels and values
                </p>
              </div>

              {loadingStock ? (
                <div
                  className="
                    flex
                    justify-center
                    py-12
                  "
                >
                  <Loader2
                    className="
                      h-8
                      w-8
                      animate-spin
                      text-amber-500
                    "
                  />
                </div>
              ) : stockReport ? (
                <div
                  className="
                    p-4

                    sm:p-5
                  "
                >
                  {/* Summary */}

                  <div
                    className="
                      mb-6

                      grid
                      grid-cols-1

                      gap-4

                      sm:grid-cols-3
                    "
                  >
                    <div
                      className="
                        rounded-xl

                        border
                        border-amber-100

                        bg-amber-50

                        p-4

                        dark:border-amber-900/50
                        dark:bg-amber-950/20
                      "
                    >
                      <p
                        className="
                          text-xs
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Raw Materials
                      </p>

                      <p
                        className="
                          text-xl
                          font-bold

                          text-amber-700

                          dark:text-amber-400
                        "
                      >
                        {formatCurrency(
                          stockReport
                            .summary
                            ?.totalMaterialValue
                        )}
                      </p>

                      <p
                        className="
                          text-xs
                          text-gray-400
                        "
                      >
                        {stockReport
                          .materials
                          ?.length ||
                          0}{' '}
                        materials
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl

                        border
                        border-blue-100

                        bg-blue-50

                        p-4

                        dark:border-blue-900/50
                        dark:bg-blue-950/20
                      "
                    >
                      <p
                        className="
                          text-xs
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Bottles
                      </p>

                      <p
                        className="
                          text-xl
                          font-bold

                          text-blue-700

                          dark:text-blue-400
                        "
                      >
                        {formatCurrency(
                          stockReport
                            .summary
                            ?.totalBottleValue
                        )}
                      </p>

                      <p
                        className="
                          text-xs
                          text-gray-400
                        "
                      >
                        {stockReport
                          .bottles
                          ?.length ||
                          0}{' '}
                        bottle types
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl

                        border
                        border-green-100

                        bg-green-50

                        p-4

                        dark:border-green-900/50
                        dark:bg-green-950/20
                      "
                    >
                      <p
                        className="
                          text-xs
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Total Inventory
                      </p>

                      <p
                        className="
                          text-xl
                          font-bold

                          text-green-700

                          dark:text-green-400
                        "
                      >
                        {formatCurrency(
                          inventoryValue
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Materials */}

                  <h4
                    className="
                      mb-3

                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    Raw Materials
                  </h4>

                  <div
                    className="
                      mb-6
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        min-w-[720px]

                        divide-y
                        divide-gray-200

                        dark:divide-slate-700
                      "
                    >
                      <thead
                        className="
                          bg-gray-50

                          dark:bg-slate-900/50
                        "
                      >
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Name
                          </th>

                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            SKU
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Stock (ml)
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Per ml Cost
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Total Value
                          </th>
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-gray-200

                          dark:divide-slate-700
                        "
                      >
                        {stockReport
                          .materials
                          ?.slice(
                            0,
                            10
                          )
                          .map(
                            (
                              material
                            ) => {
                              const stock =
                                toNumber(
                                  material
                                    .currentStockMl
                                );

                              const cost =
                                toNumber(
                                  material
                                    .avgCostPerMl
                                );

                              return (
                                <tr
                                  key={
                                    material._id
                                  }
                                  className="
                                    hover:bg-gray-50

                                    dark:hover:bg-slate-700/40
                                  "
                                >
                                  <td className="px-4 py-2 text-sm dark:text-gray-200">
                                    {
                                      material.name
                                    }
                                  </td>

                                  <td className="px-4 py-2 text-sm dark:text-gray-300">
                                    {
                                      material.sku
                                    }
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm dark:text-gray-300">
                                    {
                                      stock
                                    }
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm dark:text-gray-300">
                                    {cost.toFixed(
                                      2
                                    )}
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm font-medium dark:text-gray-200">
                                    {formatCurrency(
                                      stock *
                                        cost
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                          )}

                        {stockReport
                          .materials
                          ?.length >
                          10 && (
                          <tr>
                            <td
                              colSpan={
                                5
                              }
                              className="
                                px-4
                                py-2

                                text-center
                                text-sm

                                text-gray-400
                              "
                            >
                              +{' '}
                              {stockReport
                                .materials
                                .length -
                                10}{' '}
                              more materials
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottles */}

                  <h4
                    className="
                      mb-3

                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    Bottles
                  </h4>

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        min-w-[650px]

                        divide-y
                        divide-gray-200

                        dark:divide-slate-700
                      "
                    >
                      <thead
                        className="
                          bg-gray-50

                          dark:bg-slate-900/50
                        "
                      >
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Size
                          </th>

                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Type
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Stock
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Avg Cost
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Total Value
                          </th>
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-gray-200

                          dark:divide-slate-700
                        "
                      >
                        {stockReport
                          .bottles
                          ?.slice(
                            0,
                            10
                          )
                          .map(
                            (
                              bottle
                            ) => {
                              const stock =
                                toNumber(
                                  bottle
                                    .currentStock
                                );

                              const cost =
                                toNumber(
                                  bottle
                                    .avgCostPerUnit
                                );

                              return (
                                <tr
                                  key={
                                    bottle._id
                                  }
                                  className="
                                    hover:bg-gray-50

                                    dark:hover:bg-slate-700/40
                                  "
                                >
                                  <td className="px-4 py-2 text-sm dark:text-gray-200">
                                    {
                                      bottle.sizeMl
                                    }{' '}
                                    ml
                                  </td>

                                  <td className="px-4 py-2 text-sm capitalize dark:text-gray-300">
                                    {
                                      bottle.type
                                    }
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm dark:text-gray-300">
                                    {
                                      stock
                                    }
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm dark:text-gray-300">
                                    {cost.toFixed(
                                      2
                                    )}
                                  </td>

                                  <td className="px-4 py-2 text-right text-sm font-medium dark:text-gray-200">
                                    {formatCurrency(
                                      stock *
                                        cost
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                          )}

                        {stockReport
                          .bottles
                          ?.length >
                          10 && (
                          <tr>
                            <td
                              colSpan={
                                5
                              }
                              className="
                                px-4
                                py-2

                                text-center
                                text-sm

                                text-gray-400
                              "
                            >
                              +{' '}
                              {stockReport
                                .bottles
                                .length -
                                10}{' '}
                              more bottles
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  className="
                    p-8
                    text-center
                    text-gray-400
                  "
                >
                  No stock data available
                </div>
              )}
            </div>
          )}

          {/* ==================================
              SALES
          ================================== */}

          {activeTab ===
            'sales' && (
            <div
              className="
                overflow-hidden

                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800
              "
            >
              <div
                className="
                  border-b
                  border-gray-200

                  p-5

                  dark:border-slate-700
                "
              >
                <h3
                  className="
                    text-lg
                    font-semibold

                    text-gray-800

                    dark:text-gray-100
                  "
                >
                  Sales Report
                </h3>

                <p
                  className="
                    text-sm

                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  {dateRange.start &&
                  dateRange.end
                    ? `${new Date(
                        dateRange.start
                      ).toLocaleDateString()} – ${new Date(
                        dateRange.end
                      ).toLocaleDateString()}`
                    : 'All time'}
                </p>
              </div>

              {loadingSales ? (
                <div
                  className="
                    flex
                    justify-center
                    py-12
                  "
                >
                  <Loader2
                    className="
                      h-8
                      w-8
                      animate-spin
                      text-amber-500
                    "
                  />
                </div>
              ) : salesReport ? (
                <div
                  className="
                    p-4

                    sm:p-5
                  "
                >
                  {/* Summary */}

                  <div
                    className="
                      mb-6

                      grid
                      grid-cols-1

                      gap-4

                      sm:grid-cols-3
                    "
                  >
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Total Revenue
                      </p>

                      <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
                        {formatCurrency(
                          salesReport
                            .totalRevenue
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Total Units Sold
                      </p>

                      <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                        {formatNumber(
                          salesReport
                            .totalUnits
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Total Sales
                      </p>

                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(
                          salesReport
                            .sales
                            ?.length ||
                            0
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Channels */}

                  {salesReport.byChannel &&
                    Object.keys(
                      salesReport.byChannel
                    ).length >
                      0 && (
                    <div
                      className="
                        mb-6
                      "
                    >
                      <h4
                        className="
                          mb-3

                          font-semibold

                          text-gray-700

                          dark:text-gray-200
                        "
                      >
                        Revenue by Channel
                      </h4>

                      <div
                        className="
                          grid
                          grid-cols-1

                          gap-3

                          sm:grid-cols-2
                          md:grid-cols-3
                          xl:grid-cols-4
                        "
                      >
                        {Object.entries(
                          salesReport.byChannel
                        ).map(
                          ([
                            channel,
                            data,
                          ]) => (
                            <div
                              key={
                                channel
                              }
                              className="
                                rounded-lg

                                border
                                border-gray-200

                                bg-gray-50

                                p-3

                                dark:border-slate-700
                                dark:bg-slate-900/50
                              "
                            >
                              <p
                                className="
                                  text-xs

                                  text-gray-500

                                  dark:text-gray-400
                                "
                              >
                                {
                                  channel
                                }
                              </p>

                              <p
                                className="
                                  text-sm
                                  font-semibold

                                  dark:text-gray-200
                                "
                              >
                                {formatCurrency(
                                  data
                                    ?.revenue
                                )}
                              </p>

                              <p
                                className="
                                  text-xs
                                  text-gray-400
                                "
                              >
                                {formatNumber(
                                  data
                                    ?.units
                                )}{' '}
                                units
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sales Table */}

                  <h4
                    className="
                      mb-3

                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    Recent Sales
                  </h4>

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        min-w-[760px]

                        divide-y
                        divide-gray-200

                        dark:divide-slate-700
                      "
                    >
                      <thead
                        className="
                          bg-gray-50

                          dark:bg-slate-900/50
                        "
                      >
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Invoice
                          </th>

                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Channel
                          </th>

                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Date
                          </th>

                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                            Amount
                          </th>

                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-gray-200

                          dark:divide-slate-700
                        "
                      >
                        {salesReport
                          .sales
                          ?.slice(
                            0,
                            20
                          )
                          .map(
                            (
                              sale
                            ) => (
                              <tr
                                key={
                                  sale._id
                                }
                                className="
                                  hover:bg-gray-50

                                  dark:hover:bg-slate-700/40
                                "
                              >
                                <td className="px-4 py-2 text-sm font-medium dark:text-gray-200">
                                  {
                                    sale.invoiceNo
                                  }
                                </td>

                                <td className="px-4 py-2 text-sm dark:text-gray-300">
                                  {
                                    sale.channel
                                  }
                                </td>

                                <td className="px-4 py-2 text-sm dark:text-gray-300">
                                  {new Date(
                                    sale.saleDate
                                  ).toLocaleDateString()}
                                </td>

                                <td className="px-4 py-2 text-right text-sm font-semibold dark:text-gray-200">
                                  {formatCurrency(
                                    sale.totalAmount
                                  )}
                                </td>

                                <td className="px-4 py-2 text-sm">
                                  <span
                                    className={`
                                      rounded-full

                                      px-2
                                      py-1

                                      text-xs
                                      font-medium

                                      ${
                                        sale.paymentStatus ===
                                        'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }
                                    `}
                                  >
                                    {
                                      sale.paymentStatus
                                    }
                                  </span>
                                </td>
                              </tr>
                            )
                          )}

                        {salesReport
                          .sales
                          ?.length ===
                          0 && (
                          <tr>
                            <td
                              colSpan={
                                5
                              }
                              className="
                                px-4
                                py-8

                                text-center

                                text-gray-400
                              "
                            >
                              No sales in this period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  className="
                    p-8
                    text-center
                    text-gray-400
                  "
                >
                  No sales data available
                </div>
              )}
            </div>
          )}

          {/* ==================================
              PROFIT & LOSS
          ================================== */}

          {activeTab ===
            'profit' && (
            <div
              className="
                overflow-hidden

                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800
              "
            >
              <div
                className="
                  border-b
                  border-gray-200

                  p-5

                  dark:border-slate-700
                "
              >
                <h3
                  className="
                    text-lg
                    font-semibold

                    text-gray-800

                    dark:text-gray-100
                  "
                >
                  Profit & Loss Statement
                </h3>

                <p
                  className="
                    text-sm

                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  Revenue, expenses and net profit
                </p>
              </div>

              {loadingProfit ? (
                <div
                  className="
                    flex
                    justify-center
                    py-12
                  "
                >
                  <Loader2
                    className="
                      h-8
                      w-8
                      animate-spin
                      text-amber-500
                    "
                  />
                </div>
              ) : profitReport ? (
                <div
                  className="
                    p-4

                    sm:p-5
                  "
                >
                  <div
                    className="
                      mb-6

                      grid
                      grid-cols-1

                      gap-4

                      sm:grid-cols-3
                    "
                  >
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Total Revenue
                      </p>

                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(
                          profitReport
                            .totalRevenue
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Total Expenses
                      </p>

                      <p className="text-xl font-bold text-rose-700 dark:text-rose-400">
                        {formatCurrency(
                          profitReport
                            .totalExpense
                        )}
                      </p>
                    </div>

                    <div
                      className={`
                        rounded-xl

                        border

                        p-4

                        ${
                          toNumber(
                            profitReport
                              .netProfit
                          ) >= 0
                            ? 'border-amber-100 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                            : 'border-red-100 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20'
                        }
                      `}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Net Profit
                      </p>

                      <p
                        className={`
                          text-xl
                          font-bold

                          ${
                            toNumber(
                              profitReport
                                .netProfit
                            ) >= 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                          }
                        `}
                      >
                        {formatCurrency(
                          profitReport
                            .netProfit
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    className="
                      space-y-4
                    "
                  >
                    <div
                      className="
                        rounded-xl

                        bg-gray-50

                        p-4

                        dark:bg-slate-900/50
                      "
                    >
                      <h4
                        className="
                          mb-3

                          font-semibold

                          text-gray-700

                          dark:text-gray-200
                        "
                      >
                        Revenue Breakdown
                      </h4>

                      <div
                        className="
                          flex
                          justify-between
                          gap-4

                          border-b
                          border-gray-200

                          py-2

                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            text-gray-600

                            dark:text-gray-400
                          "
                        >
                          Total Sales Revenue
                        </span>

                        <span
                          className="
                            text-right
                            font-semibold

                            text-emerald-600
                          "
                        >
                          {formatCurrency(
                            profitReport
                              .totalRevenue
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      className="
                        rounded-xl

                        bg-gray-50

                        p-4

                        dark:bg-slate-900/50
                      "
                    >
                      <h4
                        className="
                          mb-3

                          font-semibold

                          text-gray-700

                          dark:text-gray-200
                        "
                      >
                        Expense Breakdown
                      </h4>

                      <div
                        className="
                          space-y-2
                        "
                      >
                        <div
                          className="
                            flex
                            justify-between
                            gap-4

                            border-b
                            border-gray-200

                            py-2

                            dark:border-slate-700
                          "
                        >
                          <span
                            className="
                              text-gray-600

                              dark:text-gray-400
                            "
                          >
                            Total Purchases
                          </span>

                          <span
                            className="
                              text-right
                              font-semibold

                              text-rose-600
                            "
                          >
                            {formatCurrency(
                              profitReport
                                .totalPurchaseCost
                            )}
                          </span>
                        </div>

                        <div
                          className="
                            flex
                            justify-between
                            gap-4

                            border-b
                            border-gray-200

                            py-2

                            dark:border-slate-700
                          "
                        >
                          <span
                            className="
                              text-gray-600

                              dark:text-gray-400
                            "
                          >
                            Total Expenses
                          </span>

                          <span
                            className="
                              text-right
                              font-semibold

                              text-rose-600
                            "
                          >
                            {formatCurrency(
                              profitReport
                                .totalExpense
                            )}
                          </span>
                        </div>

                        <div
                          className="
                            flex
                            justify-between
                            gap-4

                            py-2
                          "
                        >
                          <span
                            className="
                              font-medium

                              text-gray-600

                              dark:text-gray-300
                            "
                          >
                            Total Costs
                          </span>

                          <span
                            className="
                              text-right
                              font-bold

                              text-rose-600
                            "
                          >
                            {formatCurrency(
                              toNumber(
                                profitReport
                                  .totalPurchaseCost
                              ) +
                                toNumber(
                                  profitReport
                                    .totalExpense
                                )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="
                        rounded-xl

                        border
                        border-amber-200

                        bg-gradient-to-r
                        from-amber-50
                        to-orange-50

                        p-4

                        dark:border-amber-900/50
                        dark:from-amber-950/30
                        dark:to-orange-950/20
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-4
                        "
                      >
                        <span
                          className="
                            font-semibold

                            text-gray-800

                            dark:text-gray-200
                          "
                        >
                          Net Profit
                        </span>

                        <span
                          className={`
                            text-right
                            text-2xl
                            font-bold

                            ${
                              toNumber(
                                profitReport
                                  .netProfit
                              ) >=
                              0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-red-700 dark:text-red-400'
                            }
                          `}
                        >
                          {formatCurrency(
                            profitReport
                              .netProfit
                          )}
                        </span>
                      </div>

                      {toNumber(
                        profitReport
                          .netProfit
                      ) >= 0 ? (
                        <p
                          className="
                            mt-1

                            flex
                            items-center
                            gap-1

                            text-sm

                            text-green-600
                          "
                        >
                          <TrendingUp
                            size={
                              16
                            }
                          />

                          Positive profit margin
                        </p>
                      ) : (
                        <p
                          className="
                            mt-1

                            flex
                            items-center
                            gap-1

                            text-sm

                            text-red-600
                          "
                        >
                          <TrendingDown
                            size={
                              16
                            }
                          />

                          Loss – review expenses
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="
                    p-8
                    text-center
                    text-gray-400
                  "
                >
                  No profit data available
                </div>
              )}
            </div>
          )}

          {/* ==================================
              INVESTORS
          ================================== */}

          {activeTab ===
            'investors' && (
            <div
              className="
                overflow-hidden

                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800
              "
            >
              <div
                className="
                  border-b
                  border-gray-200

                  p-5

                  dark:border-slate-700
                "
              >
                <h3
                  className="
                    text-lg
                    font-semibold

                    text-gray-800

                    dark:text-gray-100
                  "
                >
                  Investor Profit Distribution
                </h3>

                <p
                  className="
                    text-sm

                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  Share of profits based on investment
                </p>
              </div>

              {loadingInvestor ? (
                <div
                  className="
                    flex
                    justify-center
                    py-12
                  "
                >
                  <Loader2
                    className="
                      h-8
                      w-8
                      animate-spin
                      text-amber-500
                    "
                  />
                </div>
              ) : investorProfit ? (
                <div
                  className="
                    p-4

                    sm:p-5
                  "
                >
                  <div
                    className="
                      mb-6

                      rounded-xl

                      border
                      border-amber-200

                      bg-amber-50

                      p-4

                      dark:border-amber-900/50
                      dark:bg-amber-950/20
                    "
                  >
                    <p
                      className="
                        text-sm

                        text-gray-600

                        dark:text-gray-300
                      "
                    >
                      Total Net Profit Available for Distribution
                    </p>

                    <p
                      className="
                        break-words

                        text-2xl
                        font-bold

                        text-amber-700

                        dark:text-amber-400

                        sm:text-3xl
                      "
                    >
                      {formatCurrency(
                        investorProfit
                          .netProfit
                      )}
                    </p>
                  </div>

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        min-w-[560px]

                        divide-y
                        divide-gray-200

                        dark:divide-slate-700
                      "
                    >
                      <thead
                        className="
                          bg-gray-50

                          dark:bg-slate-900/50
                        "
                      >
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                            Investor
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                            Share %
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-gray-200

                          dark:divide-slate-700
                        "
                      >
                        {investorProfit
                          .distribution
                          ?.map(
                            (
                              investor,
                              index
                            ) => (
                              <tr
                                key={
                                  investor._id ||
                                  investor.name ||
                                  index
                                }
                                className="
                                  hover:bg-gray-50

                                  dark:hover:bg-slate-700/40
                                "
                              >
                                <td
                                  className="
                                    px-4
                                    py-3

                                    font-medium

                                    dark:text-gray-200
                                  "
                                >
                                  {
                                    investor.name
                                  }
                                </td>

                                <td
                                  className="
                                    px-4
                                    py-3

                                    text-right
                                  "
                                >
                                  <span
                                    className="
                                      rounded-full

                                      bg-blue-100

                                      px-2
                                      py-1

                                      text-xs
                                      font-medium

                                      text-blue-700

                                      dark:bg-blue-900/40
                                      dark:text-blue-300
                                    "
                                  >
                                    {toNumber(
                                      investor
                                        .sharePercentage
                                    ).toFixed(
                                      2
                                    )}
                                    %
                                  </span>
                                </td>

                                <td
                                  className="
                                    px-4
                                    py-3

                                    text-right
                                    font-semibold

                                    text-emerald-600
                                  "
                                >
                                  {formatCurrency(
                                    investor
                                      .amount
                                  )}
                                </td>
                              </tr>
                            )
                          )}

                        {(!investorProfit
                          .distribution ||
                          investorProfit
                            .distribution
                            .length ===
                            0) && (
                          <tr>
                            <td
                              colSpan={
                                3
                              }
                              className="
                                px-4
                                py-8

                                text-center

                                text-gray-400
                              "
                            >
                              No investors found
                            </td>
                          </tr>
                        )}
                      </tbody>

                      <tfoot
                        className="
                          bg-gray-50

                          font-semibold

                          dark:bg-slate-900/50
                        "
                      >
                        <tr>
                          <td
                            className="
                              px-4
                              py-3

                              text-right

                              dark:text-gray-300
                            "
                          >
                            Total Distributed
                          </td>

                          <td
                            className="
                              px-4
                              py-3

                              text-right

                              dark:text-gray-300
                            "
                          >
                            {investorProfit
                              .distribution
                              ?.length
                              ? `${investorProfit.distribution
                                  .reduce(
                                    (
                                      sum,
                                      investor
                                    ) =>
                                      sum +
                                      toNumber(
                                        investor
                                          .sharePercentage
                                      ),
                                    0
                                  )
                                  .toFixed(
                                    2
                                  )}%`
                              : '0.00%'}
                          </td>

                          <td
                            className="
                              px-4
                              py-3

                              text-right

                              text-amber-600
                            "
                          >
                            {formatCurrency(
                              investorProfit
                                .distribution
                                ?.reduce(
                                  (
                                    sum,
                                    investor
                                  ) =>
                                    sum +
                                    toNumber(
                                      investor
                                        .amount
                                    ),
                                  0
                                ) ||
                                0
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p
                    className="
                      mt-4

                      text-xs
                      leading-5

                      text-gray-400
                    "
                  >
                    * Distribution is calculated based on each investor&apos;s net contribution share.

                    <br />

                    <Link
                      to="/investors"
                      className="
                        text-amber-600

                        hover:underline
                      "
                    >
                      Manage investors →
                    </Link>
                  </p>
                </div>
              ) : (
                <div
                  className="
                    p-8
                    text-center
                    text-gray-400
                  "
                >
                  No investor data available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

export default Reports;