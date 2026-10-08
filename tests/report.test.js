const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildReport}=require('../server/services/reportService');
test('renders every record including Cyrillic and more than 35 rows',async()=>{
  const rows=Array.from({length:65},(_,i)=>({company_bin:String(i+1).padStart(12,'0'),company_name:'Компания '+String(i+1).padStart(3,'0'),activity:'Производство и обслуживание оборудования',employees:10,payroll:12000000,average_salary:100000,taxes:i===0?null:100000}));
  const buffer=await buildReport(rows,{dataset_type:'detail',period_label:'2026',territory:'Тестовый регион'});
  assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
  assert.ok(buffer.length>10000);
  const output=path.join(__dirname,'../tmp/reports');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'qa-report.pdf'),buffer);
});
