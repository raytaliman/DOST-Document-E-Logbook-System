const { Pool } = require('./node_modules/pg');
const dotenv = require('./node_modules/dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT DISTINCT documentdirection FROM tbldocuments');
    console.log("Distinct documentdirection values in DB:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
