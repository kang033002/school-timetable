const { pool } = require('./src/db/database');
async function cleanup() {
  try {
    await pool.query("DELETE FROM user_accounts WHERE status = 'REJECTED'");
    await pool.query("DELETE FROM schools WHERE status = 'REJECTED'");
    console.log('Cleanup complete');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
cleanup();
