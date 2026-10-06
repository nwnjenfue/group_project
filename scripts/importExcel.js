require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const path = require('path');
const { analyzeFile, importFile } = require('../server/services/importService');
const { ensureAnalyticsSchema } = require('../server/services/schemaService');
const db = require('../server/config/db');
const { sequelize } = require('../server/models');

async function main() {
  await sequelize.sync();
  await ensureAnalyticsSchema();
  const input = process.argv[2];
  const files = input ? [input] : fs.readdirSync(path.join(__dirname, '..', 'otchety')).filter(f => /\.(xlsx|xls)$/i.test(f)).map(f => path.join(__dirname, '..', 'otchety', f));
  if (!files.length) throw new Error('Excel-файлы не найдены');
  for (const file of files) {
    console.log('\nФайл:', file);
    console.log('Распознавание:', await analyzeFile(file));
    console.log('Импорт:', await importFile({ filePath: file, originalFilename: path.basename(file), userId: null, ip: 'cli' }));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { await sequelize.close(); await db.end(); });
