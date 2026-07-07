const XLSX = require('xlsx');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, 'image-mapping.xlsx');

// Read the workbook
const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Add a new column 'imageFile' with empty values
const newData = data.map(row => ({
  ...row,
  imageFile: '' // <-- empty by default
}));

// Write back to the same file
const newSheet = XLSX.utils.json_to_sheet(newData);
workbook.Sheets[sheetName] = newSheet;
XLSX.writeFile(workbook, EXCEL_PATH);

console.log(`✅ Added 'imageFile' column to ${EXCEL_PATH}`);
console.log(`📊 Total rows: ${newData.length}`);
console.log(`📝 Now open the file and fill the 'imageFile' column with filenames.`);