const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ---------- CONFIG ----------
const INPUT_CSV = path.join(__dirname, 'sales-export-2026-08-22.csv');
const OUTPUT_EXCEL = path.join(__dirname, 'sales-split-6sheets.xlsx');
const NUM_SHEETS = 6;

// ---------- Read CSV ----------
if (!fs.existsSync(INPUT_CSV)) {
  console.error(`❌ Input file not found: ${INPUT_CSV}`);
  process.exit(1);
}

// Read CSV as array of objects
const workbook = XLSX.readFile(INPUT_CSV);
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

if (!data.length) {
  console.error('❌ CSV is empty or invalid.');
  process.exit(1);
}

console.log(`📄 Read ${data.length} rows from CSV.`);

// ---------- Split into 6 parts (evenly) ----------
const totalRows = data.length;
const rowsPerSheet = Math.ceil(totalRows / NUM_SHEETS);
const chunks = [];

for (let i = 0; i < NUM_SHEETS; i++) {
  const start = i * rowsPerSheet;
  const end = Math.min(start + rowsPerSheet, totalRows);
  if (start < totalRows) {
    chunks.push(data.slice(start, end));
  } else {
    chunks.push([]); // empty sheet
  }
}

// ---------- Write to Excel with 6 sheets ----------
const newWorkbook = XLSX.utils.book_new();

chunks.forEach((chunk, index) => {
  const sheetName = `Sheet${index + 1}`;
  const worksheet = XLSX.utils.json_to_sheet(chunk);
  XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);
  console.log(`📝 Sheet ${index + 1}: ${chunk.length} rows`);
});

XLSX.writeFile(newWorkbook, OUTPUT_EXCEL);
console.log(`✅ Saved to ${OUTPUT_EXCEL}`);
console.log('🎉 Done.');