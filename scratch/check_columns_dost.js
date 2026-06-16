const { Client } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dost_logbook',
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tbldocuments';
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
