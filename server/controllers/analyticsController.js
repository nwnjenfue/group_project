const db = require('../config/db');
const { logAudit } = require('../services/schemaService');

const num = (v) => v === null || v === undefined ? null : Number(v);
const pct = (v) => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;

async function latestImport(datasetType) {
  const { rows } = await db.query(`SELECT * FROM data_imports WHERE dataset_type=$1 AND status='completed' ORDER BY created_at DESC LIMIT 1`, [datasetType]);
  return rows[0] || null;
}

function buildSummaryWhere(query, params) {
  const where = ['s.import_id = $1'];
  const push = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  const q = String(query.q || '').trim();
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where.push(`(s.oked_code ILIKE $${idx} OR s.activity ILIKE $${idx})`);
  }
  const filters = [
    ['s.oked_code = ?', query.oked],
    ['s.activity ILIKE ?', query.activity ? `%${query.activity}%` : null],
    ['s.territory ILIKE ?', query.territory ? `%${query.territory}%` : null],
    ['s.period_label ILIKE ?', query.period ? `%${query.period}%` : null],
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
    const latest = await latestImport('summary');
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
    const { rows } = await db.query(`SELECT id, oked_code AS "код_окэд", activity AS "вид_деятельности", employees AS "средняя_численность_работников", payroll AS "Сумма по полю ФОТ", average_salary AS "Сумма_по_полю_ср_зп", taxes AS "сумма_налогов", share AS "удельный_вес", territory, period_label FROM data_snapshots s WHERE ${where.join(' AND ')} ORDER BY ${order} ${direction} NULLS LAST LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ data: rows, total: count.rows[0].total, page, pageSize, import: { id: latest.id, period: latest.period_label, territory: latest.territory, createdAt: latest.created_at } });
  } catch (error) {
    console.error('[analytics/data]', error);
    res.status(500).json({ message: 'Не удалось получить данные', error: error.message });
  }
}

async function overview(req, res) {
  try {
    const latest = await latestImport('summary');
    if (!latest) return res.json({ import: null, metrics: {}, topActivities: [], alerts: [] });
    const params = [latest.id];
    const where = buildSummaryWhere(req.query, params);
    const aggregate = await db.query(`SELECT COUNT(*)::int organizations, COALESCE(SUM(employees),0) employees, COALESCE(SUM(payroll),0) payroll, COALESCE(AVG(average_salary) FILTER (WHERE average_salary>0),0) average_salary, COALESCE(SUM(taxes),0) taxes FROM data_snapshots s WHERE ${where.join(' AND ')}`, params);
    const top = await db.query(`SELECT oked_code "oked", activity, employees, payroll, average_salary, taxes FROM data_snapshots s WHERE ${where.join(' AND ')} ORDER BY payroll DESC NULLS LAST LIMIT 10`, params);
    const base = aggregate.rows[0];
    res.json({ import: { id: latest.id, period: latest.period_label, territory: latest.territory, createdAt: latest.created_at }, metrics: { organizations: num(base.organizations), employees: num(base.employees), payroll: num(base.payroll), averageSalary: num(base.average_salary), taxes: num(base.taxes) }, topActivities: top.rows });
  } catch (error) { res.status(500).json({ message: 'Ошибка аналитики', error: error.message }); }
}

async function scenarios(req, res) {
  try {
    const latest = await latestImport('summary');
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
  } catch (error) { res.status(500).json({ message: 'Ошибка сценария', error: error.message }); }
}

async function relatedActivity(req, res) {
  try {
    const latest = await latestImport('detail');
    if (!latest) return res.json([]);
    const { rows } = await db.query(`SELECT id,oked_code "Код ОКЭД",activity "ОКЭД",company_bin "ИИН/БИН",company_name "Наименование",employees "Ср.числ",payroll "ФОТ",average_salary "Ср.зп",taxes "Налоги",period_label,territory FROM data_snapshots WHERE import_id=$1 AND activity ILIKE $2 ORDER BY payroll DESC NULLS LAST LIMIT 500`, [latest.id, req.params.activity]);
    res.json(rows);
  } catch (error) { res.status(500).json({ message: 'Ошибка связанных данных', error: error.message }); }
}

async function companyProfile(req, res) {
  try {
    const bin = String(req.params.bin).trim();
    const { rows } = await db.query(`
      SELECT s.*, i.created_at import_created_at
      FROM data_snapshots s
      JOIN data_imports i ON i.id=s.import_id
      WHERE s.dataset_type='detail' AND s.company_bin=$1
      ORDER BY i.created_at ASC
    `, [bin]);
    if (!rows.length) return res.status(404).json({ message: 'Компания не найдена' });

    const byImport = new Map();
    for (const r of rows) {
      const key = r.import_id;
      if (!byImport.has(key)) byImport.set(key, { period: r.period_label, importedAt: r.import_created_at, name: r.company_name, employees: 0, payroll: 0, taxes: 0, salaryNumerator: 0, salaryWeight: 0, oked: r.oked_code, activity: r.activity, territory: r.territory });
      const x = byImport.get(key);
      // Для нескольких ОКЭД одной компании зарплата считается взвешенно; численность — максимум, чтобы не складывать одну и ту же численность по видам деятельности.
      x.employees = Math.max(Number(x.employees || 0), Number(r.employees || 0));
      x.payroll += Number(r.payroll || 0);
      x.taxes += Number(r.taxes || 0);
      const salary = Number(r.average_salary || 0);
      const weight = Number(r.employees || 0);
      if (salary > 0 && weight > 0) { x.salaryNumerator += salary * weight; x.salaryWeight += weight; }
      if (!x.name && r.company_name) x.name = r.company_name;
    }
    const history = [...byImport.values()].map(x => ({ ...x, averageSalary: x.salaryWeight ? x.salaryNumerator / x.salaryWeight : 0 }));
    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const change = (current, old) => old ? pct((current - old) / old * 100) : null;
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
    res.json({ company: { bin, name: latest.name, oked: latest.oked, activity: latest.activity, territory: latest.territory }, current: { employees: latest.employees, payroll: latest.payroll, averageSalary: latest.averageSalary, taxes: latest.taxes }, changes, riskScore: score, riskFactors, history: history.map(r => ({ period: r.period, importedAt: r.importedAt, employees: r.employees, payroll: r.payroll, averageSalary: r.averageSalary, taxes: r.taxes })) });
  } catch (error) { res.status(500).json({ message: 'Ошибка профиля компании', error: error.message }); }
}

async function alerts(req, res) {
  try {
    const latest = await latestImport('detail');
    if (!latest) return res.json({ data: [], count: 0 });
    const { rows } = await db.query(`SELECT company_bin,company_name,oked_code,activity,employees,payroll,average_salary,taxes,period_label FROM data_snapshots WHERE import_id=$1`, [latest.id]);
    const values = rows.filter(r => Number(r.average_salary)>0).map(r => Number(r.average_salary)).sort((a,b)=>a-b);
    const median = values.length ? values[Math.floor(values.length/2)] : 0;
    const result = [];
    for (const r of rows) {
      const factors = [];
      if (Number(r.payroll)>0 && Number(r.taxes||0)===0) factors.push('ФОТ > 0 при нулевых налогах');
      if (median && Number(r.average_salary)>median*2) factors.push('Средняя зарплата более чем в 2 раза выше медианы набора');
      if (median && Number(r.average_salary)>0 && Number(r.average_salary)<median*0.5) factors.push('Средняя зарплата менее половины медианы набора');
      if (Number(r.employees)>0 && Number(r.payroll)>0 && Number(r.average_salary)>0) {
        const implied = Number(r.average_salary)*Number(r.employees)*12;
        const ratio = implied ? Number(r.payroll)/implied : 1;
        if (ratio > 1.8 || ratio < 0.45) factors.push('ФОТ существенно расходится с расчетным уровнем по численности и средней зарплате');
      }
      if (factors.length) result.push({ ...r, risk: factors.length > 1 ? 'high' : 'medium', factors });
    }
    res.json({ count: result.length, data: result.slice(0, 100) });
  } catch (error) { res.status(500).json({ message: 'Ошибка проверки аномалий', error: error.message }); }
}

async function imports(req, res) {
  try {
    const { rows } = await db.query(`SELECT id,dataset_type,original_filename,period_label,territory,row_count,valid_rows,invalid_rows,status,created_at,completed_at FROM data_imports ORDER BY created_at DESC LIMIT 50`);
    res.json(rows);
  } catch (error) { res.status(500).json({ message: 'Ошибка истории загрузок', error: error.message }); }
}

module.exports = { getData, overview, scenarios, relatedActivity, companyProfile, alerts, imports };
