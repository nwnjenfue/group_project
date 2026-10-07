const db = require('../config/db');
const { canonicalImports } = require('./analyticsMath');

async function availableImports(type) {
  const { rows } = await db.query("SELECT * FROM data_imports WHERE dataset_type=$1 AND status='completed'", [type]);
  return canonicalImports(rows);
}
async function selectImport(type, query = {}) {
  // The dashboard accepts both summary and company-level workbooks.
  const primary = await availableImports(type);
  const all = type === 'summary' ? [...primary, ...await availableImports('detail')] : primary;
  if (query.importId) {
    const selected = all.find(item => item.id === query.importId);
    if (!selected) throw Object.assign(new Error('Набор не найден или заменен новой редакцией. Обновите список периодов.'), { status: 404 });
    return selected;
  }
  return all.find(item => (!query.period || item.period_label === query.period || item.period?.periodLabel === query.period) &&
    (!query.territory || item.territory === query.territory)) || null;
}
async function matchingDetail(query) {
  if (!query.importId) return selectImport('detail', query);
  const summary = await selectImport('summary', query);
  if (summary.dataset_type === 'detail') return summary;
  const all = await availableImports('detail');
  return all.find(item => (item.territory || '') === (summary.territory || '') &&
    (item.period?.periodLabel || item.period_label || '') === (summary.period?.periodLabel || summary.period_label || '')) || null;
}
module.exports = { availableImports, selectImport, matchingDetail };
