const { pool } = require('../db/pool');

module.exports = (app, io) => {
  // Get all incoming documents
  app.get('/api/incoming', async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM tbldocuments WHERE documentdirection = 'incoming' ORDER BY datesent DESC"
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching incoming records:', error);
      res.status(500).json({ error: 'Failed to fetch incoming records', details: error.message });
    }
  });

  // Add new incoming document
  app.post('/api/incoming', async (req, res) => {
    const { dtsno, documenttype, processedby, payee, amount, seriesno, particulars, queueno, time, route } = req.body;
    if (!dtsno || !documenttype) {
      return res.status(400).json({ error: 'Required fields missing', required: ['dtsno', 'documenttype'] });
    }
    try {
      const formattedDtsNo = dtsno.trim().toUpperCase();
      const manilaTime = new Date();
      const newRecordRes = await pool.query(
        `INSERT INTO tbldocuments 
         (dtsno, documenttype, documentdirection, datesent, datereleased, time, route, remarks, networkdaysremarks, calcnetworkdays, deducteddays, isarchive, processedby, payee, amount, seriesno, particulars, queueno)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          formattedDtsNo,
          documenttype.trim(),
          'incoming',
          manilaTime,
          null,
          time || null,
          route || null,
          null,
          null,
          0,
          0,
          false,
          processedby?.trim() || null,
          payee?.trim() || null,
          amount ? parseFloat(amount) : null,
          seriesno?.trim() || null,
          particulars?.trim() || null,
          queueno?.trim() || null
        ]
      );
      res.status(201).json(newRecordRes.rows[0]);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Failed to create incoming record:', error);
      res.status(500).json({ error: 'Failed to create incoming record', details: error.message, code: error.code });
    }
  });

  // Update incoming document
  app.put('/api/incoming/:id', async (req, res) => {
    const { id } = req.params;
    const { dtsno, documenttype, processedby, payee, amount, seriesno, particulars, queueno, time, route } = req.body;
    if (!dtsno || !documenttype) {
      return res.status(400).json({ error: 'Required fields missing', required: ['dtsno', 'documenttype'] });
    }
    try {
      const formattedDtsNo = dtsno.trim().toUpperCase();
      const existingRecordRes = await pool.query(
        'SELECT * FROM tbldocuments WHERE dtsno = $1 AND documentid <> $2 LIMIT 1',
        [formattedDtsNo, parseInt(id)]
      );
      const updatedRecordRes = await pool.query(
        `UPDATE tbldocuments 
         SET dtsno = $1, documenttype = $2, processedby = COALESCE($3, processedby),
             payee = $4, amount = $5, seriesno = $6, particulars = $7, queueno = $8,
             time = $9, route = $10,
             documentdirection = CASE WHEN $9 IS NOT NULL AND $9 <> '' AND $9 <> '-' THEN 'outgoing' ELSE 'incoming' END
         WHERE documentid = $11 
         RETURNING *`,
        [
          formattedDtsNo, 
          documenttype.trim(), 
          processedby?.trim() || null, 
          payee?.trim() || null, 
          amount ? parseFloat(amount) : null, 
          seriesno?.trim() || null, 
          particulars?.trim() || null, 
          queueno?.trim() || null, 
          time || null, 
          route || null, 
          parseInt(id)
        ]
      );
      res.json(updatedRecordRes.rows[0]);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Failed to update incoming record:', error);
      res.status(500).json({ error: 'Failed to update incoming record', details: error.message, code: error.code });
    }
  });
};
 