const db = require('../config/db');
const XLSX = require('xlsx');
const { logAudit } = require('../services/schemaService');
const { selectImport } = require('../services/periodService');
const { buildSummaryWhere } = require('./analyticsController');
const { buildReport } = require('../services/reportService');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status=400) => Object.assign(new Error(message), {status});

async function reportRows(query) {
  if (!uuid.test(String(query.importId || ''))) throw fail('Выберите набор данных для отчета.');
  const imported = await selectImport('summary', query);
  const params = [imported.id];
  const where = buildSummaryWhere(query, params);
  const { rows } = await db.query('SELECT * FROM data_snapshots s WHERE '+where.join(' AND ')+' ORDER BY payroll DESC NULLS LAST, id', params);
  if (!rows.length) throw fail('По выбранным условиям нет данных для отчета.',404);
  return { imported, rows };
}
function errorResponse(res,error) {
  console.error('[export]',error.message);
  if (!res.headersSent) res.status(error.status || 500).json({message:error.status?error.message:'Не удалось сформировать отчет. Попробуйте ещё раз.'});
}
async function sendPdf(req,res,rows,imported,selected=false) {
  const filtered=Object.keys(req.query||{}).some(k=>k!=='importId' && req.query[k] !== '');
  const buffer=await buildReport(rows,imported,{selected,filtered});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename="efot-report.pdf"');
  res.send(buffer);
  await logAudit({userId:req.user?.id,action:selected?'EXPORT_SELECTED_PDF':'EXPORT_PDF',entityType:imported.dataset_type,entityId:imported.id,metadata:{rows:rows.length},ip:req.ip});
}
async function generatePdf(req,res) {
  try { const {imported,rows}=await reportRows(req.query); await sendPdf(req,res,rows,imported); }
  catch(error){errorResponse(res,error);}
}
async function generateSelectedPdf(req,res) {
  try {
    const ids = [...new Set(Array.isArray(req.body?.ids)?req.body.ids:[])];
    if(!ids.length)throw fail('Отметьте строки, которые нужно включить в PDF.');
    if(ids.length>1000)throw fail('Можно выбрать до 1000 строк. Для полного набора используйте «Скачать PDF».');
    if(ids.some(id=>typeof id!=='string'||!uuid.test(id)))throw fail('Некорректный список выбранных записей.');
    if(!uuid.test(String(req.body.importId||'')))throw fail('Выберите набор данных для отчета.');
    const imported=await selectImport('summary',{importId:req.body.importId});
    const {rows}=await db.query('SELECT * FROM data_snapshots WHERE import_id=$1 AND id = ANY($2::uuid[]) ORDER BY payroll DESC NULLS LAST, id',[imported.id,ids]);
    if(rows.length!==ids.length)throw fail('Некоторые выбранные строки недоступны в этом наборе. Обновите таблицу и повторите выбор.',409);
    await sendPdf(req,res,rows,imported,true);
  }catch(error){errorResponse(res,error);}
}
async function generateDetailPdf(req,res) {
  try {
    if(!uuid.test(req.params.id))throw fail('Некорректная запись.');
    const {rows}=await db.query('SELECT * FROM data_snapshots WHERE id=$1',[req.params.id]);
    if(!rows.length)throw fail('Запись не найдена.',404);
    const imported=await selectImport('summary',{importId:rows[0].import_id});
    await sendPdf(req,res,rows,imported,true);
  }catch(error){errorResponse(res,error);}
}
async function generateExcel(req,res) {
  try {
    const {imported,rows}=await reportRows(req.query);
    const values=rows.map(r=>({'БИН/ИИН':r.company_bin,'Наименование':r.company_name,'Код ОКЭД':r.oked_code,'Вид деятельности':r.activity,'Численность':r.employees==null?null:Number(r.employees),'ФОТ':r.payroll==null?null:Number(r.payroll),'Средняя ЗП':r.average_salary==null?null:Number(r.average_salary),'Налоги':r.taxes==null?null:Number(r.taxes)}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(values),'eFOT');
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="efot-report.xlsx"');
    res.send(buffer);
    await logAudit({userId:req.user?.id,action:'EXPORT_EXCEL',entityType:imported.dataset_type,metadata:{rows:rows.length},ip:req.ip});
  }catch(error){errorResponse(res,error);}
}
module.exports={generatePdf,generateSelectedPdf,generateDetailPdf,generateExcel};
