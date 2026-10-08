const db = require('../config/db');
const { logAudit } = require('../services/schemaService');
const math = require('../services/analyticsMath');
const { availableImports, selectImport, matchingDetail } = require('../services/periodService');

const pct = (v) => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;


function buildSummaryWhere(query, params) {
  const where = ['s.import_id = $1'];
  const push = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  const q = String(query.q || '').trim();
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where.push(`(s.oked_code ILIKE $${idx} OR s.activity ILIKE $${idx} OR s.company_bin ILIKE $${idx} OR s.company_name ILIKE $${idx})`);
  }
  const filters = [
    ['s.oked_code = ?', query.oked],
    ['s.activity ILIKE ?', query.activity ? `%${query.activity}%` : null],
    ['s.territory ILIKE ?', query.territory ? `%${query.territory}%` : null],
  ];
  for (const [sql, value] of filters) if (value !== null && value !== undefined && value !== '') push(sql, value);
  const ranges = [
    ['s.employees >= ?', query.employeesMin], ['s.employees <= ?', query.employeesMax],
    ['s.payroll >= ?', query.payrollMin], ['s.payroll <= ?', query.payrollMax],
    ['s.average_salary >= ?', query.salaryMin], ['s.average_salary <= ?', query.salaryMax],
    ['s.taxes >= ?', query.taxesMin], ['s.taxes <= ?', query.taxesMax],
  ];
  for (const [sql, raw] of ranges) {
    if (raw !== undefined && raw !== '') {
      const value = Number(raw);
      if (Number.isFinite(value)) push(sql, value);
    }
  }
  return where;
}

