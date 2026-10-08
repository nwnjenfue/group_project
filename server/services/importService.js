const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { logAudit } = require('./schemaService');
const { parsePeriod } = require('./analyticsMath');

const FIELD_ALIASES = {
  oked_code: ['код окэд','код о к э д','окэд код','oked','oked code'],
  activity: ['вид деятельности','окэд','деятельность','вид деятельности окэд'],
  np_count: ['количество нп','кол во нп','количество налогоплательщиков','количество организаций'],
  employees: ['средняя численность работников','средняя численность','средняя числ работников'],
  employee_months: ['кол во чел','количество чел','количество человек'],
  average_employees: ['ср числ','ср.числ','средняя числ'],
  payroll: ['сумма по полю фот','фот','фонд оплаты труда','сумма фот'],
  average_salary: ['сумма по полю ср зп','сумма по полю ср.зп','ср зп','ср.зп','средняя зарплата'],
  ipn: ['ипн'],
  sn: ['сн'],
  taxes: ['сумма налогов','налоги','налоговые отчисления'],
  share: ['удельный вес','удельный вес %','доля'],
  company_bin: ['иин бин','иин/бин','бин','иин'],
  company_name: ['наименование','наименование организации','организация','компания'],
  tax_code: ['код ну'],
  months: ['сколько месяцев','количество месяцев'],
};

const normalizeHeader = (value) => String(value ?? '')
  .toLowerCase().replace(/ё/g, 'е').replace(/[\s_\-\/().,:;]+/g, ' ').trim();

const cleanText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/\s/g, '').replace(/,/g, '.').replace(/%/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function matchField(header) {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(alias => normalized === normalizeHeader(alias))) return field;
  }
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(alias => normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias)))) return field;
  }
  return null;
}

function findHeaderRow(matrix) {
  let best = { index: -1, score: 0, mapping: {} };
  matrix.slice(0, 25).forEach((row, index) => {
    const mapping = {};
    let score = 0;
    for (const cell of row) {
      const field = matchField(cell);
      if (field && !mapping[field]) { mapping[field] = cell; score += 1; }
    }
    if (score > best.score) best = { index, score, mapping };
  });
  return best;
}

function inferMetadata(matrix, filename, headerIndex = 0) {
  const text = matrix.slice(0, Math.max(1, Math.min(headerIndex, 10))).flat().filter(Boolean).map(cleanText).join(' | ');
  const territoryMatch = text.match(/(?:по|для)\s+(.{2,120}?(?:област[ьи]|район(?:а|у)?|города|город[ае]?))\b/i);
  const fileText = cleanText(path.basename(filename));
  const period = parsePeriod(text) || parsePeriod(fileText);
  return {
    periodLabel: period?.periodLabel || null,
    periodStart: period?.periodStart || null,
    periodEnd: period?.periodEnd || null,
    territory: territoryMatch?.[1]?.trim() || null,
  };
}

function detectType(mapping) {
  const keys = Object.keys(mapping);
  if (keys.includes('company_bin') && keys.includes('company_name') && keys.includes('payroll')) return 'detail';
  if (keys.includes('oked_code') && keys.includes('activity') && (keys.includes('np_count') || keys.includes('employees')) && keys.includes('payroll')) return 'summary';
  return 'unknown';
}

function isTotalSourceRow(row) {
  return row.some(value => /(?:^|\s)(?:общий\s+итог|итого)(?:\s|$)/i.test(cleanText(value)));
}

