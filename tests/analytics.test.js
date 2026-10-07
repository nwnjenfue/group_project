const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePeriod, canonicalImports, metrics, changes } = require('../server/services/analyticsMath');

test('year, quarter and leap-year month have correct boundaries', () => {
  assert.equal(parsePeriod('2026').months, 12);
  assert.deepEqual(parsePeriod('2026, 2 квартал'), {periodLabel:'2026, 2 квартал',periodStart:'2026-04-01',periodEnd:'2026-06-30',months:3,granularity:'quarter'});
  assert.equal(parsePeriod('февраль 2024').periodEnd, '2024-02-29');
  assert.equal(parsePeriod('2026-03').months, 1);
  assert.equal(parsePeriod('2026-13'), null);
  assert.equal(parsePeriod('2024-2026'), null);
  assert.equal(parsePeriod('за 9 месяцев 2026'), null);
  assert.equal(parsePeriod('неизвестно'), null);
});
test('historical order uses reporting period, latest revision wins only within same territory/type', () => {
  const imports = [
    {id:'old2026',period_label:'2026',created_at:'2026-01-01',dataset_type:'summary'},
    {id:'new2026',period_label:'2026',created_at:'2026-01-02',dataset_type:'summary'},
    {id:'late2024',period_label:'2024',created_at:'2026-02-01',dataset_type:'summary'},
    {id:'otherRegion',period_label:'2026',created_at:'2026-01-01',dataset_type:'summary',territory:'Other'},
    {id:'unknown',period_label:null,created_at:'2026-03-01',dataset_type:'summary'}
  ];
  const result=canonicalImports(imports);
  assert.equal(result[0].id,'new2026');
  assert.ok(!result.some(r=>r.id==='old2026'));
  assert.equal(result.length,4);
  assert.equal(result.at(-1).id,'unknown');
});
test('organization count is source count, salary uses employee-month exposure', () => {
  const rows=[{employees:10,payroll:3000,average_salary:999,taxes:0,raw_data:{'Количество НП':7}}, {employees:30,payroll:18000,average_salary:999,taxes:10,raw_data:{'Количество НП':8}}];
  const result=metrics(rows,{dataset_type:'summary',period_label:'2026, 1 квартал'});
  assert.equal(result.organizations,15);
  assert.equal(result.employees,40);
  assert.equal(result.averageSalary,175);
  assert.equal(result.salaryMethod,'payroll_per_employee_month');
});
test('unknown period uses weighted source salary; missing values are not zeros', () => {
  const result=metrics([{employees:10,average_salary:100},{employees:30,average_salary:200}],{dataset_type:'summary'});
  assert.equal(result.averageSalary,175);
  assert.equal(result.organizations,null);
  assert.equal(result.taxes,null);
  assert.equal(metrics([{employees:10}],{dataset_type:'summary'}).averageSalary,null);
  assert.equal(metrics([{employees:10,average_salary:0}],{dataset_type:'summary'}).averageSalary,0);
});
test('detail organizations deduplicate BIN, ambiguous employees do not yield fictitious salary', () => {
  const result=metrics([{company_bin:'1',employees:10,payroll:1000},{company_bin:'1',employees:10,payroll:2000}],{dataset_type:'detail',period_label:'2026'});
  assert.equal(result.organizations,1);
  assert.equal(result.employees,10);
  assert.equal(result.payroll,3000);
  assert.equal(result.averageSalary,null);
});
test('changes preserve absolute difference when baseline is zero', () => {
  assert.deepEqual(changes({payroll:100},{payroll:0}).payroll,{absolute:100,percent:null});
  assert.deepEqual(changes({payroll:140},{payroll:100}).payroll,{absolute:40,percent:40});
  assert.deepEqual(changes({payroll:null},{payroll:100}).payroll,{absolute:null,percent:null});
});
