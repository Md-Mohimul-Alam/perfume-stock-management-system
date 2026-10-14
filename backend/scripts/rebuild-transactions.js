require('dotenv').config();

const mongoose =
  require('mongoose');

const Sale =
  require('../src/models/Sale');

const Purchase =
  require('../src/models/Purchase');

const Expense =
  require('../src/models/Expense');

const Investor =
  require('../src/models/Investor');

const Transaction =
  require('../src/models/Transaction');

/* ========================================
   HELPERS
======================================== */

const money = (
  value
) =>
  Number(
    Number(
      value || 0
    ).toFixed(2)
  );

const printLine = (
  label,
  value
) => {
  console.log(
    `${label.padEnd(
      32
    )}${value}`
  );
};

/* ========================================
   MAIN
======================================== */

async function rebuildTransactions() {
  if (
    !process.env.MONGO_URI
  ) {
    throw new Error(
      'MONGO_URI is missing from .env'
    );
  }

  console.log(
    '\n========================================'
  );

  console.log(
    'LUXE TRANSACTION LEDGER REBUILD'
  );

  console.log(
    '========================================\n'
  );

  await mongoose.connect(
    process.env.MONGO_URI
  );

  console.log(
    '✅ MongoDB connected\n'
  );

  try {
    /* ======================================
       LOAD SOURCE DATA
    ====================================== */

    const [
      sales,
      purchases,
      expenses,
      investors,
      settlements,
    ] =
      await Promise.all([
        Sale.find().lean(),

        Purchase.find().lean(),

        Expense.find().lean(),

        Investor.find().lean(),

        Transaction.find({
          type: 'cash_out',

          category:
            'Investor Settlement',
        }).lean(),
      ]);

    /* ======================================
       SOURCE TOTALS
    ====================================== */

    const paidSales =
      sales.filter(
        (sale) =>
          sale.paymentStatus ===
          'paid'
      );

    const dueSales =
      sales.filter(
        (sale) =>
          sale.paymentStatus ===
          'due'
      );

    const paidRevenue =
      paidSales.reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.totalAmount ||
              0
          ),
        0
      );

    const dueAmount =
      dueSales.reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.totalAmount ||
              0
          ),
        0
      );

    const purchaseTotal =
      purchases.reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.totalAmount ||
              0
          ),
        0
      );

    const expenseTotal =
      expenses.reduce(
        (
          total,
          expense
        ) =>
          total +
          Number(
            expense.amount ||
              0
          ),
        0
      );

    let investmentTotal =
      0;

    let withdrawalTotal =
      0;

    investors.forEach(
      (investor) => {
        (
          investor.contributions ||
          []
        ).forEach(
          (
            contribution
          ) => {
            if (
              contribution.type ===
              'investment'
            ) {
              investmentTotal +=
                Number(
                  contribution.amount ||
                    0
                );
            }

            if (
              contribution.type ===
              'withdrawal'
            ) {
              withdrawalTotal +=
                Number(
                  contribution.amount ||
                    0
                );
            }
          }
        );
      }
    );

    const settlementTotal =
      settlements.reduce(
        (
          total,
          settlement
        ) =>
          total +
          Number(
            settlement.amount ||
              0
          ),
        0
      );

    console.log(
      'SOURCE DATA'
    );

    console.log(
      '----------------------------------------'
    );

    printLine(
      'Paid sales:',
      paidSales.length
    );

    printLine(
      'Paid revenue:',
      `৳${money(
        paidRevenue
      )}`
    );

    printLine(
      'Due sales:',
      dueSales.length
    );

    printLine(
      'Due amount:',
      `৳${money(
        dueAmount
      )}`
    );

    printLine(
      'Purchases:',
      purchases.length
    );

    printLine(
      'Purchase total:',
      `৳${money(
        purchaseTotal
      )}`
    );

    printLine(
      'Expenses:',
      expenses.length
    );

    printLine(
      'Expense total:',
      `৳${money(
        expenseTotal
      )}`
    );

    printLine(
      'Investors:',
      investors.length
    );

    printLine(
      'Investments:',
      `৳${money(
        investmentTotal
      )}`
    );

    printLine(
      'Withdrawals:',
      `৳${money(
        withdrawalTotal
      )}`
    );

    printLine(
      'Settlements:',
      `৳${money(
        settlementTotal
      )}`
    );

    console.log('');

    /* ======================================
       BACKUP CURRENT TRANSACTIONS
    ====================================== */

    const oldTransactions =
      await Transaction.find().lean();

    console.log(
      `Current transaction records: ${oldTransactions.length}`
    );

    /*
      This script does NOT create
      another MongoDB collection backup.

      Before running in production,
      make an Atlas backup/export if
      you want permanent rollback.

      Settlement transactions are
      preserved below.
    */

    /* ======================================
       DELETE ONLY GENERATED CATEGORIES
    ====================================== */

    const categoriesToRebuild =
      [
        'Sale',
        'Purchase',
        'Expense',
        'Investment',
        'Withdrawal',
      ];

    const deleteResult =
      await Transaction.deleteMany(
        {
          category: {
            $in:
              categoriesToRebuild,
          },
        }
      );

    console.log(
      `🧹 Deleted ${deleteResult.deletedCount} stale generated transaction records`
    );

    /* ======================================
       BUILD SALE TRANSACTIONS
    ====================================== */

    const saleTransactions =
      paidSales.map(
        (sale) => ({
          type:
            'cash_in',

          amount:
            sale.totalAmount,

          category:
            'Sale',

          reference:
            sale._id,

          refModel:
            'Sale',

          date:
            sale.saleDate,

          description:
            `Sale ${
              sale.invoiceNo ||
              ''
            }`.trim(),
        })
      );

    /* ======================================
       BUILD PURCHASE TRANSACTIONS
    ====================================== */

    const purchaseTransactions =
      purchases.map(
        (
          purchase
        ) => ({
          type:
            'cash_out',

          amount:
            purchase.totalAmount,

          category:
            'Purchase',

          reference:
            purchase._id,

          refModel:
            'Purchase',

          date:
            purchase.purchaseDate,

          description:
            `Purchase ${
              purchase.invoiceNo ||
              ''
            }${
              purchase.supplier
                ? ` - ${purchase.supplier}`
                : ''
            }`,
        })
      );

    /* ======================================
       BUILD EXPENSE TRANSACTIONS
    ====================================== */

    const expenseTransactions =
      expenses.map(
        (
          expense
        ) => ({
          type:
            'cash_out',

          amount:
            expense.amount,

          category:
            'Expense',

          reference:
            expense._id,

          refModel:
            'Expense',

          date:
            expense.date,

          description:
            `${
              expense.category ||
              'Expense'
            } - ${
              expense.description ||
              expense.reference ||
              ''
            }`.trim(),
        })
      );

    /* ======================================
       BUILD INVESTOR TRANSACTIONS
    ====================================== */

    const investorTransactions =
      [];

    investors.forEach(
      (investor) => {
        (
          investor.contributions ||
          []
        ).forEach(
          (
            contribution
          ) => {
            if (
              contribution.type ===
              'investment'
            ) {
              investorTransactions.push(
                {
                  type:
                    'cash_in',

                  amount:
                    contribution.amount,

                  category:
                    'Investment',

                  reference:
                    investor._id,

                  refModel:
                    'Investor',

                  date:
                    contribution.date,

                  description:
                    `investment - ${
                      investor.name
                    } - ${
                      contribution.notes ||
                      ''
                    }`,
                }
              );
            }

            if (
              contribution.type ===
              'withdrawal'
            ) {
              investorTransactions.push(
                {
                  type:
                    'cash_out',

                  amount:
                    contribution.amount,

                  category:
                    'Withdrawal',

                  reference:
                    investor._id,

                  refModel:
                    'Investor',

                  date:
                    contribution.date,

                  description:
                    `withdrawal - ${
                      investor.name
                    } - ${
                      contribution.notes ||
                      ''
                    }`,
                }
              );
            }
          }
        );
      }
    );

    /* ======================================
       INSERT REBUILT TRANSACTIONS
    ====================================== */

    const rebuiltTransactions =
      [
        ...saleTransactions,

        ...purchaseTransactions,

        ...expenseTransactions,

        ...investorTransactions,
      ];

    if (
      rebuiltTransactions.length >
      0
    ) {
      await Transaction.insertMany(
        rebuiltTransactions
      );
    }

    console.log(
      `✅ Inserted ${rebuiltTransactions.length} rebuilt transaction records`
    );

    /* ======================================
       VERIFY LEDGER
    ====================================== */

    const verification =
      await Transaction.aggregate(
        [
          {
            $group: {
              _id: {
                type:
                  '$type',

                category:
                  '$category',
              },

              count: {
                $sum: 1,
              },

              total: {
                $sum:
                  '$amount',
              },
            },
          },

          {
            $sort: {
              '_id.category':
                1,
            },
          },
        ]
      );

    console.log(
      '\nREBUILT LEDGER'
    );

    console.log(
      '----------------------------------------'
    );

    verification.forEach(
      (row) => {
        console.log(
          `${
            row._id.category
          } | ${
            row._id.type
          } | ${
            row.count
          } records | ৳${money(
            row.total
          )}`
        );
      }
    );

    /* ======================================
       EXPECTED VS ACTUAL
    ====================================== */

    const getLedgerTotal = (
      category
    ) => {
      const row =
        verification.find(
          (item) =>
            item._id
              .category ===
            category
        );

      return {
        count:
          row?.count ||
          0,

        total:
          Number(
            row?.total ||
              0
          ),
      };
    };

    const saleLedger =
      getLedgerTotal(
        'Sale'
      );

    const purchaseLedger =
      getLedgerTotal(
        'Purchase'
      );

    const expenseLedger =
      getLedgerTotal(
        'Expense'
      );

    const investmentLedger =
      getLedgerTotal(
        'Investment'
      );

    const withdrawalLedger =
      getLedgerTotal(
        'Withdrawal'
      );

    const settlementLedger =
      getLedgerTotal(
        'Investor Settlement'
      );

    const tolerance =
      0.01;

    const checks = [
      {
        name:
          'Sale total',

        expected:
          paidRevenue,

        actual:
          saleLedger.total,
      },

      {
        name:
          'Purchase total',

        expected:
          purchaseTotal,

        actual:
          purchaseLedger.total,
      },

      {
        name:
          'Expense total',

        expected:
          expenseTotal,

        actual:
          expenseLedger.total,
      },

      {
        name:
          'Investment total',

        expected:
          investmentTotal,

        actual:
          investmentLedger.total,
      },

      {
        name:
          'Withdrawal total',

        expected:
          withdrawalTotal,

        actual:
          withdrawalLedger.total,
      },

      {
        name:
          'Settlement total',

        expected:
          settlementTotal,

        actual:
          settlementLedger.total,
      },
    ];

    console.log(
      '\nVERIFICATION'
    );

    console.log(
      '----------------------------------------'
    );

    let allPassed =
      true;

    checks.forEach(
      (check) => {
        const difference =
          Math.abs(
            check.expected -
              check.actual
          );

        const passed =
          difference <=
          tolerance;

        if (!passed) {
          allPassed =
            false;
        }

        console.log(
          `${
            passed
              ? '✅'
              : '❌'
          } ${
            check.name
          }`
        );

        console.log(
          `   Expected: ৳${money(
            check.expected
          )}`
        );

        console.log(
          `   Actual:   ৳${money(
            check.actual
          )}`
        );
      }
    );

    /* ======================================
       AVAILABLE CASH CHECK
    ====================================== */

    const availableCash =
      paidRevenue -
      expenseTotal -
      purchaseTotal +
      investmentTotal -
      withdrawalTotal -
      settlementTotal;

    console.log(
      '\nFINANCIAL CHECK'
    );

    console.log(
      '----------------------------------------'
    );

    printLine(
      'Paid revenue:',
      `৳${money(
        paidRevenue
      )}`
    );

    printLine(
      '- Expenses:',
      `৳${money(
        expenseTotal
      )}`
    );

    printLine(
      '- Purchases:',
      `৳${money(
        purchaseTotal
      )}`
    );

    printLine(
      '+ Investments:',
      `৳${money(
        investmentTotal
      )}`
    );

    printLine(
      '- Withdrawals:',
      `৳${money(
        withdrawalTotal
      )}`
    );

    printLine(
      '- Settlements:',
      `৳${money(
        settlementTotal
      )}`
    );

    console.log(
      '----------------------------------------'
    );

    printLine(
      'Available Cash:',
      `৳${money(
        availableCash
      )}`
    );

    console.log('');

    if (allPassed) {
      console.log(
        '✅ Transaction ledger rebuild completed successfully.'
      );
    } else {
      console.log(
        '⚠️ Rebuild completed, but one or more verification checks failed.'
      );
    }
  } finally {
    await mongoose.disconnect();

    console.log(
      '\n🔌 MongoDB disconnected'
    );
  }
}

/* ========================================
   RUN
======================================== */

rebuildTransactions()
  .then(() => {
    process.exit(0);
  })
  .catch(
    (error) => {
      console.error(
        '\n❌ Transaction rebuild failed:'
      );

      console.error(
        error
      );

      process.exit(1);
    }
  );