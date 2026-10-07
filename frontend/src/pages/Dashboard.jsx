import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import {
  Package,
  FlaskRound,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Droplet,
  SprayCan,
  BarChart3,
  Wallet,
  Calendar,
  ArrowUpRight,
  Layers,
  ShoppingCart,
  Award,
  Clock,
  Trash2,
  RefreshCw,
  RotateCw,
  AlertCircle,
  PlusCircle,
  FileText,
  Users,
} from 'lucide-react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';

import API from '../api/axios';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

import RecentActivity from '../components/RecentActivity';
import RevenueChart from '../components/RevenueChart';

/* ========================================
   HELPERS
======================================== */

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const getBottleAvailableStock = (bottle = {}) => {
  if (
    bottle.currentStock !== undefined &&
    bottle.currentStock !== null
  ) {
    return Math.max(
      0,
      toNumber(bottle.currentStock)
    );
  }

  return Math.max(
    0,
    toNumber(bottle.totalPurchased) -
      toNumber(bottle.sold)
  );
};

const money = (value) =>
  `৳${toNumber(value).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const localDateKey = (dateInput) => {
  const date = new Date(dateInput);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


/* ========================================
   BUILD DASHBOARD NOTIFICATIONS
======================================== */

const buildNotifications = (
  lowMaterials = [],
  lowBottles = [],
  dueSalesList = []
) => {
  const notifications = [];

  /* ========================================
     LOW RAW MATERIALS
  ======================================== */

  lowMaterials.forEach((material) => {
    if (!material?._id) {
      return;
    }

    notifications.push({
      id: `material-low-${material._id}`,

      type: 'warning',

      message:
        `Material "${material.name || 'Unknown'}" low ` +
        `(${Number(material.currentStockMl || 0)} ml)`,

      link: '/inventory/materials',

      time: 'Low stock',

      read: false,
    });
  });

  /* ========================================
     LOW BOTTLES
  ======================================== */

  lowBottles.forEach((bottle) => {
    if (!bottle?._id) {
      return;
    }

    notifications.push({
      id: `bottle-low-${bottle._id}`,

      type: 'warning',

      message:
        `Bottle ${Number(bottle.sizeMl || 0)}ml ` +
        `(${bottle.type || 'unknown'}) low ` +
        `(${getBottleAvailableStock(bottle)} pcs)`,

      link: '/inventory/bottles',

      time: 'Low stock',

      read: false,
    });
  });

  /* ========================================
     DUE SALES
  ======================================== */

  dueSalesList.forEach((sale) => {
    if (!sale?._id) {
      return;
    }

    const amount =
      Number(sale.totalAmount || 0);

    notifications.push({
      id: `due-sale-${sale._id}`,

      type: 'due',

      message:
        `Due payment ৳${amount.toFixed(2)} ` +
        `- ${sale.invoiceNo || 'Invoice'}`,

      link: '/sales?paymentStatus=due',

      time: 'Payment pending',

      read: false,
    });
  });

  return notifications;
};

/* ========================================
   SKELETON
======================================== */

const SkeletonCard = () => (
  <div
    className="
      h-28
      animate-pulse

      rounded-2xl

      border
      border-gray-200

      bg-white

      dark:border-slate-700
      dark:bg-slate-800
    "
  />
);

/* ========================================
   DASHBOARD
======================================== */

const Dashboard = () => {
  const { user } = useAuth();

  const { setNotifications } =
    useNotifications();

  const [loading, setLoading] =
    useState(true);

  const [rebuilding, setRebuilding] =
    useState(false);

  const [stats, setStats] = useState({
    materials: 0,
    bottles: 0,
    products: 0,

    salesCount: 0,

    totalRevenue: 0,
    totalExpenses: 0,
    totalPurchases: 0,

    netProfit: 0,

    rawMaterialStockValue: 0,
    bottleStockValue: 0,
    totalInventoryValue: 0,

    dueCount: 0,
    dueAmount: 0,
  });

  const [salesTypeCounts, setSalesTypeCounts] =
    useState({
      oil: 0,
      perfume: 0,
    });

  const [topProducts, setTopProducts] =
    useState([]);

  const [bottles, setBottles] =
    useState([]);

  const [recentSales, setRecentSales] =
    useState([]);

  const [
    recentPurchases,
    setRecentPurchases,
  ] = useState([]);

  const [
    settlementsTotal,
    setSettlementsTotal,
  ] = useState(0);

  const [
    lowStockItems,
    setLowStockItems,
  ] = useState({
    materials: [],
    bottles: [],
  });

  const [chartData, setChartData] =
    useState([]);

  const [
    recentActivities,
    setRecentActivities,
  ] = useState([]);

  /* ========================================
     LOAD DATA
  ======================================== */

  const fetchDashboardData =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          materialsRes,
          bottlesRes,
          productsRes,
          salesRes,
          expensesRes,
          purchasesRes,
          cashRes,
          settlementsRes,
        ] = await Promise.all([
          API.get('/inventory/materials'),
          API.get('/inventory/bottles/with-sales'),
          API.get('/products'),
          API.get('/sales'),
          API.get('/expenses'),
          API.get('/purchases'),
          API.get('/reports/available-cash'),
          API.get('/investors/settlements'),
        ]);

        const materials = Array.isArray(
          materialsRes?.data
        )
          ? materialsRes.data
          : [];

        const bottleData = Array.isArray(
          bottlesRes?.data
        )
          ? bottlesRes.data
          : [];

        const products = Array.isArray(
          productsRes?.data
        )
          ? productsRes.data
          : [];

        const sales = Array.isArray(
          salesRes?.data
        )
          ? salesRes.data
          : [];

        const expenses = Array.isArray(
          expensesRes?.data
        )
          ? expensesRes.data
          : [];

        const purchases = Array.isArray(
          purchasesRes?.data
        )
          ? purchasesRes.data
          : [];

        setBottles(bottleData);

        setSettlementsTotal(
          toNumber(
            settlementsRes?.data?.total
          )
        );

        /* Low stock */

        const lowMaterials =
          materials.filter(
            (material) =>
              toNumber(
                material.currentStockMl
              ) < 10
          );

        const lowBottles =
          bottleData.filter(
            (bottle) =>
              getBottleAvailableStock(
                bottle
              ) < 3
          );

        setLowStockItems({
          materials: lowMaterials,
          bottles: lowBottles,
        });

        /* Due sales */

        const dueSales =
          sales.filter(
            (sale) =>
              sale.paymentStatus === 'due'
          );

        const dueAmount =
          dueSales.reduce(
            (sum, sale) =>
              sum +
              toNumber(
                sale.totalAmount
              ),
            0
          );

        setNotifications(
          buildNotifications(
            lowMaterials,
            lowBottles,
            dueSales
          )
        );

        /* Financial totals */

        const totalRevenue =
          sales.reduce(
            (sum, sale) =>
              sum +
              toNumber(
                sale.totalAmount
              ),
            0
          );

        const totalExpenses =
          expenses.reduce(
            (sum, expense) =>
              sum +
              toNumber(
                expense.amount
              ),
            0
          );

        const totalPurchases =
          purchases.reduce(
            (sum, purchase) =>
              sum +
              toNumber(
                purchase.totalAmount
              ),
            0
          );

        /* Raw material valuation */

        const rawMaterialStockValue =
          materials.reduce(
            (sum, material) =>
              sum +
              toNumber(
                material.currentStockMl
              ) *
                toNumber(
                  material.avgCostPerMl
                ),
            0
          );

        /* Bottle valuation */

        const bottleStockValue =
          bottleData.reduce(
            (sum, bottle) =>
              sum +
              getBottleAvailableStock(
                bottle
              ) *
                toNumber(
                  bottle.avgCostPerUnit
                ),
            0
          );

        const totalInventoryValue =
          rawMaterialStockValue +
          bottleStockValue;

        const availableCash =
          toNumber(
            cashRes?.data?.availableCash
          );

        /* Product sales */

        let oilSold = 0;
        let perfumeSold = 0;

        const productSalesMap = {};

        sales.forEach((sale) => {
          if (
            !Array.isArray(sale.items)
          ) {
            return;
          }

          sale.items.forEach((item) => {
            const product = item.product;

            if (!product) {
              return;
            }

            const quantity =
              toNumber(item.quantity);

            const unitPrice =
              toNumber(item.unitPrice);

            if (
              product.type === 'roll-on'
            ) {
              oilSold += quantity;
            }

            if (
              product.type === 'spray'
            ) {
              perfumeSold += quantity;
            }

            const productId =
              product._id;

            if (!productId) {
              return;
            }

            if (
              !productSalesMap[
                productId
              ]
            ) {
              productSalesMap[
                productId
              ] = {
                productId,
                totalSold: 0,
                totalRevenue: 0,
                productName:
                  product.name ||
                  'Unknown Product',
                sku:
                  product.sku ||
                  'N/A',
              };
            }

            productSalesMap[
              productId
            ].totalSold += quantity;

            productSalesMap[
              productId
            ].totalRevenue +=
              quantity * unitPrice;
          });
        });

        setSalesTypeCounts({
          oil: oilSold,
          perfume: perfumeSold,
        });

        const bestProducts =
          Object.values(
            productSalesMap
          )
            .sort(
              (a, b) =>
                b.totalSold -
                a.totalSold
            )
            .slice(0, 5);

        setTopProducts(
          bestProducts
        );

        /* Recent sales */

        const sortedSales = [
          ...sales,
        ].sort(
          (a, b) =>
            new Date(b.saleDate) -
            new Date(a.saleDate)
        );

        setRecentSales(
          sortedSales.slice(0, 5)
        );

        /* Recent purchases */

        const sortedPurchases = [
          ...purchases,
        ].sort(
          (a, b) =>
            new Date(
              b.purchaseDate
            ) -
            new Date(
              a.purchaseDate
            )
        );

        setRecentPurchases(
          sortedPurchases.slice(
            0,
            5
          )
        );

        /* Recent activity */

        const activities = [];

        sortedSales
          .slice(0, 5)
          .forEach((sale) => {
            activities.push({
              type: 'sale',
              id: sale._id,
              title:
                `Sale ${sale.invoiceNo || ''}` +
                `${
                  sale.channel
                    ? ` - ${sale.channel}`
                    : ''
                }`,
              date: sale.saleDate,
              time: formatDate(
                sale.saleDate
              ),
              amount:
                toNumber(
                  sale.totalAmount
                ),
            });
          });

        sortedPurchases
          .slice(0, 5)
          .forEach((purchase) => {
            activities.push({
              type: 'purchase',
              id: purchase._id,
              title:
                `Purchase ${
                  purchase.invoiceNo ||
                  ''
                }` +
                `${
                  purchase.supplier
                    ? ` - ${purchase.supplier}`
                    : ''
                }`,
              date:
                purchase.purchaseDate,
              time: formatDate(
                purchase.purchaseDate
              ),
              amount:
                -toNumber(
                  purchase.totalAmount
                ),
            });
          });

        expenses
          .slice()
          .sort(
            (a, b) =>
              new Date(b.date) -
              new Date(a.date)
          )
          .slice(0, 5)
          .forEach((expense) => {
            activities.push({
              type: 'expense',
              id: expense._id,
              title:
                `Expense - ${
                  expense.category ||
                  'Expense'
                }` +
                `${
                  expense.description
                    ? `: ${expense.description}`
                    : ''
                }`,
              date: expense.date,
              time: formatDate(
                expense.date
              ),
              amount:
                -toNumber(
                  expense.amount
                ),
            });
          });

        activities.sort(
          (a, b) =>
            new Date(b.date) -
            new Date(a.date)
        );

        setRecentActivities(
          activities.slice(0, 10)
        );

        /* Stats */

        setStats({
          materials:
            materials.length,

          bottles:
            bottleData.length,

          products:
            products.length,

          salesCount:
            sales.length,

          totalRevenue,

          totalExpenses,

          totalPurchases,

          netProfit:
            availableCash,

          rawMaterialStockValue,

          bottleStockValue,

          totalInventoryValue,

          dueCount:
            dueSales.length,

          dueAmount,
        });

        /* Last 30 days chart */

        const days = {};

        const now = new Date();

        for (
          let index = 29;
          index >= 0;
          index--
        ) {
          const date =
            new Date(now);

          date.setDate(
            date.getDate() -
              index
          );

          days[
            localDateKey(date)
          ] = 0;
        }

        sales.forEach((sale) => {
          if (!sale.saleDate) {
            return;
          }

          const key =
            localDateKey(
              sale.saleDate
            );

          if (
            days[key] !== undefined
          ) {
            days[key] +=
              toNumber(
                sale.totalAmount
              );
          }
        });

        setChartData(
          Object.entries(days).map(
            ([date, revenue]) => ({
              date,
              revenue,
            })
          )
        );
      } catch (error) {
        console.error(
          'Dashboard error:',
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Failed to load dashboard'
        );
      } finally {
        setLoading(false);
      }
    }, [setNotifications]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  /* ========================================
     REBUILD STOCK
  ======================================== */

  const handleRebuild =
    async () => {
      if (
        user?.role !== 'admin'
      ) {
        toast.error(
          'Only admins can rebuild stock'
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Rebuild stock from purchases and sales? This will recalculate all stock levels.'
        );

      if (!confirmed) {
        return;
      }

      setRebuilding(true);

      try {
        const response =
          await API.post(
            '/admin/rebuild-stock'
          );

        toast.success(
          response.data?.message ||
            'Stock rebuilt successfully'
        );

        await fetchDashboardData();
      } catch (error) {
        console.error(
          'Rebuild error:',
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Failed to rebuild stock'
        );
      } finally {
        setRebuilding(false);
      }
    };

  /* ========================================
     PDF
  ======================================== */

  const exportDashboardPDF =
    async () => {
      const element =
        document.getElementById(
          'dashboard-content'
        );

      if (!element) {
        return;
      }

      toast.loading(
        'Generating PDF...',
        {
          id: 'pdf-export',
        }
      );

      try {
        const canvas =
          await html2canvas(
            element,
            {
              scale: 2,
              useCORS: true,
              backgroundColor:
                '#f8fafc',
              logging: false,
            }
          );

        const image =
          canvas.toDataURL(
            'image/png'
          );

        const pdf =
          new jsPDF(
            'p',
            'mm',
            'a4'
          );

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        const imageHeight =
          (canvas.height *
            pageWidth) /
          canvas.width;

        let position = 0;
        let heightLeft =
          imageHeight;

        pdf.addImage(
          image,
          'PNG',
          0,
          position,
          pageWidth,
          imageHeight
        );

        heightLeft -=
          pageHeight;

        while (
          heightLeft > 0
        ) {
          position =
            heightLeft -
            imageHeight;

          pdf.addPage();

          pdf.addImage(
            image,
            'PNG',
            0,
            position,
            pageWidth,
            imageHeight
          );

          heightLeft -=
            pageHeight;
        }

        pdf.save(
          'luxe-dashboard-report.pdf'
        );

        toast.success(
          'PDF exported successfully',
          {
            id: 'pdf-export',
          }
        );
      } catch (error) {
        console.error(
          'PDF export error:',
          error
        );

        toast.error(
          'Failed to generate PDF',
          {
            id: 'pdf-export',
          }
        );
      }
    };

  /* ========================================
     DASHBOARD CARDS
  ======================================== */

  const mainCards =
    useMemo(
      () => [
        {
          title:
            'Raw Materials',
          value:
            stats.materials,
          icon: Package,

          color:
            'text-amber-600 dark:text-amber-400',

          bg:
            'bg-amber-50 dark:bg-amber-900/20',

          link:
            '/inventory/materials',

          linkText:
            'Manage',
        },

        {
          title:
            'Bottle Types',

          value:
            stats.bottles,

          icon:
            FlaskRound,

          color:
            'text-cyan-600 dark:text-cyan-400',

          bg:
            'bg-cyan-50 dark:bg-cyan-900/20',

          link:
            '/inventory/bottles',

          linkText:
            'View',
        },

        {
          title:
            'Products',

          value:
            stats.products,

          icon:
            Sparkles,

          color:
            'text-purple-600 dark:text-purple-400',

          bg:
            'bg-purple-50 dark:bg-purple-900/20',

          link:
            '/products',

          linkText:
            'Browse',
        },

        {
          title:
            'Sales',

          value:
            stats.salesCount,

          icon:
            ShoppingBag,

          color:
            'text-blue-600 dark:text-blue-400',

          bg:
            'bg-blue-50 dark:bg-blue-900/20',

          link:
            '/sales',

          linkText:
            'View',
        },

        {
          title:
            'Raw Material Value',

          value:
            money(
              stats.rawMaterialStockValue
            ),

          icon:
            Layers,

          color:
            'text-emerald-600 dark:text-emerald-400',

          bg:
            'bg-emerald-50 dark:bg-emerald-900/20',

          link:
            '/inventory/materials',

          linkText:
            'Stock',
        },

        {
          title:
            'Bottle Value',

          value:
            money(
              stats.bottleStockValue
            ),

          icon:
            Layers,

          color:
            'text-teal-600 dark:text-teal-400',

          bg:
            'bg-teal-50 dark:bg-teal-900/20',

          link:
            '/inventory/bottles',

          linkText:
            'Stock',
        },
      ],
      [stats]
    );

  const overallSummary =
    useMemo(
      () => [
        {
          label: 'Revenue',
          value:
            money(
              stats.totalRevenue
            ),
          icon:
            TrendingUp,
          color:
            'text-emerald-600 dark:text-emerald-400',
          bg:
            'bg-emerald-50 dark:bg-emerald-900/20',
        },

        {
          label:
            'Expenses',
          value:
            money(
              stats.totalExpenses
            ),
          icon: Wallet,
          color:
            'text-rose-600 dark:text-rose-400',
          bg:
            'bg-rose-50 dark:bg-rose-900/20',
        },

        {
          label:
            'Purchases',
          value:
            money(
              stats.totalPurchases
            ),
          icon:
            ShoppingCart,
          color:
            'text-orange-600 dark:text-orange-400',
          bg:
            'bg-orange-50 dark:bg-orange-900/20',
        },

        {
          label:
            'Due Payments',
          value:
            money(
              stats.dueAmount
            ),
          icon: Clock,
          color:
            'text-yellow-600 dark:text-yellow-400',
          bg:
            'bg-yellow-50 dark:bg-yellow-900/20',
          badge:
            `${stats.dueCount} due`,
          link:
            '/sales?paymentStatus=due',
        },

        {
          label:
            'Available Cash',
          value:
            money(
              stats.netProfit
            ),
          icon:
            DollarSign,
          color:
            'text-brand-primary dark:text-brand-secondary',
          bg:
            'bg-amber-50 dark:bg-amber-900/20',
          link:
            '/investors',
        },

        {
          label:
            'Inventory Value',
          value:
            money(
              stats.totalInventoryValue
            ),
          icon: Layers,
          color:
            'text-teal-600 dark:text-teal-400',
          bg:
            'bg-teal-50 dark:bg-teal-900/20',
        },

        {
          label:
            'Business Value',
          value:
            money(
              stats.netProfit +
                stats.totalInventoryValue
            ),
          icon:
            BarChart3,
          color:
            'text-brand-primary dark:text-brand-secondary',
          bg:
            'bg-amber-50 dark:bg-amber-900/20',
        },

        {
          label:
            'Settlements',
          value:
            money(
              settlementsTotal
            ),
          icon: Wallet,
          color:
            'text-rose-600 dark:text-rose-400',
          bg:
            'bg-rose-50 dark:bg-rose-900/20',
        },
      ],
      [
        stats,
        settlementsTotal,
      ]
    );

  const profitMargin =
    stats.totalRevenue > 0
      ? (
          ((stats.totalRevenue -
            stats.totalExpenses -
            stats.totalPurchases) /
            stats.totalRevenue) *
          100
        ).toFixed(1)
      : '0.0';

  const inventoryTurnover =
    stats.totalInventoryValue > 0
      ? (
          stats.totalPurchases /
          stats.totalInventoryValue
        ).toFixed(1)
      : '0.0';

  const duePercentage =
    stats.totalRevenue > 0
      ? (
          (stats.dueAmount /
            stats.totalRevenue) *
          100
        ).toFixed(1)
      : '0.0';

  const averageSale =
    stats.salesCount > 0
      ? stats.totalRevenue /
        stats.salesCount
      : 0;

  /* ========================================
     UI
  ======================================== */

  return (
    <div
      id="dashboard-content"
      className="
        w-full
        space-y-5

        sm:space-y-6
      "
    >
      {/* ====================================
          HEADER
      ===================================== */}

      <section
        className="
          relative
          overflow-hidden

          rounded-2xl

          border
          border-gray-200

          bg-white

          p-4

          shadow-sm

          dark:border-slate-700
          dark:bg-slate-800

          sm:p-6
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            inset-0

            bg-gradient-to-br
            from-amber-500/10
            via-transparent
            to-orange-500/5
          "
        />

        <div
          className="
            relative

            flex
            flex-col

            gap-4

            xl:flex-row
            xl:items-center
            xl:justify-between
          "
        >
          <div className="min-w-0">
            <h1
              className="
                text-xl
                font-bold
                tracking-tight

                text-gray-900

                dark:text-white

                sm:text-2xl
                lg:text-3xl
              "
            >
              Welcome back,{' '}

              <span
                className="
                  text-brand-primary

                  dark:text-brand-secondary
                "
              >
                {user?.name ||
                  'Admin'}
              </span>
            </h1>

            <p
              className="
                mt-2
                flex
                items-center
                gap-2

                text-xs
                text-gray-500

                dark:text-gray-400

                sm:text-sm
              "
            >
              <Calendar
                size={16}
                className="
                  flex-shrink-0
                  text-brand-primary
                "
              />

              {new Date().toLocaleDateString(
                'en-US',
                {
                  weekday:
                    'long',

                  year:
                    'numeric',

                  month:
                    'long',

                  day:
                    'numeric',
                }
              )}
            </p>
          </div>

          <div
            className="
              grid
              grid-cols-2

              gap-2

              sm:flex
              sm:flex-wrap
            "
          >
            <button
              type="button"
              onClick={
                exportDashboardPDF
              }
              className="
                inline-flex
                min-h-10
                items-center
                justify-center
                gap-2

                rounded-xl

                border
                border-gray-200

                bg-white

                px-3
                py-2

                text-xs
                font-medium

                text-gray-700

                shadow-sm

                transition

                hover:bg-gray-50

                dark:border-slate-600
                dark:bg-slate-700
                dark:text-gray-200
                dark:hover:bg-slate-600

                sm:px-4
                sm:text-sm
              "
            >
              <FileText
                size={17}
              />

              Export PDF
            </button>

            <button
              type="button"
              onClick={
                fetchDashboardData
              }
              disabled={loading}
              className="
                inline-flex
                min-h-10
                items-center
                justify-center
                gap-2

                rounded-xl

                border
                border-gray-200

                bg-white

                px-3
                py-2

                text-xs
                font-medium

                text-gray-700

                shadow-sm

                transition

                hover:bg-gray-50

                disabled:opacity-60

                dark:border-slate-600
                dark:bg-slate-700
                dark:text-gray-200
                dark:hover:bg-slate-600

                sm:px-4
                sm:text-sm
              "
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh
            </button>

            {user?.role ===
              'admin' && (
              <button
                type="button"
                onClick={
                  handleRebuild
                }
                disabled={
                  rebuilding
                }
                className="
                  col-span-2

                  inline-flex
                  min-h-10
                  items-center
                  justify-center
                  gap-2

                  rounded-xl

                  bg-brand-primary

                  px-3
                  py-2

                  text-xs
                  font-semibold

                  text-white

                  shadow-sm

                  transition

                  hover:brightness-95

                  disabled:cursor-not-allowed
                  disabled:opacity-60

                  sm:col-span-1
                  sm:px-4
                  sm:text-sm
                "
              >
                <RotateCw
                  size={17}
                  className={
                    rebuilding
                      ? 'animate-spin'
                      : ''
                  }
                />

                {rebuilding
                  ? 'Rebuilding...'
                  : 'Rebuild Stock'}
              </button>
            )}
          </div>
        </div>

        {/* LOW STOCK */}

        {(lowStockItems
          .materials.length >
          0 ||
          lowStockItems
            .bottles.length >
            0) && (
          <div
            className="
              relative

              mt-4

              flex
              items-start
              gap-3

              rounded-xl

              border
              border-amber-200

              bg-amber-50

              p-3

              text-sm

              dark:border-amber-800/60
              dark:bg-amber-900/20
            "
          >
            <AlertCircle
              size={20}
              className="
                mt-0.5
                flex-shrink-0

                text-amber-600

                dark:text-amber-400
              "
            />

            <div className="min-w-0">
              <p
                className="
                  font-semibold

                  text-amber-800

                  dark:text-amber-300
                "
              >
                Low stock alert
              </p>

              <div
                className="
                  mt-1

                  flex
                  flex-wrap
                  gap-x-3
                  gap-y-1

                  text-xs

                  text-amber-700

                  dark:text-amber-400
                "
              >
                {lowStockItems
                  .materials
                  .length >
                  0 && (
                  <Link
                    to="/inventory/materials"
                    className="
                      underline
                      underline-offset-2
                    "
                  >
                    {
                      lowStockItems
                        .materials
                        .length
                    }{' '}
                    material(s)
                    low
                  </Link>
                )}

                {lowStockItems
                  .bottles
                  .length >
                  0 && (
                  <Link
                    to="/inventory/bottles"
                    className="
                      underline
                      underline-offset-2
                    "
                  >
                    {
                      lowStockItems
                        .bottles
                        .length
                    }{' '}
                    bottle
                    type(s) low
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ====================================
          QUICK ACTIONS
      ===================================== */}

      <section>
        <div
          className="
            grid
            grid-cols-2

            gap-3

            sm:grid-cols-3
            xl:grid-cols-6
          "
        >
          {[
            {
              label:
                'New Sale',
              link:
                '/sales/new',
              icon:
                PlusCircle,
              iconClass:
                'text-blue-600 dark:text-blue-400',
              bg:
                'bg-blue-50 dark:bg-blue-900/20',
            },

            {
              label:
                'Add Expense',
              link:
                '/expenses',
              icon:
                Wallet,
              iconClass:
                'text-rose-600 dark:text-rose-400',
              bg:
                'bg-rose-50 dark:bg-rose-900/20',
            },

            {
              label:
                'Wastage',
              link:
                '/wastage/new',
              icon:
                Trash2,
              iconClass:
                'text-red-600 dark:text-red-400',
              bg:
                'bg-red-50 dark:bg-red-900/20',
            },

            {
              label:
                'New Purchase',
              link:
                '/purchases/new',
              icon:
                ShoppingCart,
              iconClass:
                'text-orange-600 dark:text-orange-400',
              bg:
                'bg-orange-50 dark:bg-orange-900/20',
            },

            {
              label:
                'Investors',
              link:
                '/investors',
              icon:
                Users,
              iconClass:
                'text-teal-600 dark:text-teal-400',
              bg:
                'bg-teal-50 dark:bg-teal-900/20',
            },

            {
              label:
                'Reports',
              link:
                '/reports',
              icon:
                FileText,
              iconClass:
                'text-brand-primary dark:text-brand-secondary',
              bg:
                'bg-amber-50 dark:bg-amber-900/20',
            },
          ].map(
            (action) => {
              const Icon =
                action.icon;

              return (
                <Link
                  key={
                    action.label
                  }
                  to={
                    action.link
                  }
                  className="
                    group

                    flex
                    min-h-[92px]
                    flex-col
                    items-center
                    justify-center

                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    p-3

                    text-center

                    shadow-sm

                    transition-all

                    hover:-translate-y-0.5
                    hover:shadow-md

                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <div
                    className={`
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center

                      rounded-xl

                      ${action.bg}
                    `}
                  >
                    <Icon
                      size={21}
                      className={`
                        ${action.iconClass}

                        transition-transform

                        group-hover:scale-110
                      `}
                    />
                  </div>

                  <span
                    className="
                      mt-2
                      text-xs
                      font-semibold

                      text-gray-700

                      dark:text-gray-200
                    "
                  >
                    {
                      action.label
                    }
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </section>

      {/* ====================================
          LOADING
      ===================================== */}

      {loading ? (
        <div className="space-y-5">
          <div
            className="
              grid
              grid-cols-2

              gap-3

              sm:grid-cols-3
              lg:grid-cols-4
              xl:grid-cols-6
            "
          >
            {Array.from({
              length: 6,
            }).map(
              (_, index) => (
                <SkeletonCard
                  key={index}
                />
              )
            )}
          </div>

          <div
            className="
              grid
              grid-cols-2

              gap-3

              sm:grid-cols-4
              xl:grid-cols-8
            "
          >
            {Array.from({
              length: 8,
            }).map(
              (_, index) => (
                <SkeletonCard
                  key={index}
                />
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* =================================
              MAIN STATS
          ================================= */}

          <section
            className="
              grid
              grid-cols-2

              gap-3

              sm:grid-cols-3
              lg:grid-cols-4
              xl:grid-cols-6
            "
          >
            {mainCards.map(
              (card) => {
                const Icon =
                  card.icon;

                return (
                  <article
                    key={
                      card.title
                    }
                    className="
                      flex
                      min-h-[125px]
                      min-w-0
                      flex-col

                      rounded-2xl

                      border
                      border-gray-200

                      bg-white

                      p-3.5

                      shadow-sm

                      transition-all

                      hover:-translate-y-0.5
                      hover:shadow-md

                      dark:border-slate-700
                      dark:bg-slate-800

                      sm:p-4
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-0
                        items-start
                        justify-between
                        gap-2
                      "
                    >
                      <div
                        className={`
                          flex
                          h-9
                          w-9
                          flex-shrink-0
                          items-center
                          justify-center

                          rounded-xl

                          ${card.bg}
                        `}
                      >
                        <Icon
                          size={19}
                          className={
                            card.color
                          }
                        />
                      </div>

                      <p
                        className="
                          min-w-0

                          break-words

                          text-right
                          text-base
                          font-bold
                          leading-tight

                          text-gray-900

                          dark:text-white

                          sm:text-lg
                        "
                      >
                        {
                          card.value
                        }
                      </p>
                    </div>

                    <p
                      className="
                        mt-3

                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-wide

                        text-gray-500

                        dark:text-gray-400

                        sm:text-xs
                      "
                    >
                      {
                        card.title
                      }
                    </p>

                    <Link
                      to={
                        card.link
                      }
                      className="
                        mt-auto

                        inline-flex
                        items-center
                        gap-1

                        pt-2

                        text-[11px]
                        font-medium

                        text-brand-primary

                        dark:text-brand-secondary
                      "
                    >
                      {
                        card.linkText
                      }

                      <ArrowUpRight
                        size={12}
                      />
                    </Link>
                  </article>
                );
              }
            )}
          </section>

          {/* =================================
              FINANCIAL SNAPSHOT
          ================================= */}

          <section>
            <h2
              className="
                mb-3

                flex
                items-center
                gap-2

                text-base
                font-semibold

                text-gray-800

                dark:text-gray-200

                sm:text-lg
              "
            >
              <BarChart3
                size={19}
                className="
                  text-brand-primary

                  dark:text-brand-secondary
                "
              />

              Financial Snapshot
            </h2>

            <div
              className="
                grid
                grid-cols-2

                gap-3

                sm:grid-cols-4
                xl:grid-cols-8
              "
            >
              {overallSummary.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const content = (
                    <article
                      className="
                        relative

                        flex
                        min-h-[105px]
                        min-w-0
                        flex-col
                        items-center
                        justify-center

                        rounded-2xl

                        border
                        border-gray-200

                        bg-white

                        p-3

                        text-center

                        shadow-sm

                        transition-all

                        hover:-translate-y-0.5
                        hover:shadow-md

                        dark:border-slate-700
                        dark:bg-slate-800
                      "
                    >
                      {item.badge && (
                        <span
                          className="
                            absolute
                            right-1.5
                            top-1.5

                            rounded-full

                            bg-yellow-100

                            px-1.5
                            py-0.5

                            text-[9px]
                            font-bold

                            text-yellow-800

                            dark:bg-yellow-900/50
                            dark:text-yellow-300
                          "
                        >
                          {
                            item.badge
                          }
                        </span>
                      )}

                      <div
                        className={`
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center

                          rounded-lg

                          ${item.bg}
                        `}
                      >
                        <Icon
                          size={16}
                          className={
                            item.color
                          }
                        />
                      </div>

                      <p
                        className="
                          mt-2

                          text-[9px]
                          font-semibold
                          uppercase
                          tracking-wide

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        {
                          item.label
                        }
                      </p>

                      <p
                        className={`
                          mt-1

                          max-w-full

                          break-all

                          text-xs
                          font-bold

                          sm:text-sm

                          ${item.color}
                        `}
                      >
                        {
                          item.value
                        }
                      </p>
                    </article>
                  );

                  return item.link ? (
                    <Link
                      key={
                        item.label
                      }
                      to={
                        item.link
                      }
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={
                        item.label
                      }
                    >
                      {content}
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* =================================
              PERFORMANCE
          ================================= */}

          <section
            className="
              grid
              grid-cols-2

              gap-3

              lg:grid-cols-4
            "
          >
            {[
              {
                label:
                  'Profit Margin',
                value:
                  `${profitMargin}%`,
                caption:
                  'of revenue',
                icon:
                  TrendingUp,
                color:
                  'text-emerald-600 dark:text-emerald-400',
              },

              {
                label:
                  'Inventory Turnover',
                value:
                  `${inventoryTurnover}x`,
                caption:
                  'purchases ÷ inventory',
                icon:
                  RefreshCw,
                color:
                  'text-blue-600 dark:text-blue-400',
              },

              {
                label:
                  'Cash Conversion',
                value:
                  `${duePercentage}%`,
                caption:
                  'due payments',
                icon:
                  Clock,
                color:
                  'text-purple-600 dark:text-purple-400',
              },

              {
                label:
                  'Avg. Sale Value',
                value:
                  money(
                    averageSale
                  ),
                caption:
                  'per transaction',
                icon:
                  DollarSign,
                color:
                  'text-brand-primary dark:text-brand-secondary',
              },
            ].map(
              (metric) => {
                const Icon =
                  metric.icon;

                return (
                  <article
                    key={
                      metric.label
                    }
                    className="
                      min-w-0

                      rounded-2xl

                      border
                      border-gray-200

                      bg-white

                      p-3.5

                      shadow-sm

                      dark:border-slate-700
                      dark:bg-slate-800

                      sm:p-4
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <Icon
                        size={16}
                        className={
                          metric.color
                        }
                      />

                      <p
                        className="
                          truncate

                          text-[9px]
                          font-semibold
                          uppercase
                          tracking-wide

                          text-gray-500

                          dark:text-gray-400

                          sm:text-xs
                        "
                      >
                        {
                          metric.label
                        }
                      </p>
                    </div>

                    <p
                      className={`
                        mt-2

                        break-words

                        text-lg
                        font-bold

                        sm:text-2xl

                        ${metric.color}
                      `}
                    >
                      {
                        metric.value
                      }
                    </p>

                    <p
                      className="
                        mt-0.5

                        text-[10px]

                        text-gray-400

                        dark:text-gray-500

                        sm:text-xs
                      "
                    >
                      {
                        metric.caption
                      }
                    </p>
                  </article>
                );
              }
            )}
          </section>

          {/* =================================
              CHART + ACTIVITY
          ================================= */}

          <section
            className="
              grid
              grid-cols-1

              gap-5

              lg:grid-cols-3
            "
          >
            <article
              className="
                min-w-0

                rounded-2xl

                border
                border-gray-200

                bg-white

                p-4

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                lg:col-span-2

                sm:p-5
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
                <TrendingUp
                  size={17}
                  className="
                    text-brand-primary

                    dark:text-brand-secondary
                  "
                />

                Revenue Trend

                <span
                  className="
                    hidden
                    font-normal
                    text-gray-400

                    sm:inline
                  "
                >
                  (Last 30 Days)
                </span>
              </h3>

              <RevenueChart data={chartData} />
            </article>

            <article
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
                  flex
                  items-center
                  gap-2

                  border-b
                  border-gray-200

                  px-4
                  py-3.5

                  font-semibold

                  text-gray-700

                  dark:border-slate-700
                  dark:text-gray-200
                "
              >
                <Clock
                  size={17}
                  className="
                    text-brand-primary

                    dark:text-brand-secondary
                  "
                />

                Recent Activity
              </div>

              <div
                className="
                  max-h-[340px]
                  overflow-y-auto

                  p-2
                "
              >
                <RecentActivity
                  activities={
                    recentActivities
                  }
                />
              </div>
            </article>
          </section>

          {/* =================================
              SALES + PURCHASES
          ================================= */}

          <section
            className="
              grid
              grid-cols-1

              gap-5

              lg:grid-cols-2
            "
          >
            {/* Recent Sales */}

            <article
              className="
                rounded-2xl

                border
                border-gray-200

                bg-white

                p-4

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                sm:p-5
              "
            >
              <div
                className="
                  mb-3

                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h3
                  className="
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
                    size={17}
                    className="text-blue-500"
                  />

                  Recent Sales
                </h3>

                <Link
                  to="/sales"
                  className="
                    whitespace-nowrap

                    text-xs
                    font-medium

                    text-brand-primary

                    dark:text-brand-secondary
                  "
                >
                  View all →
                </Link>
              </div>

              {recentSales.length ===
              0 ? (
                <p
                  className="
                    py-8
                    text-center
                    text-sm

                    text-gray-400

                    dark:text-gray-500
                  "
                >
                  No recent sales
                </p>
              ) : (
                <div className="space-y-1">
                  {recentSales.map(
                    (sale) => (
                      <div
                        key={
                          sale._id
                        }
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3

                          rounded-xl

                          p-3

                          transition-colors

                          hover:bg-gray-50

                          dark:hover:bg-slate-700/60
                        "
                      >
                        <div
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-9
                              w-9
                              flex-shrink-0
                              items-center
                              justify-center

                              rounded-full

                              bg-blue-50

                              dark:bg-blue-900/30
                            "
                          >
                            <DollarSign
                              size={
                                16
                              }
                              className="text-blue-500"
                            />
                          </div>

                          <div className="min-w-0">
                            <p
                              className="
                                truncate
                                text-sm
                                font-medium

                                text-gray-700

                                dark:text-gray-200
                              "
                            >
                              Invoice #
                              {
                                sale.invoiceNo
                              }
                            </p>

                            <p
                              className="
                                truncate

                                text-xs

                                text-gray-400

                                dark:text-gray-500
                              "
                            >
                              {formatDate(
                                sale.saleDate
                              )}

                              {sale.customer &&
                                ` • ${sale.customer}`}
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            flex-shrink-0
                            whitespace-nowrap

                            text-xs
                            font-semibold

                            text-blue-600

                            dark:text-blue-400

                            sm:text-sm
                          "
                        >
                          {money(
                            sale.totalAmount
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </article>

            {/* Recent Purchases */}

            <article
              className="
                rounded-2xl

                border
                border-gray-200

                bg-white

                p-4

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                sm:p-5
              "
            >
              <div
                className="
                  mb-3

                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h3
                  className="
                    flex
                    items-center
                    gap-2

                    text-sm
                    font-semibold

                    text-gray-700

                    dark:text-gray-200
                  "
                >
                  <ShoppingCart
                    size={17}
                    className="text-orange-500"
                  />

                  Recent Purchases
                </h3>

                <Link
                  to="/purchases"
                  className="
                    whitespace-nowrap

                    text-xs
                    font-medium

                    text-brand-primary

                    dark:text-brand-secondary
                  "
                >
                  View all →
                </Link>
              </div>

              {recentPurchases.length ===
              0 ? (
                <p
                  className="
                    py-8

                    text-center
                    text-sm

                    text-gray-400

                    dark:text-gray-500
                  "
                >
                  No recent purchases
                </p>
              ) : (
                <div className="space-y-1">
                  {recentPurchases.map(
                    (
                      purchase
                    ) => (
                      <div
                        key={
                          purchase._id
                        }
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3

                          rounded-xl

                          p-3

                          transition-colors

                          hover:bg-gray-50

                          dark:hover:bg-slate-700/60
                        "
                      >
                        <div
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-9
                              w-9
                              flex-shrink-0
                              items-center
                              justify-center

                              rounded-full

                              bg-orange-50

                              dark:bg-orange-900/30
                            "
                          >
                            <ShoppingCart
                              size={
                                16
                              }
                              className="text-orange-500"
                            />
                          </div>

                          <div className="min-w-0">
                            <p
                              className="
                                truncate

                                text-sm
                                font-medium

                                text-gray-700

                                dark:text-gray-200
                              "
                            >
                              {
                                purchase.invoiceNo
                              }
                            </p>

                            <p
                              className="
                                truncate

                                text-xs

                                text-gray-400

                                dark:text-gray-500
                              "
                            >
                              {formatDate(
                                purchase.purchaseDate
                              )}

                              {purchase.supplier &&
                                ` • ${purchase.supplier}`}
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            flex-shrink-0
                            whitespace-nowrap

                            text-xs
                            font-semibold

                            text-orange-600

                            dark:text-orange-400

                            sm:text-sm
                          "
                        >
                          {money(
                            purchase.totalAmount
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </article>
          </section>

          {/* =================================
              SALES TYPE + TOP PRODUCTS
          ================================= */}

          <section
            className="
              grid
              grid-cols-1

              gap-5

              lg:grid-cols-2
            "
          >
            {/* Sales Type */}

            <article
              className="
                rounded-2xl

                border
                border-gray-200

                bg-white

                p-4

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                sm:p-5
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
                <BarChart3
                  size={17}
                  className="
                    text-brand-primary

                    dark:text-brand-secondary
                  "
                />

                Sales by Product Type
              </h3>

              <div
                className="
                  grid
                  grid-cols-2
                  gap-3
                "
              >
                <div
                  className="
                    rounded-xl

                    border
                    border-amber-200/70

                    bg-amber-50

                    p-4

                    text-center

                    dark:border-amber-800/40
                    dark:bg-amber-900/20

                    sm:p-5
                  "
                >
                  <Droplet
                    className="
                      mx-auto
                      mb-2

                      h-7
                      w-7

                      text-amber-600

                      dark:text-amber-400
                    "
                  />

                  <p
                    className="
                      text-2xl
                      font-bold

                      text-amber-700

                      dark:text-amber-300
                    "
                  >
                    {
                      salesTypeCounts.oil
                    }
                  </p>

                  <p
                    className="
                      mt-1

                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide

                      text-gray-500

                      dark:text-gray-400
                    "
                  >
                    Roll-on Units
                  </p>
                </div>

                <div
                  className="
                    rounded-xl

                    border
                    border-blue-200/70

                    bg-blue-50

                    p-4

                    text-center

                    dark:border-blue-800/40
                    dark:bg-blue-900/20

                    sm:p-5
                  "
                >
                  <SprayCan
                    className="
                      mx-auto
                      mb-2

                      h-7
                      w-7

                      text-blue-600

                      dark:text-blue-400
                    "
                  />

                  <p
                    className="
                      text-2xl
                      font-bold

                      text-blue-700

                      dark:text-blue-300
                    "
                  >
                    {
                      salesTypeCounts.perfume
                    }
                  </p>

                  <p
                    className="
                      mt-1

                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide

                      text-gray-500

                      dark:text-gray-400
                    "
                  >
                    Spray Units
                  </p>
                </div>
              </div>
            </article>

            {/* Top Products */}

            <article
              className="
                rounded-2xl

                border
                border-gray-200

                bg-white

                p-4

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                sm:p-5
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
                <Award
                  size={17}
                  className="
                    text-brand-primary

                    dark:text-brand-secondary
                  "
                />

                Top Selling Products
              </h3>

              {topProducts.length ===
              0 ? (
                <p
                  className="
                    py-8
                    text-center
                    text-sm

                    text-gray-400

                    dark:text-gray-500
                  "
                >
                  No sales data yet
                </p>
              ) : (
                <div className="space-y-1">
                  {topProducts.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          item.productId
                        }
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3

                          rounded-xl

                          p-3

                          transition-colors

                          hover:bg-gray-50

                          dark:hover:bg-slate-700/60
                        "
                      >
                        <div
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-8
                              w-8
                              flex-shrink-0
                              items-center
                              justify-center

                              rounded-full

                              bg-amber-100

                              text-xs
                              font-bold

                              text-amber-700

                              dark:bg-amber-900/40
                              dark:text-amber-300
                            "
                          >
                            {index +
                              1}
                          </div>

                          <div className="min-w-0">
                            <p
                              className="
                                truncate

                                text-sm
                                font-medium

                                text-gray-700

                                dark:text-gray-200
                              "
                            >
                              {
                                item.productName
                              }
                            </p>

                            <p
                              className="
                                truncate

                                text-xs

                                text-gray-400

                                dark:text-gray-500
                              "
                            >
                              SKU:{' '}
                              {
                                item.sku
                              }
                            </p>
                          </div>
                        </div>

                        <div
                          className="
                            flex-shrink-0
                            text-right
                          "
                        >
                          <p
                            className="
                              text-xs
                              font-semibold

                              text-brand-primary

                              dark:text-brand-secondary

                              sm:text-sm
                            "
                          >
                            {
                              item.totalSold
                            }{' '}
                            units
                          </p>

                          <p
                            className="
                              text-[10px]

                              text-gray-500

                              dark:text-gray-400

                              sm:text-xs
                            "
                          >
                            {money(
                              item.totalRevenue
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </article>
          </section>

          {/* =================================
              BOTTLE INVENTORY
          ================================= */}

          <section>
            <h2
              className="
                mb-3

                flex
                items-center
                gap-2

                text-base
                font-semibold

                text-gray-800

                dark:text-gray-200

                sm:text-lg
              "
            >
              <FlaskRound
                size={19}
                className="text-cyan-500"
              />

              Bottle Inventory
            </h2>

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
              <div className="overflow-x-auto">
                <table
                  className="
                    min-w-[850px]
                    w-full

                    divide-y
                    divide-gray-200

                    dark:divide-slate-700
                  "
                >
                  <thead
                    className="
                      bg-gray-50

                      dark:bg-slate-800
                    "
                  >
                    <tr>
                      {[
                        [
                          'Bottle',
                          'text-left',
                        ],

                        [
                          'Type',
                          'text-left',
                        ],

                        [
                          'Total',
                          'text-right',
                        ],

                        [
                          'Sold',
                          'text-right',
                        ],

                        [
                          'Available',
                          'text-right',
                        ],

                        [
                          'Avg Cost',
                          'text-right',
                        ],

                        [
                          'Value',
                          'text-right',
                        ],
                      ].map(
                        ([
                          title,
                          align,
                        ]) => (
                          <th
                            key={
                              title
                            }
                            className={`
                              px-4
                              py-3.5

                              ${align}

                              text-[10px]
                              font-semibold
                              uppercase
                              tracking-wider

                              text-gray-500

                              dark:text-gray-400

                              sm:px-5
                              sm:text-xs
                            `}
                          >
                            {
                              title
                            }
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y
                      divide-gray-200

                      dark:divide-slate-700
                    "
                  >
                    {bottles.map(
                      (bottle) => {
                        const totalPurchased =
                          toNumber(
                            bottle.totalPurchased
                          );

                        const sold =
                          toNumber(
                            bottle.sold
                          );

                        const available =
                          getBottleAvailableStock(
                            bottle
                          );

                        const averageCost =
                          toNumber(
                            bottle.avgCostPerUnit
                          );

                        const value =
                          available *
                          averageCost;

                        return (
                          <tr
                            key={
                              bottle._id
                            }
                            className="
                              transition-colors

                              hover:bg-gray-50

                              dark:hover:bg-slate-700/50
                            "
                          >
                            <td
                              className="
                                whitespace-nowrap

                                px-4
                                py-3.5

                                text-sm
                                font-semibold

                                text-gray-800

                                dark:text-gray-200

                                sm:px-5
                              "
                            >
                              {
                                bottle.sizeMl
                              }{' '}
                              ml
                            </td>

                            <td
                              className="
                                whitespace-nowrap

                                px-4
                                py-3.5

                                text-sm
                                capitalize

                                text-gray-600

                                dark:text-gray-400

                                sm:px-5
                              "
                            >
                              {
                                bottle.type
                              }
                            </td>

                            <td
                              className="
                                px-4
                                py-3.5

                                text-right
                                text-sm
                                font-medium

                                text-gray-800

                                dark:text-gray-200

                                sm:px-5
                              "
                            >
                              {
                                totalPurchased
                              }
                            </td>

                            <td
                              className="
                                px-4
                                py-3.5

                                text-right
                                text-sm

                                text-rose-600

                                dark:text-rose-400

                                sm:px-5
                              "
                            >
                              {
                                sold
                              }
                            </td>

                            <td
                              className="
                                px-4
                                py-3.5

                                text-right
                                text-sm
                                font-semibold

                                text-emerald-600

                                dark:text-emerald-400

                                sm:px-5
                              "
                            >
                              {
                                available
                              }
                            </td>

                            <td
                              className="
                                whitespace-nowrap

                                px-4
                                py-3.5

                                text-right
                                text-sm

                                text-gray-700

                                dark:text-gray-300

                                sm:px-5
                              "
                            >
                              {money(
                                averageCost
                              )}
                            </td>

                            <td
                              className="
                                whitespace-nowrap

                                px-4
                                py-3.5

                                text-right
                                text-sm
                                font-semibold

                                text-cyan-600

                                dark:text-cyan-400

                                sm:px-5
                              "
                            >
                              {money(
                                value
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {bottles.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="7"
                          className="
                            py-10

                            text-center
                            text-sm

                            text-gray-400

                            dark:text-gray-500
                          "
                        >
                          No bottles
                          found
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {bottles.length >
                    0 && (
                    <tfoot
                      className="
                        bg-gray-50

                        font-semibold

                        dark:bg-slate-800
                      "
                    >
                      <tr>
                        <td
                          colSpan="2"
                          className="
                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-gray-700

                            dark:text-gray-300

                            sm:px-5
                          "
                        >
                          Total
                        </td>

                        <td
                          className="
                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-gray-800

                            dark:text-gray-200

                            sm:px-5
                          "
                        >
                          {bottles.reduce(
                            (
                              sum,
                              bottle
                            ) =>
                              sum +
                              toNumber(
                                bottle.totalPurchased
                              ),
                            0
                          )}
                        </td>

                        <td
                          className="
                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-gray-800

                            dark:text-gray-200

                            sm:px-5
                          "
                        >
                          {bottles.reduce(
                            (
                              sum,
                              bottle
                            ) =>
                              sum +
                              toNumber(
                                bottle.sold
                              ),
                            0
                          )}
                        </td>

                        <td
                          className="
                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-emerald-600

                            dark:text-emerald-400

                            sm:px-5
                          "
                        >
                          {bottles.reduce(
                            (
                              sum,
                              bottle
                            ) =>
                              sum +
                              getBottleAvailableStock(
                                bottle
                              ),
                            0
                          )}
                        </td>

                        <td
                          className="
                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-gray-400

                            sm:px-5
                          "
                        >
                          —
                        </td>

                        <td
                          className="
                            whitespace-nowrap

                            px-4
                            py-3.5

                            text-right
                            text-sm

                            text-cyan-600

                            dark:text-cyan-400

                            sm:px-5
                          "
                        >
                          {money(
                            bottles.reduce(
                              (
                                sum,
                                bottle
                              ) => {
                                const available =
                                  getBottleAvailableStock(
                                    bottle
                                  );

                                return (
                                  sum +
                                  available *
                                    toNumber(
                                      bottle.avgCostPerUnit
                                    )
                                );
                              },
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;