async function getData(req, res) {
  try {
    const latest = await selectImport('summary', req.query);
    if (!latest) return res.json({ data: [], total: 0, page: 1, pageSize: 25, import: null });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(10, Number(req.query.pageSize) || 25));
    const params = [latest.id];
    const where = buildSummaryWhere(req.query, params);
    const count = await db.query(`SELECT COUNT(*)::int AS total FROM data_snapshots s WHERE ${where.join(' AND ')}`, params);
    const orderMap = { employees: 'employees', payroll: 'payroll', salary: 'average_salary', taxes: 'taxes', activity: 'activity', oked: 'oked_code' };
    const order = orderMap[req.query.sortBy] || 'oked_code';
    const direction = String(req.query.sortDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await db.query(`SELECT id, company_bin, company_name, oked_code AS "код_окэд", activity AS "вид_деятельности", employees AS "средняя_численность_работников", payroll AS "Сумма по полю ФОТ", average_salary AS "Сумма_по_полю_ср_зп", taxes AS "сумма_налогов", share AS "удельный_вес", territory, period_label FROM data_snapshots s WHERE ${where.join(' AND ')} ORDER BY ${order} ${direction} NULLS LAST LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ data: rows, total: count.rows[0].total, page, pageSize, import: { id: latest.id, datasetType: latest.dataset_type, period: latest.period_label, territory: latest.territory, createdAt: latest.created_at } });
  } catch (error) {
    console.error('[analytics/data]', error);
    res.status(error.status || 500).json({ message: 'Не удалось получить данные', error: error.message });
  }
}

async function overview(req, res) {
  try {
    const latest = await selectImport('summary', req.query);
    if (!latest) return res.json({ import: null, metrics: {}, topActivities: [], alerts: [] });
    const params = [latest.id];
    const where = buildSummaryWhere(req.query, params);
    const aggregate = await db.query(`SELECT * FROM data_snapshots s WHERE ${where.join(' AND ')}`, params);
    const top = await db.query(`SELECT oked_code "oked", COALESCE(company_name, activity) activity, employees, payroll, average_salary, taxes FROM data_snapshots s WHERE ${where.join(' AND ')} ORDER BY payroll DESC NULLS LAST LIMIT 10`, params);
    res.json({ import: { id: latest.id, datasetType: latest.dataset_type, period: latest.period?.periodLabel || latest.period_label, territory: latest.territory, createdAt: latest.created_at }, metrics: math.metrics(aggregate.rows, latest), topActivities: top.rows });
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка аналитики', error: error.message }); }
}

async function scenarios(req, res) {
  try {
    const latest = await selectImport('summary', req.query);
    if (!latest) return res.json({ scenario: req.query.scenario || 'all', count: 0, data: [] });
    const scenario = req.query.scenario || 'all';
    const params = [latest.id];
    let condition = '';
    if (scenario === 'tax_zero') condition = 'AND COALESCE(taxes,0)=0 AND COALESCE(payroll,0)>0';
    else if (scenario === 'high_salary') condition = 'AND average_salary > (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY average_salary) FROM data_snapshots WHERE import_id=$1 AND average_salary>0)';
    else if (scenario === 'low_salary') condition = 'AND average_salary > 0 AND average_salary < (SELECT percentile_cont(0.1) WITHIN GROUP (ORDER BY average_salary) FROM data_snapshots WHERE import_id=$1 AND average_salary>0)';
    else if (scenario === 'high_payroll') condition = 'AND payroll > (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY payroll) FROM data_snapshots WHERE import_id=$1 AND payroll>0)';
    else if (scenario === 'low_workforce') condition = 'AND employees > 0 AND employees < (SELECT percentile_cont(0.1) WITHIN GROUP (ORDER BY employees) FROM data_snapshots WHERE import_id=$1 AND employees>0)';
    else condition = '';
    const { rows } = await db.query(`SELECT id,oked_code "oked",activity,employees,payroll,average_salary,taxes,share,territory FROM data_snapshots WHERE import_id=$1 ${condition} ORDER BY payroll DESC NULLS LAST LIMIT 100`, params);
    res.json({ scenario, count: rows.length, data: rows });
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка сценария', error: error.message }); }
}

async function relatedActivity(req, res) {
  try {
    const latest = await matchingDetail(req.query);
    if (!latest) return res.json([]);
    const { rows } = await db.query(`SELECT id,oked_code "Код ОКЭД",activity "ОКЭД",company_bin "ИИН/БИН",company_name "Наименование",employees "Ср.числ",payroll "ФОТ",average_salary "Ср.зп",taxes "Налоги",period_label,territory FROM data_snapshots WHERE import_id=$1 AND activity ILIKE $2 ORDER BY payroll DESC NULLS LAST LIMIT 500`, [latest.id, req.params.activity]);
    res.json(rows);
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка связанных данных', error: error.message }); }
}

async function companyProfile(req, res) {
  try {
    const bin = String(req.params.bin).trim();
    const { rows } = await db.query(`
      SELECT s.*, i.created_at import_created_at
      FROM data_snapshots s
      JOIN data_imports i ON i.id=s.import_id
      WHERE s.dataset_type='detail' AND s.company_bin=$1 AND i.status='completed'
      ORDER BY i.created_at ASC
    `, [bin]);
    if (!rows.length) return res.status(404).json({ message: 'Компания не найдена' });

    const selected = await matchingDetail(req.query);
    if (!selected) return res.status(404).json({ message: 'Нет детальных данных за выбранный период' });
    const all = await availableImports('detail');
    const relevant = all.filter(i => (i.territory || '') === (selected.territory || '') &&
      (selected.period ? i.period?.granularity === selected.period.granularity && i.period.periodEnd <= selected.period.periodEnd : i.id === selected.id));
    const history = relevant.slice().reverse().map(item => {
      const records = rows.filter(r => r.import_id === item.id);
      if (!records.length) return null;
      const first = records[0];
      return { ...math.metrics(records, item), period: item.period?.periodLabel || item.period_label, importId: item.id,
        importedAt: item.created_at, name: first.company_name, oked: first.oked_code, activity: first.activity, territory: item.territory };
    }).filter(Boolean);
    const latest = history.find(h => h.importId === selected.id);
    if (!latest) return res.status(404).json({ message: 'Компания отсутствует в выбранном периоде' });
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const change = (current, old) => current != null && old != null && old !== 0 ? pct((current - old) / Math.abs(old) * 100) : null;
    const changes = previous ? {
      employees: change(latest.employees, previous.employees),
      payroll: change(latest.payroll, previous.payroll),
      averageSalary: change(latest.averageSalary, previous.averageSalary),
      taxes: change(latest.taxes, previous.taxes),
    } : null;
    const riskFactors = [];
    if (changes?.payroll != null && changes.payroll > 40 && changes.employees != null && changes.employees < 10) riskFactors.push({ code: 'PAYROLL_GROWTH', severity: 'high', message: `ФОТ вырос на ${changes.payroll}%, а численность почти не изменилась.` });
    if (changes?.employees != null && changes.employees < -20) riskFactors.push({ code: 'WORKFORCE_DROP', severity: 'high', message: `Численность снизилась на ${Math.abs(changes.employees)}%.` });
    if (latest.payroll > 0 && latest.taxes === 0) riskFactors.push({ code: 'ZERO_TAX', severity: 'medium', message: 'Зафиксирован ФОТ при нулевом значении налоговых отчислений в текущем наборе.' });
    if (changes?.averageSalary != null && Math.abs(changes.averageSalary) > 40) riskFactors.push({ code: 'SALARY_CHANGE', severity: 'medium', message: `Средняя зарплата изменилась на ${changes.averageSalary}%.` });
    const score = Math.min(100, riskFactors.reduce((s, f) => s + (f.severity === 'high' ? 30 : 15), 0));
    await logAudit({ userId: req.user?.id, action: 'VIEW_COMPANY', entityType: 'company', entityId: bin, metadata: { riskScore: score }, ip: req.ip });
    res.json({ company: { bin, name: latest.name, oked: latest.oked, activity: latest.activity, territory: latest.territory }, current: latest, changes, absoluteChanges: math.changes(latest, previous), riskScore: score, riskFactors, history });
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка профиля компании', error: error.message }); }
}

async function alerts(req, res) {
  try {
    const latest = await matchingDetail(req.query);
    if (!latest) return res.json({ data: [], count: 0 });
    const { rows } = await db.query(`SELECT * FROM data_snapshots WHERE import_id=$1`, [latest.id]);
    const values = rows.filter(r => Number(r.average_salary)>0).map(r => Number(r.average_salary)).sort((a,b)=>a-b);
    const median = values.length ? values[Math.floor(values.length/2)] : 0;
    const result = [];
    for (const r of rows) {
      const factors = [];
      if (Number(r.payroll)>0 && r.taxes !== null && Number(r.taxes)===0) factors.push('ФОТ > 0 при нулевых налогах');
      if (median && Number(r.average_salary)>median*2) factors.push('Средняя зарплата более чем в 2 раза выше медианы набора');
      if (median && Number(r.average_salary)>0 && Number(r.average_salary)<median*0.5) factors.push('Средняя зарплата менее половины медианы набора');
      if (Number(r.employees)>0 && Number(r.payroll)>0 && Number(r.average_salary)>0) {
        const months = math.rawNumber(r, ['сколько месяцев','количество месяцев']) ?? latest.period?.months;
        const implied = months > 0 ? Number(r.average_salary)*Number(r.employees)*months : null;
        const ratio = implied ? Number(r.payroll)/implied : 1;
        if (ratio > 1.8 || ratio < 0.45) factors.push('ФОТ существенно расходится с расчетным уровнем по численности и средней зарплате');
      }
      if (factors.length) result.push({ ...r, risk: factors.length > 1 ? 'high' : 'medium', factors });
    }
    res.json({ count: result.length, data: result.slice(0, 100) });
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка проверки аномалий', error: error.message }); }
}

async function imports(req, res) {
  try {
    const { rows } = await db.query(`SELECT id,dataset_type,original_filename,period_label,territory,row_count,valid_rows,invalid_rows,status,created_at,completed_at FROM data_imports ORDER BY created_at DESC LIMIT 50`);
    res.json(rows);
  } catch (error) { res.status(error.status || 500).json({ message: 'Ошибка истории загрузок', error: error.message }); }
}

async function periods(req, res) {
  try {
    const all = [...await availableImports('summary'), ...await availableImports('detail')];
    all.sort((a,b) => (b.period?.periodEnd || '').localeCompare(a.period?.periodEnd || '') || new Date(b.created_at) - new Date(a.created_at));
    res.json(all.map(i => ({ id: i.id, datasetType: i.dataset_type, filename: i.original_filename, rows: i.valid_rows, label: i.period?.periodLabel || i.period_label || 'Период не указан', territory: i.territory, granularity: i.period?.granularity || 'unknown', start: i.period?.periodStart, end: i.period?.periodEnd, createdAt: i.created_at })));
  }
  catch (error) { res.status(error.status || 500).json({ message: error.message }); }
}
async function history(req, res) {
  try {
    const selected = await selectImport('summary', req.query);
    if (!selected) return res.json({ data: [], comparison: null });
    const all = await availableImports(selected.dataset_type);
    const comparable = all.filter(i => (i.territory || '') === (selected.territory || '') &&
      (selected.period ? i.period?.granularity === selected.period.granularity : i.id === selected.id));
    const data = [];
    for (const item of comparable.slice().reverse()) {
      const params = [item.id];
      const where = buildSummaryWhere(req.query, params);
      const { rows } = await db.query(`SELECT * FROM data_snapshots s WHERE ${where.join(' AND ')}`, params);
      data.push({ importId: item.id, period: item.period?.periodLabel || item.period_label || 'Период не указан', ...math.metrics(rows, item) });
    }
    const current = data.find(i => i.importId === selected.id);
    const baseline = req.query.compareImportId ? data.find(i => i.importId === req.query.compareImportId) : data[data.indexOf(current) - 1];
    if (req.query.compareImportId && !baseline) return res.status(400).json({ message: 'Для сравнения выберите тот же регион и длительность периода.' });
    res.json({ data, comparison: baseline && baseline !== current ? { period: baseline.period, changes: math.changes(current, baseline) } : null });
  } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
}
module.exports = { getData, overview, scenarios, relatedActivity, companyProfile, alerts, imports, periods, history, buildSummaryWhere };
