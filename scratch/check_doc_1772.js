const { Client } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dost_logbook',
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT documentid, dtsno, datesent, datereleased, include_friday, calcnetworkdays, deducteddays, daysprocessed, documentdirection
    FROM tbldocuments 
    WHERE documentid = 1772;
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
