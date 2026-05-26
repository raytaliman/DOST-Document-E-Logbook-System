const { pool } = require('../db/pool');
const formatDateForDatabase = require('../utils/formatDate');

module.exports = (app, io) => {
  // Get all documents
  app.get('/api/documents', async (req, res) => {
    try {
      const { direction } = req.query;
      let query = `
        SELECT documentid, dtsno, documenttype, datesent, datereleased, time, route, remarks, isarchive, documentdirection, calcnetworkdays, deducteddays, networkdaysremarks 
        FROM tbldocuments
      `;
      const params = [];
      if (direction) {
        query += ' WHERE documentdirection = $1';
        params.push(direction.toLowerCase());
      }
      query += ' ORDER BY datesent DESC';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents', message: error.message });
    }
  });

  // Create document
  app.post('/api/documents', async (req, res) => {
    const { dtsno, documenttype, route, remarks, datesent, datereleased } = req.body;
    
    // Validate required fields
    if (!dtsno || !documenttype || !route) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['dtsno', 'documenttype', 'route'] 
      });
    }
  
    try {
      // For outgoing documents, datesent should be provided as timestamp string
      if (!datesent || !datesent.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return res.status(400).json({ error: 'Invalid Date Sent format' });
      }
  
      // datereleased should be in the formatted string
      if (!datereleased || !datereleased.match(/^[A-Za-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/)) {
        return res.status(400).json({ error: 'Invalid Date Received format' });
      }
      const moment = require("moment-timezone");
      const datesentDate = moment.tz(datesent, "YYYY-MM-DD HH:mm:ss", "Asia/Manila").toDate();

      const result = await pool.query(
        `INSERT INTO tbldocuments 
         (dtsno, documenttype, route, remarks, documentdirection, datesent, datereleased, time, isarchive) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          dtsno.trim().toUpperCase(),
          documenttype.trim(),
          route.trim(),
          remarks?.trim() || null,
          'outgoing',
          datesentDate,
          datereleased,
          null,
          false
        ]
      );
      
      res.status(201).json(result.rows[0]);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ 
        error: 'Database operation failed', 
        message: error.message 
      });
    }
  });

  // Update document
  app.put('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    const { dtsno, documenttype, route, remarks, time, datereleased } = req.body;
    
    try {
        // Handle time-only updates for 'All Documents' page quick edit
        if (Object.keys(req.body).length === 1 && typeof time !== 'undefined') {
            const timeValue = time === '' || time === '-' ? null : time;
            const result = await pool.query(
                'UPDATE tbldocuments SET time = $1 WHERE documentid = $2 RETURNING *',
                [timeValue, parseInt(id)]
            );
            io.emit('documents_updated');
            return res.json(result.rows[0]);
        }

        // Validate required fields for full updates
        if (!dtsno || !documenttype || !route) {
            return res.status(400).json({ 
                error: 'Missing required fields', 
                required: ['dtsno', 'documenttype', 'route'] 
            });
        }

        const timeValue = time === '' || time === '-' ? null : time;
        const remarksValue = remarks?.trim() || null;
        
        let query, params;
        if (typeof datereleased !== 'undefined') {
            query = `
                UPDATE tbldocuments 
                SET dtsno = $1, documenttype = $2, route = $3, remarks = $4, time = $5, documentdirection = $6, datereleased = $7
                WHERE documentid = $8 
                RETURNING *
            `;
            params = [
                dtsno.trim().toUpperCase(),
                documenttype.trim(),
                route.trim(),
                remarksValue,
                timeValue,
                'outgoing',
                datereleased, // could be a string or null
                parseInt(id)
            ];
        } else {
            query = `
                UPDATE tbldocuments 
                SET dtsno = $1, documenttype = $2, route = $3, remarks = $4, time = $5, documentdirection = $6
                WHERE documentid = $7 
                RETURNING *
            `;
            params = [
                dtsno.trim().toUpperCase(),
                documenttype.trim(),
                route.trim(),
                remarksValue,
                timeValue,
                'outgoing',
                parseInt(id)
            ];
        }

        const result = await pool.query(query, params);
        const updatedDoc = result.rows[0];
        if (!updatedDoc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(updatedDoc);
        io.emit('documents_updated');
    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ 
            error: 'Database operation failed', 
            message: error.message, 
            code: error.code 
        });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const documentRes = await pool.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
      const document = documentRes.rows[0];
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      await pool.query('DELETE FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
      io.emit('documents_updated');
      return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ message: 'Error deleting document', error: error.message });
    }
  });

  // Archive document
  app.put('/api/documents/:id/archive', async (req, res) => {
    const { id } = req.params;
    const { archivedate, archivedby } = req.body;
    try {
      const documentRes = await pool.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
      const document = documentRes.rows[0];
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      const updatedDocRes = await pool.query(
        'UPDATE tbldocuments SET isarchive = true, archivedate = $1, archivedby = $2 WHERE documentid = $3 RETURNING *',
        [archivedate, archivedby || 'ITSM', parseInt(id)]
      );
      res.json(updatedDocRes.rows[0]);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Archive document error:', error);
      res.status(500).json({ error: 'Database operation failed', message: error.message, code: error.code });
    }
  });

  // Restore document
  app.put('/api/documents/:id/restore', async (req, res) => {
    const { id } = req.params;
    try {
      const updatedDocRes = await pool.query(
        'UPDATE tbldocuments SET isarchive = false, archivedate = NULL, archivedby = NULL WHERE documentid = $1 RETURNING *',
        [parseInt(id)]
      );
      const updatedDoc = updatedDocRes.rows[0];
      if (!updatedDoc) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(updatedDoc);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Restore document error:', error);
      res.status(500).json({ error: 'Database operation failed', message: error.message, code: error.code });
    }
  });

  // Get archived documents
  app.get('/api/documents/archived', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT documentid, dtsno, documenttype, datesent, datereleased, time, route, remarks, archivedate, archivedby, documentdirection 
         FROM tbldocuments 
         WHERE isarchive = true 
         ORDER BY archivedate DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching archived documents:', error);
      res.status(500).json({ error: 'Failed to fetch archived documents', message: error.message });
    }
  });

  // Update processing days
  app.put('/api/documents/:id/networkdays', async (req, res) => {
    const { id } = req.params;
    const { deducteddays, calcnetworkdays, remarks } = req.body;
    try {
      const documentRes = await pool.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
      const document = documentRes.rows[0];
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const deducteddaysVal = deducteddays !== null && deducteddays !== undefined 
        ? parseInt(deducteddays, 10) 
        : null;
      const calcnetworkdaysVal = calcnetworkdays !== null && calcnetworkdays !== undefined 
        ? parseInt(calcnetworkdays, 10) 
        : null;
        
      const updatedDocRes = await pool.query(
        'UPDATE tbldocuments SET deducteddays = $1, calcnetworkdays = $2, networkdaysremarks = $3 WHERE documentid = $4 RETURNING *',
        [deducteddaysVal, calcnetworkdaysVal, remarks || null, parseInt(id)]
      );
      
      res.json(updatedDocRes.rows[0]);
      io.emit('documents_updated');
    } catch (error) {
      console.error('Update network days error:', error);
      res.status(500).json({ error: 'Failed to update network days', message: error.message });
    }
  });
}; 