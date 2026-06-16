const { pool } = require('../db/pool');

module.exports = (app, io) => {
  // Get all holidays
  app.get('/api/holidays', async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT holidayid, TO_CHAR(holidaydate, 'YYYY-MM-DD') AS holidaydate, holidayname FROM tblholidays ORDER BY holidaydate ASC"
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      res.status(500).json({ error: 'Failed to fetch holidays', message: error.message });
    }
  });

  // Create a new holiday
  app.post('/api/holidays', async (req, res) => {
    const { holidaydate, holidayname } = req.body;

    if (!holidaydate) {
      return res.status(400).json({ error: 'Holiday date is required' });
    }
    if (!holidayname || !holidayname.trim()) {
      return res.status(400).json({ error: 'Holiday name is required' });
    }

    try {
      // Check if holiday date already exists
      const existingRes = await pool.query('SELECT * FROM tblholidays WHERE holidaydate = $1', [holidaydate]);
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'A holiday on this date already exists' });
      }

      const result = await pool.query(
        'INSERT INTO tblholidays (holidaydate, holidayname) VALUES ($1, $2) RETURNING *',
        [holidaydate, holidayname.trim()]
      );

      // Recalculate working days and days processed for all documents
      await pool.query('UPDATE tbldocuments SET datesent = datesent');
      if (io) io.emit('documents_updated');

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Failed to create holiday:', error);
      res.status(500).json({ error: 'Failed to create holiday', message: error.message });
    }
  });

  // Delete a holiday
  app.delete('/api/holidays/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        'DELETE FROM tblholidays WHERE holidayid = $1 RETURNING *',
        [parseInt(id, 10)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Holiday not found' });
      }

      // Recalculate working days and days processed for all documents
      await pool.query('UPDATE tbldocuments SET datesent = datesent');
      if (io) io.emit('documents_updated');

      res.json({ message: 'Holiday deleted successfully', holiday: result.rows[0] });
    } catch (error) {
      console.error('Error deleting holiday:', error);
      res.status(500).json({ error: 'Failed to delete holiday', message: error.message });
    }
  });
  // Update a holiday
  app.put('/api/holidays/:id', async (req, res) => {
    const { id } = req.params;
    const { holidaydate, holidayname } = req.body;

    if (!holidaydate) {
      return res.status(400).json({ error: 'Holiday date is required' });
    }
    if (!holidayname || !holidayname.trim()) {
      return res.status(400).json({ error: 'Holiday name is required' });
    }

    try {
      // Check if another holiday on the new date already exists
      const existingRes = await pool.query(
        'SELECT * FROM tblholidays WHERE holidaydate = $1 AND holidayid <> $2',
        [holidaydate, parseInt(id, 10)]
      );
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'A holiday on this date already exists' });
      }

      const result = await pool.query(
        'UPDATE tblholidays SET holidaydate = $1, holidayname = $2 WHERE holidayid = $3 RETURNING *',
        [holidaydate, holidayname.trim(), parseInt(id, 10)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Holiday not found' });
      }

      // Recalculate working days and days processed for all documents
      await pool.query('UPDATE tbldocuments SET datesent = datesent');
      if (io) io.emit('documents_updated');

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating holiday:', error);
      res.status(500).json({ error: 'Failed to update holiday', message: error.message });
    }
  });
};
