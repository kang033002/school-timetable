const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT * FROM teachers WHERE name LIKE '%강영환%' OR name LIKE '%박주연%' OR name LIKE '%마가연%' OR name LIKE '%김문희%' OR name LIKE '%정성%' OR name LIKE '%차일영%'", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.end();
});
