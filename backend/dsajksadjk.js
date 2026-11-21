
/**
 * LUXE Perfume — Wastage Reconciliation Audit
 * Database: LuxePerfume
 *
 * MODE: READ-ONLY AUDIT
 * No documents are inserted, updated, or deleted.
 *
 * Run:
 * node reconcile-wastage.js
 *
 * Requirements:
 * npm install mongoose dotenv
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// --------------------------------------------------
// IMPORT MODELS
// --------------------------------------------------

const Expense = require("./src/models/Expense");
const InventoryLog = require("./src/models/InventoryLog");
const RawMaterial = require("./src/models/RawMaterial");
const Transaction = require("./src/models/Transaction");

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "LuxePerfume";

const outputDir = path.join(__dirname, "exports");

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env");
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const money = value =>
  Number(value || 0).toFixed(2);

const quantity = value =>
  Number(value || 0).toFixed(3);

// --------------------------------------------------
// MAIN AUDIT
// --------------------------------------------------

async function reconcileWastage() {
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: DB_NAME
    });

    console.log("\n======================================");
    console.log(" LUXE PERFUME — WASTAGE AUDIT");
    console.log("======================================\n");

    console.log("Database:", DB_NAME);
    console.log("Mode: READ-ONLY");
    console.log("Connected to MongoDB successfully.\n");

    // --------------------------------------------------
    // 1. LOAD WASTAGE EXPENSES AND INVENTORY LOGS
    // --------------------------------------------------

    const wastageExpenses = await Expense.find({
      category: "Wastage"
    }).lean();

    const wastageLogs = await InventoryLog.find({
      reason: "wastage"
    })
      .sort({ createdAt: 1 })
      .lean();

    console.log("WASTAGE EXPENSES:", wastageExpenses.length);
    console.log("WASTAGE INVENTORY LOGS:", wastageLogs.length);

    // --------------------------------------------------
    // 2. FINANCIAL SUMMARY
    // --------------------------------------------------

    const totalExpense = wastageExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalWastageMl = wastageLogs.reduce(
      (sum, item) =>
        sum + Math.abs(Number(item.changeQuantity || 0)),
      0
    );

    console.log("\n--- SUMMARY ---");
    console.log("Total wastage expense: ৳" + money(totalExpense));
    console.log("Total logged wastage: " + quantity(totalWastageMl) + " ml");

    // --------------------------------------------------
    // 3. ALL WASTAGE EXPENSE RECORDS
    // --------------------------------------------------

    console.log("\n--- WASTAGE EXPENSE RECORDS ---");

    wastageExpenses.forEach((item, index) => {
      console.log(`\nExpense #${index + 1}`);

      console.log({
        id: item._id.toString(),
        category: item.category,
        amount: item.amount,
        description: item.description,
        material: item.material?.toString?.() || item.material || "",
        createdAt: item.createdAt
      });
    });

    // --------------------------------------------------
    // 4. ALL INVENTORY WASTAGE LOGS
    // --------------------------------------------------

    console.log("\n--- INVENTORY WASTAGE LOGS ---");

    wastageLogs.forEach((item, index) => {
      console.log(`\nInventory Log #${index + 1}`);

      console.log({
        id: item._id.toString(),
        material: item.material?.toString?.() || item.material || "",
        changeQuantity: item.changeQuantity,
        reason: item.reason,
        notes: item.notes,
        createdAt: item.createdAt
      });
    });

    // --------------------------------------------------
    // 5. ALL RAW MATERIAL STOCK
    // --------------------------------------------------

    const allMaterials = await RawMaterial.find({})
      .sort({ name: 1 })
      .lean();

    console.log("\n--- ALL RAW MATERIAL STOCK ---");

    console.table(
      allMaterials.map(item => ({
        id: item._id.toString(),
        name: item.name,
        sku: item.sku,
        currentStockMl: item.currentStockMl,
        currentCycleWastageMl: item.currentCycleWastageMl,
        isStockOut: item.isStockOut
      }))
    );

    // --------------------------------------------------
    // 6. STOCK-OUT MATERIAL HISTORY
    // --------------------------------------------------

    console.log("\n--- STOCK-OUT MATERIALS ---");

    const stockOutMaterials = allMaterials.filter(
      item => item.isStockOut === true
    );

    const stockOutHistory = [];

    for (const material of stockOutMaterials) {
      const materialLogs = await InventoryLog.find({
        material: material._id
      })
        .sort({ createdAt: 1 })
        .lean();

      const history = {
        materialId: material._id.toString(),
        name: material.name,
        sku: material.sku,
        currentStockMl: material.currentStockMl,
        logs: materialLogs.map(log => ({
          id: log._id.toString(),
          reason: log.reason,
          changeQuantity: log.changeQuantity,
          notes: log.notes,
          createdAt: log.createdAt
        }))
      };

      stockOutHistory.push(history);

      console.log("\nMaterial:", material.name);
      console.log("SKU:", material.sku);
      console.log("Current stock:", material.currentStockMl);

      console.table(
        history.logs.map(log => ({
          id: log.id,
          reason: log.reason,
          changeQuantity: log.changeQuantity,
          notes: log.notes,
          createdAt: log.createdAt
        }))
      );
    }

    // --------------------------------------------------
    // 7. EXPENSE-RELATED TRANSACTIONS
    // --------------------------------------------------

    console.log("\n--- WASTAGE EXPENSE TRANSACTIONS ---");

    const expenseTransactionReport = [];

    for (const expense of wastageExpenses) {
      const relatedTransactions = await Transaction.find({
        reference: expense._id,
        refModel: "Expense"
      }).lean();

      const report = {
        expenseId: expense._id.toString(),
        amount: expense.amount,
        transactionCount: relatedTransactions.length,
        transactions: relatedTransactions.map(tx => ({
          id: tx._id.toString(),
          category: tx.category,
          amount: tx.amount,
          reference: tx.reference?.toString?.() || tx.reference,
          refModel: tx.refModel
        }))
      };

      expenseTransactionReport.push(report);

      console.log("\nExpense:", report.expenseId);
      console.log("Amount:", report.amount);
      console.log("Related transactions:", report.transactionCount);
    }

    // --------------------------------------------------
    // 8. MULTIPLE WASTAGE LOGS PER MATERIAL
    // --------------------------------------------------

    console.log("\n--- MATERIALS WITH MULTIPLE WASTAGE LOGS ---");

    const groupedLogs = new Map();

    for (const log of wastageLogs) {
      if (!log.material) continue;

      const materialId = log.material.toString();

      if (!groupedLogs.has(materialId)) {
        groupedLogs.set(materialId, []);
      }

      groupedLogs.get(materialId).push(log);
    }

    const repeatedWastageLogs = [];

    for (const [materialId, materialLogs] of groupedLogs.entries()) {
      if (materialLogs.length > 1) {
        const material = allMaterials.find(
          item => item._id.toString() === materialId
        );

        const report = {
          materialId,
          materialName: material?.name || "Unknown",
          sku: material?.sku || "",
          count: materialLogs.length,
          logs: materialLogs.map(log => ({
            id: log._id.toString(),
            changeQuantity: log.changeQuantity,
            notes: log.notes,
            createdAt: log.createdAt
          }))
        };

        repeatedWastageLogs.push(report);

        console.log("\nMaterial:", report.materialName);
        console.table(report.logs);
      }
    }

    // --------------------------------------------------
    // 9. PREPARE COMPLETE JSON AUDIT REPORT
    // --------------------------------------------------

    const auditReport = {
      database: DB_NAME,
      auditDate: new Date().toISOString(),
      mode: "READ_ONLY",

      summary: {
        totalWastageExpenses: wastageExpenses.length,
        totalWastageLogs: wastageLogs.length,
        totalMaterials: allMaterials.length,
        totalStockOutMaterials: stockOutMaterials.length,
        totalExpenseAmount: Number(totalExpense.toFixed(2)),
        totalWastageMl: Number(totalWastageMl.toFixed(3))
      },

      wastageExpenses: wastageExpenses.map(item => ({
        ...item,
        _id: item._id.toString(),
        material: item.material?.toString?.() || item.material || null
      })),

      wastageLogs: wastageLogs.map(item => ({
        ...item,
        _id: item._id.toString(),
        material: item.material?.toString?.() || item.material || null
      })),

      rawMaterials: allMaterials.map(item => ({
        ...item,
        _id: item._id.toString()
      })),

      stockOutHistory,
      expenseTransactions: expenseTransactionReport,
      repeatedWastageLogs
    };

    // --------------------------------------------------
    // 10. EXPORT JSON REPORT
    // --------------------------------------------------

    const reportFile = path.join(
      outputDir,
      `wastage-audit-${timestamp}.json`
    );

    fs.writeFileSync(
      reportFile,
      JSON.stringify(auditReport, null, 2)
    );

    console.log("\n======================================");
    console.log(" AUDIT COMPLETED");
    console.log("======================================");

    console.log("Expenses inspected:", wastageExpenses.length);
    console.log("Inventory logs inspected:", wastageLogs.length);
    console.log("Materials inspected:", allMaterials.length);

    console.log("\n✅ JSON report exported:");
    console.log(reportFile);

    console.log("\n⚠️ No database records were modified.");

  } catch (error) {
    console.error("\n❌ WASTAGE AUDIT FAILED");
    console.error(error);
    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB.");
  }
}

reconcileWastage();