function parseWorkbook(filePath, originalFilename = filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: true });
  if (!workbook.SheetNames.length) throw new Error('В Excel нет листов');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });
  const header = findHeaderRow(matrix);
  if (header.index < 0 || header.score < 3) throw new Error('Не удалось определить строку заголовков. Проверьте структуру Excel.');
  const headers = matrix[header.index] || [];
  const mapping = {};
  headers.forEach((h, idx) => { const field = matchField(h); if (field && mapping[field] === undefined) mapping[field] = idx; });
  const datasetType = detectType(Object.fromEntries(Object.keys(mapping).map(k => [k, headers[mapping[k]]])));
  if (datasetType === 'unknown') throw new Error('Тип данных не определён. Нужны поля ОКЭД/деятельность/ФОТ для сводных данных или ОКЭД/ИИН-БИН/ФОТ/наименование для детальных данных.');
  const metadata = inferMetadata(matrix, originalFilename, header.index);
  const rowNumbers = [];
  const rows = matrix.slice(header.index + 1).filter((row, rowIndex) => {
    const hasData = row.some(v => v !== null && cleanText(v) !== '');
    if (hasData) rowNumbers.push(header.index + 2 + rowIndex);
    return hasData;
  });
  const monthlyEmployeeIndexes = datasetType === 'detail'
    ? headers.map((headerValue, index) => /^empl\s*\d+$/i.test(normalizeHeader(headerValue)) ? index : null).filter(index => index !== null)
    : [];
  const formulaErrors = rows.map((row, rowIndex) => {
    if (isTotalSourceRow(row)) return [];
    const excelRow = rowNumbers[rowIndex];
    return Object.entries(mapping).flatMap(([field, columnIndex]) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: excelRow - 1, c: columnIndex })];
      return cell?.t === 'e' ? [`Ошибка Excel в поле ${field}`] : [];
    });
  });
  return { workbook, sheetName, headerRow: header.index + 1, headers, mapping, datasetType, metadata, rows, rowNumbers, monthlyEmployeeIndexes, formulaErrors };
}

function mapRow(parsed, row) {
  const get = field => parsed.mapping[field] === undefined ? null : row[parsed.mapping[field]];
  const monthlyEmployees = (parsed.monthlyEmployeeIndexes || []).map(index => toNumber(row[index])).filter(value => value !== null);
  const derivedMonths = monthlyEmployees.length || null;
  const declaredMonths = toNumber(get('months'));
  const months = parsed.datasetType === 'detail' ? (derivedMonths ?? declaredMonths) : null;
  const employeeMonths = monthlyEmployees.length
    ? monthlyEmployees.reduce((sum, value) => sum + value, 0)
    : toNumber(get('employee_months'));
  const detailEmployees = parsed.datasetType === 'detail'
    ? (monthlyEmployees.length ? employeeMonths / derivedMonths : (toNumber(get('average_employees')) ?? (employeeMonths !== null && months > 0 ? employeeMonths / months : null)))
    : null;
  const common = {
    oked_code: cleanText(get('oked_code')) || null,
    activity: cleanText(get('activity')) || null,
    employees: parsed.datasetType === 'detail' ? detailEmployees : toNumber(get('employees')),
    payroll: toNumber(get('payroll')),
    average_salary: toNumber(get('average_salary')),
    taxes: toNumber(get('taxes')),
    share: toNumber(get('share')),
    company_bin: cleanText(get('company_bin')) || null,
    company_name: cleanText(get('company_name')) || null,
  };
  if (parsed.datasetType === 'summary') {
    return {
      ...common,
      np_count: toNumber(get('np_count')),
      ipn: toNumber(get('ipn')),
      sn: toNumber(get('sn')),
      raw: Object.fromEntries(parsed.headers.map((h, i) => [cleanText(h) || `column_${i+1}`, row[i] ?? null])),
    };
  }
  return {
    ...common,
    tax_code: cleanText(get('tax_code')) || null,
    months,
    raw: Object.fromEntries(parsed.headers.map((h, i) => [cleanText(h) || `column_${i+1}`, row[i] ?? null])),
  };
}

function validateRow(row, type) {
  const errors = [];
  if (!row.oked_code) errors.push('Нет кода ОКЭД');
  if (!row.activity) errors.push('Нет вида деятельности/ОКЭД');
  if (row.oked_code === '99999' || /(?:тест|test|демо|demo)/i.test(row.activity || '')) errors.push('Тестовая строка не допускается к импорту');
  if (type === 'detail') {
    if (!row.company_bin) errors.push('Нет ИИН/БИН');
    if (!row.company_name) errors.push('Нет наименования');
  }
  return errors;
}

async function analyzeFile(filePath, originalFilename = filePath) {
  const parsed = parseWorkbook(filePath, originalFilename);
  const sample = parsed.rows.slice(0, 5).map(row => mapRow(parsed, row));
  return {
    datasetType: parsed.datasetType,
    sheetName: parsed.sheetName,
    headerRow: parsed.headerRow,
    detectedColumns: Object.fromEntries(Object.entries(parsed.mapping).map(([k, idx]) => [k, parsed.headers[idx]])),
    metadata: parsed.metadata,
    totalRows: parsed.rows.length,
    formulaErrorRows: parsed.formulaErrors.filter(errors => errors.length).length,
    sample,
  };
}

