const PDFDocument = require('pdfkit');
const path = require('path');
const { metrics } = require('./analyticsMath');
const value = n => n === null || n === undefined ? 'Нет данных' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

function buildReport(rows, imported, { selected = false, filtered = false } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true,
      info: { Title: 'eFOT — аналитический отчет', Author: 'eFOT' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      doc.registerFont('regular', path.join(__dirname, '../fonts/DejaVuSans.ttf'));
      doc.registerFont('bold', path.join(__dirname, '../fonts/DejaVuSans-Bold.ttf'));
      doc.font('bold').fontSize(21).fillColor('#145b78').text('eFOT / Аналитический отчет');
      doc.font('regular').fontSize(10).fillColor('#475569').moveDown(.5)
        .text(`Период: ${imported.period_label || 'не указан'}    Территория: ${imported.territory || 'не указана'}`)
        .text(`Состав: ${selected ? 'выбранные записи' : filtered ? 'поиск и фильтры таблицы' : 'весь набор'} · Записей: ${rows.length} · Сформирован: ${new Date().toLocaleDateString('ru-RU')}`);
      const totals = metrics(rows, imported);
      doc.moveDown().font('bold').fontSize(10).fillColor('#0f172a')
        .text(`Организации${imported.dataset_type === 'summary' ? ' (сумма НП)' : ' (уникальные БИН)'}: ${value(totals.organizations)}    Работники: ${value(totals.employees)}    ФОТ: ${value(totals.payroll)} ₸`)
        .text(`Средняя зарплата: ${value(totals.averageSalary)} ₸    Налоги: ${value(totals.taxes)} ₸`);
      doc.font('regular').fontSize(8).fillColor('#64748b');
      [...new Set(totals.warnings)].forEach(w => doc.text(w));
      doc.moveDown();
      const detail = imported.dataset_type === 'detail';
      const widths = [30, 90, 230, 80, 115, 110, doc.page.width - 72 - 655];
      const headings = ['№', detail ? 'БИН / ИИН' : 'ОКЭД', detail ? 'Компания / деятельность' : 'Вид деятельности', 'Работники', 'ФОТ, ₸', 'Средняя ЗП, ₸', 'Налоги, ₸'];
      const left = 36;
      const bottom = doc.page.height - 48;
      const header = () => {
        const y = doc.y;
        doc.rect(left, y, doc.page.width - 72, 28).fill('#145b78');
        let x = left;
        doc.font('bold').fontSize(8).fillColor('white');
        headings.forEach((h,i) => { doc.text(h,x+5,y+8,{width:widths[i]-10,lineBreak:false}); x+=widths[i]; });
        doc.y=y+28;
      };
      if(doc.y>bottom-80)doc.addPage();
      header();
      rows.forEach((r,index) => {
        const cells = [String(index+1), detail ? r.company_bin || '—' : r.oked_code || '—', detail ? [r.company_name || 'Без названия', r.activity].filter(Boolean).join('\n') : r.activity || '—',value(r.employees),value(r.payroll),value(r.average_salary),value(r.taxes)];
        doc.font('regular').fontSize(8);
        const height=Math.max(30,...cells.map((s,i)=>doc.heightOfString(s,{width:widths[i]-10})+14));
        if(doc.y+height>bottom){doc.addPage();header();doc.font('regular').fontSize(8);}
        const y=doc.y;
        doc.rect(left,y,doc.page.width-72,height).fill(index%2?'#f1f5f9':'#ffffff');
        let x=left;
        cells.forEach((s,i)=>{doc.fillColor('#1e293b').text(s,x+5,y+7,{width:widths[i]-10,align:i>2?'right':'left'});x+=widths[i];});
        doc.y=y+height;
      });
      const pages=doc.bufferedPageRange();
      for(let i=0;i<pages.count;i++){
        doc.switchToPage(i);
        doc.page.margins.bottom=0;
        doc.font('regular').fontSize(8).fillColor('#64748b').text(`eFOT · ${rows.length} записей`,36,doc.page.height-27,{lineBreak:false});
        doc.text(`Страница ${i+1} из ${pages.count}`,doc.page.width-180,doc.page.height-27,{width:144,align:'right',lineBreak:false});
      }
      doc.end();
    }catch(error){doc.destroy();reject(error);}
  });
}
module.exports = { buildReport };
