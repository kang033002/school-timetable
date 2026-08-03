const { pool } = require('./src/db/database'); 
pool.query("SELECT * FROM user_accounts WHERE school_id NOT IN (SELECT id FROM schools)").then(res => { 
  console.log('Orphans:', res.rows.length); 
  process.exit(0); 
}).catch(e => { console.error(e); process.exit(1); });
