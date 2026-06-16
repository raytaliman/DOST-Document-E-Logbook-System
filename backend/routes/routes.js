const { pool } = require('../db/pool');

module.exports = (app) => {
  // Get all routes
  app.get('/api/routes', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM tblroutes ORDER BY routename ASC');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching routes:', error);
      res.status(500).json({ error: 'Failed to fetch routes', message: error.message });
    }
  });

  // Create a route
  app.post('/api/routes', async (req, res) => {
    const { routename } = req.body;
    if (!routename || !routename.trim()) {
      return res.status(400).json({ error: 'Route name is required' });
    }
    try {
      const existing = await pool.query(
        'SELECT * FROM tblroutes WHERE LOWER(routename) = LOWER($1) LIMIT 1',
        [routename.trim()]
      );
      if (existing.rows[0]) {
        return res.status(400).json({ error: 'Route already exists' });
      }
      const result = await pool.query(
        'INSERT INTO tblroutes (routename) VALUES ($1) RETURNING *',
        [routename.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Failed to add route:', error);
      res.status(500).json({ error: 'Failed to add route', details: error.message });
    }
  });

  // Update a route
  app.put('/api/routes/:id', async (req, res) => {
    const { id } = req.params;
    const { routename } = req.body;
    if (!routename || !routename.trim()) {
      return res.status(400).json({ error: 'Route name is required' });
    }
    try {
      const existing = await pool.query(
        'SELECT * FROM tblroutes WHERE LOWER(routename) = LOWER($1) AND routeid != $2 LIMIT 1',
        [routename.trim(), parseInt(id)]
      );
      if (existing.rows[0]) {
        return res.status(400).json({ error: 'Route name already exists' });
      }
      const result = await pool.query(
        'UPDATE tblroutes SET routename = $1 WHERE routeid = $2 RETURNING *',
        [routename.trim(), parseInt(id)]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Route not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Failed to update route:', error);
      res.status(500).json({ error: 'Failed to update route', details: error.message });
    }
  });

  // Delete a route
  app.delete('/api/routes/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM tblroutes WHERE routeid = $1', [parseInt(id)]);
      res.json({ message: 'Route deleted successfully' });
    } catch (error) {
      console.error('Failed to delete route:', error);
      res.status(500).json({ error: 'Failed to delete route', details: error.message });
    }
  });
};
