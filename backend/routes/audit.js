const { pool } = require('../db/pool');

module.exports = (app) => {
  // GET audit trail for a document
  app.get('/api/documents/:id/audit', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT auditid, documentid, action, changedby, changedat, changes
         FROM tbldocument_audit
         WHERE documentid = $1
         ORDER BY changedat DESC`,
        [parseInt(id)]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({ error: 'Failed to fetch audit trail', message: error.message });
    }
  });
};
