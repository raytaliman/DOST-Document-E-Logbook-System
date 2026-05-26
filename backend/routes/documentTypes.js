const { pool } = require('../db/pool');

module.exports = (app) => {
  // Get all document types
  app.get('/api/document-types', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM tbldocumenttype ORDER BY documenttype ASC');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching document types:', error);
      res.status(500).json({ error: 'Failed to fetch document types', message: error.message });
    }
  });

  // Create document type
  app.post('/api/document-types', async (req, res) => {
    const { documenttype } = req.body;
    if (!documenttype || !documenttype.trim()) {
      return res.status(400).json({ error: 'Document type is required' });
    }
    try {
      const existingTypeRes = await pool.query(
        'SELECT * FROM tbldocumenttype WHERE documenttype = $1 LIMIT 1',
        [documenttype.trim()]
      );
      if (existingTypeRes.rows[0]) {
        return res.status(400).json({ error: 'Document type already exists' });
      }
      const newTypeRes = await pool.query(
        'INSERT INTO tbldocumenttype (documenttype) VALUES ($1) RETURNING *',
        [documenttype.trim()]
      );
      res.status(201).json(newTypeRes.rows[0]);
    } catch (error) {
      console.error('Failed to add document type:', error);
      res.status(500).json({ error: 'Failed to add document type', details: error.message });
    }
  });

  // Delete document type
  app.delete('/api/document-types/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM tbldocumenttype WHERE documentid = $1', [parseInt(id)]);
      res.json({ message: 'Document type deleted successfully' });
    } catch (error) {
      console.error('Failed to delete document type:', error);
      res.status(500).json({ error: 'Failed to delete document type', details: error.message });
    }
  });
}; 