async function importFile({ filePath, originalFilename, userId, ip, period, territory }) {
  const parsed = parseWorkbook(filePath, originalFilename);
  if (period) {
    const selected = parsePeriod(period);
    if (!selected) throw new Error('Укажите период: 2026, 2026-03 или 2026, 1 квартал.');
    Object.assign(parsed.metadata, selected);
  }
  if (territory) parsed.metadata.territory = cleanText(territory);
  const detectedColumns = Object.fromEntries(Object.entries(parsed.mapping).map(([k, idx]) => [k, parsed.headers[idx]]));
  const importId = uuidv4();
  const warnings = [];
  const rows = parsed.rows.map(row => mapRow(parsed, row));
  const valid = [];
  const invalid = [];
  rows.forEach((row, index) => {
    const errors = [...validateRow(row, parsed.datasetType), ...(parsed.formulaErrors[index] || [])];
    if (errors.length) invalid.push({ row: parsed.rowNumbers[index], errors, raw: row.raw });
    else valid.push(row);
  });
  if (!valid.length) throw new Error('В файле нет валидных строк после проверки.');
  if (invalid.length) warnings.push(`${invalid.length} строк не прошли обязательную проверку и не были импортированы.`);

  await db.query(`INSERT INTO data_imports (id,dataset_type,original_filename,period_label,period_start,period_end,territory,detected_columns,warnings,row_count,valid_rows,invalid_rows,status,imported_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'processing',$13)`, [
    importId, parsed.datasetType, originalFilename, parsed.metadata.periodLabel, parsed.metadata.periodStart, parsed.metadata.periodEnd,
    parsed.metadata.territory, JSON.stringify(detectedColumns), JSON.stringify(warnings), rows.length, valid.length, invalid.length, userId || null
  ]);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    if (parsed.datasetType === 'summary') {
      // Сводная — текущий рабочий срез. История хранится в data_snapshots.
      await client.query('DELETE FROM "Сводная"');
      for (const row of valid) {
        await client.query(`
          INSERT INTO "Сводная" (id,"код_окэд","вид_деятельности","количество_нп","средняя_численность_работников","Сумма по полю ФОТ","Сумма_по_полю_ср_зп","ИПН","СН","сумма_налогов","удельный_вес","createdAt","updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
          ON CONFLICT DO NOTHING`, [uuidv4(), row.oked_code, row.activity, row.np_count || 0, row.employees || 0, row.payroll || 0, row.average_salary || 0, row.ipn || 0, row.sn || 0, row.taxes || 0, row.share || 0]);
        await client.query(`INSERT INTO data_snapshots (id,import_id,dataset_type,period_label,territory,oked_code,activity,employees,payroll,average_salary,taxes,share,raw_data)
          VALUES ($1,$2,'summary',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [uuidv4(), importId, parsed.metadata.periodLabel, parsed.metadata.territory, row.oked_code, row.activity, row.employees, row.payroll, row.average_salary, row.taxes, row.share, JSON.stringify(row.raw)]);
      }
    } else {
      for (const row of valid) {
        await client.query(`INSERT INTO data_snapshots (id,import_id,dataset_type,period_label,territory,oked_code,activity,company_bin,company_name,employees,payroll,average_salary,taxes,raw_data)
          VALUES ($1,$2,'detail',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [uuidv4(), importId, parsed.metadata.periodLabel, parsed.metadata.territory, row.oked_code, row.activity, row.company_bin, row.company_name, row.employees, row.payroll, row.average_salary, row.taxes, JSON.stringify(row.raw)]);
      }
    }
    await client.query(`UPDATE data_imports SET status='completed', completed_at=NOW() WHERE id=$1`, [importId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await db.query(`UPDATE data_imports SET status='failed', warnings=warnings || $2::jsonb, completed_at=NOW() WHERE id=$1`, [importId, JSON.stringify([error.message])]);
    throw error;
  } finally { client.release(); }

  await logAudit({ userId, action: 'DATA_IMPORT', entityType: parsed.datasetType, entityId: importId, metadata: { filename: originalFilename, rows: valid.length }, ip });
  return { importId, datasetType: parsed.datasetType, period: parsed.metadata.periodLabel, territory: parsed.metadata.territory, rows: valid.length, skipped: invalid.length, detectedColumns };
}

module.exports = { analyzeFile, importFile, parseWorkbook, mapRow, validateRow };
