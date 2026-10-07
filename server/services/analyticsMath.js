// Pure analytical rules, shared by the API, importer and regression tests.
const number = value => value === null || value === undefined || value === '' ? null :
  (Number.isFinite(Number(String(value).replace(/\s/g, '').replace(',', '.'))) ? Number(String(value).replace(/\s/g, '').replace(',', '.')) : null);
const normalize = value => String(value).toLowerCase().replace(/ё/g, 'е').replace(/[\s_\-\/().,:;]+/g, ' ').trim();
function rawNumber(row, names) {
  const entry = Object.entries(row.raw_data || {}).find(([key]) => names.includes(normalize(key)));
  return entry ? number(entry[1]) : null;
}

function parsePeriod(value) {
  const text = String(value || '').toLowerCase();
  const year = text.match(/(?:^|[^\d])((?:19|20)\d{2})(?!\d)/)?.[1];
  if (!year || /(?:19|20)\d{2}\s*[-/]\s*(?:19|20)\d{2}/.test(text)) return null;
  if (/(?:19|20)\d{2}[-/.]\d/.test(text) && !/(?:19|20)\d{2}[-/.](0?[1-9]|1[0-2])(?:$|[^\d])/.test(text)) return null;
  if (/\d+\s*месяц/.test(text) || /полугод/.test(text)) return null;
  const quarters = [...text.matchAll(/([1-4])\s*(?:квартал|кв\b)|q([1-4])/g)];
  if (quarters.length > 1) return null;
  if (/квартал/.test(text) && !quarters.length) return null;
  const quarter = quarters.length ? Number(quarters[0][1] || quarters[0][2]) : null;
  const monthNames = ['январ','феврал','март','апрел','ма[йя]','июн','июл','август','сентябр','октябр','ноябр','декабр'];
  const namedMonths = monthNames.map((name, i) => new RegExp(name).test(text) ? i + 1 : null).filter(Boolean);
  const isoMonth = text.match(/(?:19|20)\d{2}[-/.](0?[1-9]|1[0-2])(?:$|[^\d])/);
  const month = isoMonth ? Number(isoMonth[1]) : namedMonths.length === 1 ? namedMonths[0] : null;
  if (namedMonths.length > 1 || (quarter && month)) return null;
  const startMonth = quarter ? (quarter - 1) * 3 + 1 : month || 1;
  const months = quarter ? 3 : month ? 1 : 12;
  const endMonth = startMonth + months - 1;
  const pad = n => String(n).padStart(2, '0');
  return { periodLabel: quarter ? `${year}, ${quarter} квартал` : month ? `${year}-${pad(month)}` : year,
    periodStart: `${year}-${pad(startMonth)}-01`,
    periodEnd: `${year}-${pad(endMonth)}-${new Date(Date.UTC(Number(year), endMonth, 0)).getUTCDate()}`,
    months, granularity: quarter ? 'quarter' : month ? 'month' : 'year' };
}

function importPeriod(item) {
  // Old importer stored year boundaries even for quarter labels. Prefer the label.
  return parsePeriod(item.period_label);
}
function canonicalImports(imports) {
  const newest = new Map();
  for (const item of [...imports].sort((a,b) => String(b.created_at instanceof Date ? b.created_at.toISOString() : b.created_at).localeCompare(String(a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at)) || String(b.id).localeCompare(String(a.id)))) {
    const period = importPeriod(item);
    const key = JSON.stringify([item.dataset_type, item.territory || '', period?.periodStart || item.period_label || item.id, period?.periodEnd || '']);
    if (!newest.has(key)) newest.set(key, { ...item, period });
  }
  return [...newest.values()].sort((a,b) => (b.period?.periodEnd || '').localeCompare(a.period?.periodEnd || '') || (b.period?.periodStart || '').localeCompare(a.period?.periodStart || '') || new Date(b.created_at) - new Date(a.created_at));
}
function sumKnown(rows, field) {
  const values = rows.map(row => number(row[field])).filter(v => v !== null);
  return values.length ? values.reduce((a,b) => a+b, 0) : null;
}
function metrics(rows, item) {
  const warnings = [];
  if (item.dataset_type === 'detail') {
    const groups = new Map();
    for (const row of rows) {
      const key = row.company_bin || row.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    rows = [...groups.values()].map(group => {
      if (group.length === 1) return group[0];
      warnings.push('Компания имеет несколько строк ОКЭД: численность принята по максимуму; средняя зарплата не рассчитывается без распределения работников.');
      const workforce = group.map(r => number(r.employees)).filter(v => v !== null);
      return { ...group[0], employees: workforce.length ? Math.max(...workforce) : null, payroll: sumKnown(group,'payroll'), taxes: sumKnown(group,'taxes'), average_salary: null, ambiguousEmployees: true };
    });
  }
  const counts = rows.map(row => number(row.organization_count) ?? rawNumber(row, ['количество нп','кол во нп','количество налогоплательщиков','количество организаций']));
  const organizations = item.dataset_type === 'detail' ? new Set(rows.map(r => r.company_bin).filter(Boolean)).size :
    rows.length && counts.every(v => v !== null && v >= 0) ? counts.reduce((a,b) => a+b, 0) : null;
  if (organizations === null) warnings.push('Количество организаций отсутствует в исходных данных.');
  if (item.dataset_type === 'summary' && organizations !== null) warnings.push('Организации: сумма исходного количества НП по ОКЭД; уникальность между ОКЭД не подтверждена.');
  const period = importPeriod(item);
  const employed = rows.filter(r => number(r.employees) > 0);
  let averageSalary = null;
  let salaryMethod = 'unavailable';
  if (employed.length && employed.every(r => !r.ambiguousEmployees && number(r.payroll) !== null && (number(r.months) ?? rawNumber(r, ['сколько месяцев','количество месяцев']) ?? period?.months) > 0)) {
    let exposure = 0;
    for (const row of employed) exposure += number(row.employees) * (number(row.months) ?? rawNumber(row, ['сколько месяцев','количество месяцев']) ?? period.months);
    averageSalary = sumKnown(employed, 'payroll') / exposure;
    salaryMethod = 'payroll_per_employee_month';
  } else if (employed.length && employed.every(r => number(r.average_salary) !== null)) {
    averageSalary = employed.reduce((sum,r) => sum + number(r.average_salary)*number(r.employees), 0) / sumKnown(employed, 'employees');
    salaryMethod = 'employee_weighted_source_salary';
  }
  if (averageSalary === null) warnings.push('Недостаточно данных для средней зарплаты.');
  if (rows.some(r => ['employees','payroll','taxes'].some(field => number(r[field]) === null))) warnings.push('Часть исходных значений отсутствует: суммы рассчитаны только по заполненным значениям.');
  return { organizations, employees: sumKnown(rows,'employees'), payroll: sumKnown(rows,'payroll'), averageSalary, taxes: sumKnown(rows,'taxes'), salaryMethod, warnings };
}
function changes(current, previous) {
  return Object.fromEntries(['organizations','employees','payroll','averageSalary','taxes'].map(key => {
    const a = number(current?.[key]), b = number(previous?.[key]);
    return [key, { absolute: a === null || b === null ? null : a-b, percent: a === null || b === null || b === 0 ? null : Math.round((a-b)/Math.abs(b)*1000)/10 }];
  }));
}
module.exports = { number, rawNumber, parsePeriod, importPeriod, canonicalImports, metrics, changes, sumKnown };
