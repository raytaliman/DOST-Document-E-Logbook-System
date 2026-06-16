-- Enums
CREATE TYPE user_type AS ENUM ('admin', 'superadmin');
CREATE TYPE route_enum AS ENUM ('Accounting Unit', 'ORD', 'For Compliance');
CREATE TYPE time_enum AS ENUM ('AM', 'PM', 'PM Late');
CREATE TYPE documentdirection_enum AS ENUM ('incoming', 'outgoing', 'all');

-- Tables
CREATE TABLE tbladmin (
  adminid SERIAL PRIMARY KEY,
  adminname VARCHAR(30) UNIQUE NOT NULL,
  adminemail VARCHAR(30) UNIQUE NOT NULL,
  adminpass VARCHAR(20) NOT NULL,
  usertype user_type NOT NULL,
  documentdirection documentdirection_enum,
  datecreated DATE DEFAULT CURRENT_DATE,
  archivedate VARCHAR(50),
  isarchive BOOLEAN DEFAULT FALSE
);

CREATE TABLE tbldocumenttype (
  documentid SERIAL PRIMARY KEY,
  documenttype VARCHAR(40)
);

CREATE TABLE tbldocuments (
  documentid SERIAL PRIMARY KEY,
  datesent TIMESTAMPTZ DEFAULT NOW(),
  dtsno VARCHAR(15) NOT NULL,
  documenttype VARCHAR(30) NOT NULL,
  datereleased VARCHAR(50),
  time time_enum,
  route route_enum,
  remarks TEXT,
  isarchive BOOLEAN,
  documentdirection documentdirection_enum,
  networkdaysremarks TEXT,
  deducteddays INTEGER DEFAULT 0,
  calcnetworkdays INTEGER DEFAULT 0,
  daysprocessed NUMERIC(10,2) DEFAULT 0.00,
  archivedate VARCHAR(50),
  archivedby VARCHAR(50)
);

CREATE TABLE tblholidays (
  holidayid SERIAL PRIMARY KEY,
  holidaydate DATE UNIQUE NOT NULL,
  holidayname VARCHAR(100) NOT NULL
);

-- Function to calculate working hours excluding weekends and holidays, and deducting lunch break (12:00 PM to 1:00 PM)
CREATE OR REPLACE FUNCTION calculate_working_hours(start_dt TIMESTAMPTZ, end_dt TIMESTAMPTZ)
RETURNS NUMERIC AS $$
DECLARE
  v_start TIMESTAMP;
  v_end TIMESTAMP;
  v_hours NUMERIC := 0.00;
  v_day DATE;
  v_day_start TIMESTAMP;
  v_day_end TIMESTAMP;
  v_work_start TIME := '08:00:00';
  v_work_end TIME := '17:00:00';
