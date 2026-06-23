const { pool } = require('../db/pool');

module.exports = (app, io) => {
  // Helper to find affected documents and update them progressively
  const recalculateAffectedDocs = async (dates) => {
    if (!dates || dates.length === 0) return;
    
    try {
      // Find all affected documents whose dates sent/released cover the targeted dates
      const query = `
        SELECT DISTINCT documentid FROM tbldocuments
        WHERE datereleased IS NOT NULL AND datereleased <> '-' AND datereleased <> ''
          AND datesent::date <= ANY($1::date[])
          AND (
            CASE 
              WHEN datereleased LIKE '%at%' THEN
                TO_TIMESTAMP(datereleased, 'FMMonth DD, YYYY "at" HH12:MI AM')::date
              ELSE
                TO_TIMESTAMP(datereleased, 'FMMonth DD, YYYY')::date
            END
          ) >= ANY($1::date[])
      `;
      const res = await pool.query(query, [dates]);
      const affectedIds = res.rows.map(r => r.documentid);
      const total = affectedIds.length;

      if (total === 0) {
        if (io) io.emit('recalc_progress', { current: 0, total: 0 });
        return;
      }

      // Update documents one by one and emit progress
      for (let i = 0; i < total; i++) {
        await pool.query('UPDATE tbldocuments SET datesent = datesent WHERE documentid = $1', [affectedIds[i]]);
        if (io) {
          io.emit('recalc_progress', { current: i + 1, total });
        }
        // Small delay to make the progression visible
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      if (io) io.emit('documents_updated');
    } catch (error) {
      console.error('Error recalculating affected documents:', error);
    }
  };

  // Get all holidays
  app.get('/api/holidays', async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT holidayid, TO_CHAR(holidaydate, 'YYYY-MM-DD') AS holidaydate, holidayname FROM tblholidays ORDER BY holidaydate ASC"
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching non-office days:', error);
      res.status(500).json({ error: 'Failed to fetch non-office days', message: error.message });
    }
  });

  // Create a new holiday
  app.post('/api/holidays', async (req, res) => {
    const { holidaydate, holidayname } = req.body;

    if (!holidaydate) {
      return res.status(400).json({ error: 'Non-office day date is required' });
    }
    if (!holidayname || !holidayname.trim()) {
      return res.status(400).json({ error: 'Non-office day description/name is required' });
    }

    try {
      // Check if holiday date already exists
      const existingRes = await pool.query('SELECT * FROM tblholidays WHERE holidaydate = $1', [holidaydate]);
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'A non-office day on this date already exists' });
      }

      const result = await pool.query(
        'INSERT INTO tblholidays (holidaydate, holidayname) VALUES ($1, $2) RETURNING *',
        [holidaydate, holidayname.trim()]
      );

      // Recalculate working days and days processed for affected documents
      await recalculateAffectedDocs([holidaydate]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Failed to create non-office day:', error);
      res.status(500).json({ error: 'Failed to create non-office day', message: error.message });
    }
  });

  // Delete a holiday
  app.delete('/api/holidays/:id', async (req, res) => {
    const { id } = req.params;

    try {
      // Fetch the holidaydate first before deleting so we know what range was affected
      const preRes = await pool.query('SELECT TO_CHAR(holidaydate, \'YYYY-MM-DD\') AS holidaydate FROM tblholidays WHERE holidayid = $1', [parseInt(id, 10)]);
      if (preRes.rows.length === 0) {
        return res.status(404).json({ error: 'Non-office day not found' });
      }
      const deletedDate = preRes.rows[0].holidaydate;

      const result = await pool.query(
        'DELETE FROM tblholidays WHERE holidayid = $1 RETURNING *',
        [parseInt(id, 10)]
      );

      // Recalculate working days and days processed for affected documents
      await recalculateAffectedDocs([deletedDate]);

      res.json({ message: 'Non-office day deleted successfully', holiday: result.rows[0] });
    } catch (error) {
      console.error('Error deleting non-office day:', error);
      res.status(500).json({ error: 'Failed to delete non-office day', message: error.message });
    }
  });

  // Update a holiday
  app.put('/api/holidays/:id', async (req, res) => {
    const { id } = req.params;
    const { holidaydate, holidayname } = req.body;

    if (!holidaydate) {
      return res.status(400).json({ error: 'Non-office day date is required' });
    }
    if (!holidayname || !holidayname.trim()) {
      return res.status(400).json({ error: 'Non-office day description/name is required' });
    }

    try {
      // Fetch the old date first
      const preRes = await pool.query('SELECT TO_CHAR(holidaydate, \'YYYY-MM-DD\') AS holidaydate FROM tblholidays WHERE holidayid = $1', [parseInt(id, 10)]);
      if (preRes.rows.length === 0) {
        return res.status(404).json({ error: 'Non-office day not found' });
      }
      const oldDate = preRes.rows[0].holidaydate;

      // Check if another holiday on the new date already exists
      const existingRes = await pool.query(
        'SELECT * FROM tblholidays WHERE holidaydate = $1 AND holidayid <> $2',
        [holidaydate, parseInt(id, 10)]
      );
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'A non-office day on this date already exists' });
      }

      const result = await pool.query(
        'UPDATE tblholidays SET holidaydate = $1, holidayname = $2 WHERE holidayid = $3 RETURNING *',
        [holidaydate, holidayname.trim(), parseInt(id, 10)]
      );

      // Recalculate working days and days processed for affected documents (both old and new dates)
      await recalculateAffectedDocs([oldDate, holidaydate]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating non-office day:', error);
      res.status(500).json({ error: 'Failed to update non-office day', message: error.message });
    }
  });
};
