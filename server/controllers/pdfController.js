const PDFDocument = require('pdfkit');
const db = require('../config/db');
const XLSX = require('xlsx');
const { logAudit } = require('../services/schemaService');

const money = v => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(v || 0));
const latestImport = async () => (await db.query(`SELECT * FROM data_imports WHERE dataset_type='summary' AND status='completed' ORDER BY created_at DESC LIMIT 1`)).rows[0];

function createDoc(res, title) {
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: title, Author: 'eFOT' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="efot-report-${Date.now()}.pdf"`);
  doc.pipe(res);
  return doc;
}

async function generatePdf(req, res) {
  try {
    const latest = await latestImport();
    if (!latest) return res.status(404).json({ message: 'Нет загруженного набора данных' });
    const { rows } = await db.query(`SELECT oked_code,activity,employees,payroll,average_salary,taxes FROM data_snapshots WHERE import_id=$1 ORDER BY payroll DESC NULLS LAST`, [latest.id]);
    const doc = createDoc(res, 'eFOT — аналитический отчет');
    doc.fontSize(20).text('eFOT — аналитический отчет');
    doc.moveDown(0.5).fontSize(10).fillColor('#555').text(`Период: ${latest.period_label || 'не определен'} | Территория: ${latest.territory || 'не определена'}`);
    doc.moveDown().fillColor('#000');
    const totals = rows.reduce((a, r) => ({ org: a.org + 1, emp: a.emp + Number(r.employees || 0), payroll: a.payroll + Number(r.payroll || 0), taxes: a.taxes + Number(r.taxes || 0) }), { org: 0, emp: 0, payroll: 0, taxes: 0 });
    doc.fontSize(12).text(`Организаций: ${totals.org}    Работников: ${money(totals.emp)}    ФОТ: ${money(totals.payroll)}    Налоги: ${money(totals.taxes)}`);
    doc.moveDown();
    doc.fontSize(13).text('Основные показатели');
    doc.moveDown(0.3).fontSize(8);
    rows.slice(0, 35).forEach((r, i) => {
      if (doc.y > 760) doc.addPage();
      doc.text(`${i + 1}. ${String(r.oked_code || '')} — ${String(r.activity || '').slice(0, 70)}`);
      doc.text(`   Численность: ${money(r.employees)} | ФОТ: ${money(r.payroll)} | Ср. ЗП: ${money(r.average_salary)} | Налоги: ${money(r.taxes)}`);
      doc.moveDown(0.25);
    });
    doc.end();
    await logAudit({ userId: req.user?.id, action: 'EXPORT_PDF', entityType: 'summary', metadata: { rows: rows.length }, ip: req.ip });
  } catch (error) { console.error('[pdf]', error); if (!res.headersSent) res.status(500).json({ message: 'Ошибка формирования PDF', error: error.message }); }
}

async function generateDetailPdf(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM data_snapshots WHERE id=$1 LIMIT 1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Запись не найдена' });
    const r = rows[0];
    const doc = createDoc(res, 'eFOT — запись');
    doc.fontSize(20).text('eFOT — профиль записи');
    doc.moveDown();
    doc.fontSize(12).text(`ОКЭД: ${r.oked_code || '—'}`);
    doc.text(`Вид деятельности: ${r.activity || '—'}`);
    doc.text(`Территория: ${r.territory || '—'}`);
    doc.text(`Период: ${r.period_label || '—'}`);
    doc.moveDown();
    doc.text(`Численность: ${money(r.employees)}`);
    doc.text(`ФОТ: ${money(r.payroll)}`);
    doc.text(`Средняя ЗП: ${money(r.average_salary)}`);
    doc.text(`Налоги: ${money(r.taxes)}`);
    doc.end();
  } catch (error) { if (!res.headersSent) res.status(500).json({ message: 'Ошибка PDF', error: error.message }); }
}

async function generateSelectedPdf(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ message: 'Не выбраны записи' });
    const { rows } = await db.query(`SELECT * FROM data_snapshots WHERE id = ANY($1::uuid[]) ORDER BY payroll DESC NULLS LAST`, [ids]);
    const doc = createDoc(res, 'eFOT — выбранные записи');
    doc.fontSize(18).text('eFOT — выбранные записи').moveDown();
    rows.forEach((r, i) => { if (doc.y > 740) doc.addPage(); doc.fontSize(10).text(`${i + 1}. ${r.oked_code || ''} — ${r.activity || ''}`); doc.text(`Численность: ${money(r.employees)} | ФОТ: ${money(r.payroll)} | Ср. ЗП: ${money(r.average_salary)} | Налоги: ${money(r.taxes)}`).moveDown(0.5); });
    doc.end();
    await logAudit({ userId: req.user?.id, action: 'EXPORT_SELECTED_PDF', entityType: 'summary', metadata: { count: rows.length }, ip: req.ip });
  } catch (error) { if (!res.headersSent) res.status(500).json({ message: 'Ошибка PDF', error: error.message }); }
}



async function generateExcel(req, res) {
  try {
    const latest = await latestImport();
    if (!latest) return res.status(404).json({ message: 'Нет загруженного набора данных' });
    const { rows } = await db.query(`SELECT oked_code AS "Код ОКЭД",activity AS "Вид деятельности",employees AS "Численность",payroll AS "ФОТ",average_salary AS "Средняя ЗП",taxes AS "Налоги",share AS "Удельный вес" FROM data_snapshots WHERE import_id=$1 ORDER BY payroll DESC NULLS LAST`, [latest.id]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'eFOT');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="efot-report-${Date.now()}.xlsx"`);
    res.end(buffer);
    await logAudit({ userId: req.user?.id, action: 'EXPORT_EXCEL', entityType: 'summary', metadata: { rows: rows.length }, ip: req.ip });
  } catch (error) { if (!res.headersSent) res.status(500).json({ message: 'Ошибка формирования Excel', error: error.message }); }
}

module.exports = { generatePdf, generateDetailPdf, generateSelectedPdf, generateExcel };