BEGIN
  -- Convert inputs to Asia/Manila clock time timestamps
  v_start := start_dt AT TIME ZONE 'Asia/Manila';
  v_end := end_dt AT TIME ZONE 'Asia/Manila';
  
  IF v_start IS NULL OR v_end IS NULL OR v_start > v_end THEN
    RETURN 0.00;
  END IF;

  FOR v_day IN SELECT d.day::date FROM generate_series(v_start::date, v_end::date, INTERVAL '1 day') AS d(day) LOOP
    -- Skip weekends (Saturday=6, Sunday=0) and holidays
    IF EXTRACT(DOW FROM v_day) BETWEEN 1 AND 5 AND v_day NOT IN (SELECT holidaydate::date FROM tblholidays) THEN
      v_day_start := v_day + v_work_start;
      v_day_end := v_day + v_work_end;
      
      DECLARE
        v_overlap_start TIMESTAMP;
        v_overlap_end TIMESTAMP;
        v_diff NUMERIC := 0.00;
      BEGIN
        v_overlap_start := GREATEST(v_start, v_day_start);
        v_overlap_end := LEAST(v_end, v_day_end);
        
        IF v_overlap_start < v_overlap_end THEN
          v_diff := EXTRACT(EPOCH FROM (v_overlap_end - v_overlap_start)) / 3600.0;
          
          -- Deduct 1 hour lunch break (12:00 PM to 1:00 PM) if overlap spans across the lunch break
          IF v_overlap_start < (v_day + TIME '12:00:00') AND v_overlap_end > (v_day + TIME '13:00:00') THEN
            v_diff := v_diff - 1.0;
          -- Handle partial overlaps with the lunch break
          ELSIF v_overlap_start >= (v_day + TIME '12:00:00') AND v_overlap_start < (v_day + TIME '13:00:00') THEN
            v_diff := v_diff - (EXTRACT(EPOCH FROM ((v_day + TIME '13:00:00') - v_overlap_start)) / 3600.0);
          ELSIF v_overlap_end > (v_day + TIME '12:00:00') AND v_overlap_end <= (v_day + TIME '13:00:00') THEN
            v_diff := v_diff - (EXTRACT(EPOCH FROM (v_overlap_end - (v_day + TIME '12:00:00'))) / 3600.0);
          END IF;
          
          v_hours := v_hours + GREATEST(0.00, v_diff);
        END IF;
      END;
    END IF;
  END LOOP;
  
  RETURN ROUND(v_hours, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate network days
CREATE OR REPLACE FUNCTION calculate_network_days()
RETURNS TRIGGER AS $$
DECLARE
  start_date TIMESTAMPTZ;
  end_date TIMESTAMPTZ;
  v_office_hours NUMERIC;
  v_working_hours NUMERIC;
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
    NEW.calcnetworkdays := 0;
    NEW.daysprocessed := 0.00;
    RETURN NEW;
  END;

  -- Calculate working days (Mon–Fri only) excluding holidays
  NEW.calcnetworkdays := GREATEST(
    (
      SELECT COUNT(*) FROM generate_series(
        (start_date AT TIME ZONE 'Asia/Manila')::date,
        (end_date AT TIME ZONE 'Asia/Manila')::date,
        INTERVAL '1 day'
      ) AS d(day)
      WHERE EXTRACT(DOW FROM d.day) BETWEEN 1 AND 5  -- 1=Monday, 5=Friday
      AND d.day::date NOT IN (SELECT holidaydate::date FROM tblholidays)
    ) - COALESCE(NEW.deducteddays, 0),
    0
  );

  -- Retrieve office hours configuration
  SELECT COALESCE(settingvalue::numeric, 8.0) INTO v_office_hours 
  FROM tblsettings 
  WHERE settingkey = 'office_hours_per_day';
  
  IF v_office_hours IS NULL OR v_office_hours <= 0 THEN
    v_office_hours := 8.0;
  END IF;

  -- Calculate working hours and set daysprocessed
  v_working_hours := calculate_working_hours(start_date, end_date);
  
  -- Round to nearest 0.5 step
  NEW.daysprocessed := GREATEST(
    ROUND(((v_working_hours / v_office_hours) - COALESCE(NEW.deducteddays, 0)) * 2.0) / 2.0,
    0.00
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before insert or update
CREATE TRIGGER trg_calculate_network_days
BEFORE INSERT OR UPDATE ON tbldocuments
FOR EACH ROW
EXECUTE FUNCTION calculate_network_days();

-- Initial data for tbladmin
INSERT INTO public.tbladmin (
    adminid, adminname, adminemail, adminpass, usertype, 
    documentdirection, datecreated, archivedate, isarchive
) VALUES 
(1, 'Sheriel Mae Gapasin', 'spgapasin@region1.dost.gov.ph', '123', 'admin', 'outgoing', '2025-06-22', NULL, false),
(2, 'John Louie Dalao', 'jadalao@region1.dost.gov.ph', '123', 'admin', 'incoming', '2025-06-22', NULL, false),
(3, 'Justin Madrid', 'jmadrid@region1.dost.gov.ph', '123', 'superadmin', 'all', '2025-06-22', NULL, false);

-- Initial data for tbldocumenttype
INSERT INTO public.tbldocumenttype (documenttype) VALUES 
('Disbursement Voucher'), 
('Payroll'), 
('Application for Leave'), 
('Budget or Activity Proposal');

-- Settings Table
CREATE TABLE tblsettings (
  settingid SERIAL PRIMARY KEY,
  settingkey VARCHAR(50) UNIQUE NOT NULL,
  settingvalue VARCHAR(100) NOT NULL
);

-- Initial settings data
INSERT INTO tblsettings (settingkey, settingvalue) VALUES 
('office_hours_per_day', '8')
ON CONFLICT (settingkey) DO NOTHING;