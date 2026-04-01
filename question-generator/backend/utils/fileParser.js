const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

// 解析不同文件类型提取文本
// 图片不需要在这里解析文字，直接转base64传给AI多模态
async function parseFile(filePath, mimeType) {
  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    return await parsePDF(filePath);
  } else if (ext === 'docx' || ext === 'doc') {
    return await parseWord(filePath);
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return await parseExcel(filePath);
  } else if (ext === 'txt') {
    return fs.readFileSync(filePath, 'utf-8');
  } else {
    throw new Error(`不支持的文件类型: ${ext}`);
  }
}

async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function parseWord(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  let text = '';
  
  // 遍历所有sheet
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    text += `=== Sheet: ${sheetName} ===\n`;
    json.forEach(row => {
      text += row.filter(cell => cell !== undefined).join('\t') + '\n';
    });
    text += '\n';
  });
  
  return text;
}

module.exports = { parseFile };
