require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const db = require('../server/config/db');
(async()=>{try{const a=await db.query('SELECT COUNT(*)::int AS count FROM "Сводная"');const b=await db.query('SELECT COUNT(*)::int AS count FROM data_snapshots');console.log({svodnaya:a.rows[0].count,snapshots:b.rows[0].count});}catch(e){console.error(e.message);process.exitCode=1}finally{await db.end()}})();
