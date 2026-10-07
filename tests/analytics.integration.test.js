// Uses session-local PostgreSQL tables and rolls back all test records.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({path: require('path').join(__dirname,'../server/.env')});
const db = require('../server/config/db');
const analytics = require('../server/controllers/analyticsController');

test('PostgreSQL: periods, revision replacement, overview, history, company and missing detail', async () => {
  const client = await db.connect();
  const originalQuery = db.query;
  db.query = client.query.bind(client);
  try {
    await client.query('BEGIN');
    for (const table of ['data_imports','data_snapshots','audit_logs']) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const addImport = async (type, period, created, territory='Test region') => {
      const id=randomUUID();
      await client.query("INSERT INTO data_imports(id,dataset_type,original_filename,period_label,territory,status,created_at) VALUES($1,$2,'test.xlsx',$3,$4,'completed',$5)",[id,type,period,territory,created]);
      return id;
    };
    const addRow = async (id,type,payroll,employees=10) => client.query(`INSERT INTO data_snapshots(id,import_id,dataset_type,oked_code,activity,company_bin,company_name,employees,payroll,average_salary,taxes,raw_data)
      VALUES($1,$2,$3,'01','Test activity','000000000001','Synthetic company',$4,$5,100,0,$6)`,[randomUUID(),id,type,employees,payroll,JSON.stringify({'Количество НП':17})]);
    const old=await addImport('summary','2026','2026-01-01'); await addRow(old,'summary',99999);
    const latest=await addImport('summary','2026','2026-02-01'); await addRow(latest,'summary',24000);
    const older=await addImport('summary','2024','2026-03-01'); await addRow(older,'summary',12000);
    const quarter=await addImport('summary','2026, 1 квартал','2026-04-01'); await addRow(quarter,'summary',6000);
    const detailOld=await addImport('detail','2026','2026-01-01'); await addRow(detailOld,'detail',99999);
    const detailNew=await addImport('detail','2026','2026-02-01'); await addRow(detailNew,'detail',24000);
    const detail2024=await addImport('detail','2024','2026-03-01'); await addRow(detail2024,'detail',12000);
    const invoke = async (handler,query={},params={}) => {
      let status=200,body;
      await handler({query,params,user:{},ip:'127.0.0.1'}, {status(n){status=n;return this;},json(value){body=value;return this;}});
      return {status,body};
    };
    const list=await invoke(analytics.periods);
    assert.equal(list.status,200);
    assert.equal(list.body.filter(i=>i.datasetType==='summary').length,3);
    assert.equal(list.body.filter(i=>i.datasetType==='detail').length,2);
    assert.equal(list.body[0].id,latest);
    assert.ok(!list.body.some(i=>i.id===old));
    const overview=await invoke(analytics.overview,{importId:latest});
    assert.equal(overview.body.metrics.organizations,17);
    assert.equal(overview.body.metrics.averageSalary,200);
    const trend=await invoke(analytics.history,{importId:latest,compareImportId:older});
    assert.deepEqual(trend.body.data.map(i=>i.period),['2024','2026']);
    assert.deepEqual(trend.body.comparison.changes.payroll,{absolute:12000,percent:100});
    assert.equal((await invoke(analytics.history,{importId:latest,compareImportId:quarter})).status,400);
    const company=await invoke(analytics.companyProfile,{importId:latest},{bin:'000000000001'});
    assert.equal(company.status,200);
    assert.equal(company.body.current.payroll,24000);
    assert.deepEqual(company.body.history.map(h=>h.period),['2024','2026']);
    assert.equal(company.body.changes.payroll,100);
    assert.equal((await invoke(analytics.companyProfile,{importId:older},{bin:'000000000001'})).body.history.length,1);
    assert.deepEqual((await invoke(analytics.relatedActivity,{importId:quarter},{activity:'Test activity'})).body,[]);
    assert.equal((await invoke(analytics.getData,{importId:older})).body.data[0]['Сумма по полю ФОТ'],'12000.00');
    // Reproduce a fresh installation with only a detailed Excel upload.
    await client.query("DELETE FROM data_snapshots WHERE dataset_type='summary'");
    await client.query("DELETE FROM data_imports WHERE dataset_type='summary'");
    const unperioded=await addImport('detail',null,'2026-05-01');
    await addRow(unperioded,'detail',3000);
    const details=await invoke(analytics.periods);
    assert.ok(details.body.some(i=>i.id===unperioded && i.datasetType==='detail' && i.granularity==='unknown'));
    const detailOverview=await invoke(analytics.overview,{importId:unperioded});
    assert.equal(detailOverview.status,200);
    assert.equal(detailOverview.body.metrics.organizations,1);
    assert.equal(detailOverview.body.metrics.payroll,3000);
    const detailRows=await invoke(analytics.getData,{importId:unperioded,q:'000000000001'});
    assert.equal(detailRows.body.total,1);
    assert.equal(detailRows.body.data[0].company_name,'Synthetic company');
    assert.equal((await invoke(analytics.history,{importId:unperioded})).body.data.length,1);
    assert.equal((await invoke(analytics.companyProfile,{importId:unperioded},{bin:'000000000001'})).status,200);
    assert.equal((await invoke(analytics.alerts,{importId:unperioded})).status,200);
  } finally {
    await client.query('ROLLBACK');
    db.query=originalQuery;
    client.release();
    await db.end();
  }
});
