const { pool } = require('../db/pool');

module.exports = (app, io) => {
  // Get all payees
  app.get('/api/payees', async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT payeeid, payeename FROM tblpayees ORDER BY payeename ASC"
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching payees:', error);
      res.status(500).json({ error: 'Failed to fetch payees', message: error.message });
    }
  });

  // Create a new payee
  app.post('/api/payees', async (req, res) => {
    const { payeename } = req.body;

    if (!payeename || !payeename.trim()) {
      return res.status(400).json({ error: 'Payee name is required' });
    }

    try {
      // Check if payee name already exists (case-insensitive check)
      const existingRes = await pool.query(
        'SELECT * FROM tblpayees WHERE LOWER(payeename) = LOWER($1)',
        [payeename.trim()]
      );
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'Payee already exists' });
      }

      const result = await pool.query(
        'INSERT INTO tblpayees (payeename) VALUES ($1) RETURNING *',
        [payeename.trim()]
      );

      if (io) io.emit('payees_updated');

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Failed to create payee:', error);
      res.status(500).json({ error: 'Failed to create payee', message: error.message });
    }
  });

  // Delete a payee
  app.delete('/api/payees/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        'DELETE FROM tblpayees WHERE payeeid = $1 RETURNING *',
        [parseInt(id, 10)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payee not found' });
      }

      if (io) io.emit('payees_updated');

      res.json({ message: 'Payee deleted successfully', payee: result.rows[0] });
    } catch (error) {
      console.error('Error deleting payee:', error);
      res.status(500).json({ error: 'Failed to delete payee', message: error.message });
    }
  });

  // Update a payee
  app.put('/api/payees/:id', async (req, res) => {
    const { id } = req.params;
    const { payeename } = req.body;

    if (!payeename || !payeename.trim()) {
      return res.status(400).json({ error: 'Payee name is required' });
    }

    try {
      // Check if payee name already exists (case-insensitive, excluding current ID)
      const existingRes = await pool.query(
        'SELECT * FROM tblpayees WHERE LOWER(payeename) = LOWER($1) AND payeeid <> $2',
        [payeename.trim(), parseInt(id, 10)]
      );
      if (existingRes.rows.length > 0) {
        return res.status(400).json({ error: 'Payee name already exists' });
      }

      const result = await pool.query(
        'UPDATE tblpayees SET payeename = $1 WHERE payeeid = $2 RETURNING *',
        [payeename.trim(), parseInt(id, 10)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payee not found' });
      }

      if (io) io.emit('payees_updated');

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating payee:', error);
      res.status(500).json({ error: 'Failed to update payee', message: error.message });
    }
  });
};
