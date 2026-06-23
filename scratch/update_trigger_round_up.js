const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dost_logbook',
});

const sql = `
CREATE OR REPLACE FUNCTION calculate_network_days()
RETURNS TRIGGER AS $$
DECLARE
  start_date TIMESTAMPTZ;
  end_date TIMESTAMPTZ;
  v_office_hours NUMERIC;
  v_working_hours NUMERIC;
  d_dow INTEGER;
BEGIN
  -- Parse the start and end dates
  start_date := NEW.datesent;

  IF NEW.datereleased IS NULL OR NEW.datereleased = '-' OR NEW.datereleased = '' THEN
    NEW.calcnetworkdays := 0;
    NEW.daysprocessed := 0.00;
    RETURN NEW;
  END IF;

  BEGIN
    end_date := (TO_TIMESTAMP(NEW.datereleased, 'FMMonth DD, YYYY "at" HH12:MI AM')::timestamp) AT TIME ZONE 'Asia/Manila';
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      end_date := (TO_TIMESTAMP(NEW.datereleased, 'FMMon DD, YYYY "at" HH12:MI AM')::timestamp) AT TIME ZONE 'Asia/Manila';
    EXCEPTION WHEN OTHERS THEN
      NEW.calcnetworkdays := 0;
      NEW.daysprocessed := 0.00;
      RETURN NEW;
    END;
  END;

  -- Calculate working days (Mon–Fri only) excluding holidays and optionally Fridays
  NEW.calcnetworkdays := GREATEST(
    (
      SELECT COUNT(*) FROM generate_series(
        (start_date AT TIME ZONE 'Asia/Manila')::date,
        (end_date AT TIME ZONE 'Asia/Manila')::date,
        INTERVAL '1 day'
      ) AS d(day)
      WHERE EXTRACT(DOW FROM d.day) BETWEEN 1 AND 5
      AND (EXTRACT(DOW FROM d.day) <> 5 OR COALESCE(NEW.include_friday, true) = true)
      AND d.day::date NOT IN (SELECT holidaydate::date FROM tblholidays)
    ),
    0
  );

  -- Retrieve office hours configuration
  SELECT COALESCE(settingvalue::numeric, 8.0) INTO v_office_hours 
  FROM tblsettings 
  WHERE settingkey = 'office_hours_per_day';
  
  IF v_office_hours IS NULL OR v_office_hours <= 0 THEN
    v_office_hours := 8.0;
  END IF;

  -- Calculate working hours and set daysprocessed (passing include_friday)
  v_working_hours := calculate_working_hours(start_date, end_date, COALESCE(NEW.include_friday, true));
  
  -- If received and released on the same day (and it is a working day), daysprocessed should compute to 1
  d_dow := EXTRACT(DOW FROM (start_date AT TIME ZONE 'Asia/Manila'));
  IF (start_date AT TIME ZONE 'Asia/Manila')::date = (end_date AT TIME ZONE 'Asia/Manila')::date 
     AND d_dow BETWEEN 1 AND 5 
     AND (d_dow <> 5 OR COALESCE(NEW.include_friday, true) = true)
     AND (start_date AT TIME ZONE 'Asia/Manila')::date NOT IN (SELECT holidaydate::date FROM tblholidays) THEN
    v_working_hours := GREATEST(v_working_hours, v_office_hours);
  END IF;

  -- Round to nearest 0.5 step
  NEW.daysprocessed := GREATEST(
    ROUND((v_working_hours / v_office_hours) * 2.0) / 2.0,
    0.00
  );

  -- Option 1 rule: If the fractional part is exactly 0.5, round it up to the next whole day
  IF NEW.daysprocessed - FLOOR(NEW.daysprocessed) = 0.5 THEN
    NEW.daysprocessed := CEIL(NEW.daysprocessed);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Trigger function calculate_network_days updated (round up .5 fractional days)!");
    
    // Trigger update on all documents to recalculate
    await client.query("UPDATE tbldocuments SET dtsno = dtsno");
    console.log("Recalculated all documents successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
