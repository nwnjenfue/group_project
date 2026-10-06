require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { sequelize, User } = require('../server/models');

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !email || !password) throw new Error('Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before running init-admin.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  await sequelize.sync();
  const [admin, created] = await User.findOrCreate({ where: { username }, defaults: { email, password, role: 'admin', isBlocked: false } });
  if (!created) { admin.email = email; admin.role = 'admin'; admin.isBlocked = false; admin.password = password; await admin.save(); }
  console.log(`Admin ready: ${admin.username} (${admin.email})`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>sequelize.close());
