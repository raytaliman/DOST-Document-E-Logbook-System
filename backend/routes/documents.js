const { pool } = require('../db/pool');
const formatDateForDatabase = require('../utils/formatDate');

// ---------- Audit helper ----------
async function logAudit(client, { documentid, action, changedby, changes }) {
  await client.query(
    `INSERT INTO tbldocument_audit (documentid, action, changedby, changedat, changes)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [documentid, action, changedby || 'System', changes ? JSON.stringify(changes) : null]
  );
}

// Build a diff object: { field: { old, new } } — only includes changed fields
function diffFields(oldDoc, newDoc, fields) {
  const changes = {};
  for (const field of fields) {
    const o = oldDoc[field] ?? null;
    const n = newDoc[field] ?? null;
    // Normalise to string for comparison (handles numeric/null mismatches)
    if (String(o) !== String(n)) {
      changes[field] = { old: o, new: n };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
// ----------------------------------

module.exports = (app, io) => {
  // Get all documents
  app.get('/api/documents', async (req, res) => {
    try {
      const { direction } = req.query;
      let query = `
        SELECT documentid, dtsno, documenttype, datesent, datereleased, time, route, remarks, isarchive, documentdirection, calcnetworkdays, deducteddays, networkdaysremarks, daysprocessed, processedby, payee, amount, seriesno, particulars, queueno, include_friday 
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
    const { dtsno, documenttype, route, remarks, datesent, datereleased, processedby, payee, amount, seriesno, particulars, queueno, include_friday } = req.body;
    
    if (!dtsno || !route) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['dtsno', 'route'] 
      });
    }
  
    try {
      if (!datesent || !datesent.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return res.status(400).json({ error: 'Invalid Date Sent format' });
      }
      if (!datereleased || !datereleased.match(/^[A-Za-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/)) {
        return res.status(400).json({ error: 'Invalid Date Received format' });
      }

      const moment = require("moment-timezone");
      const datesentDate = moment.tz(datesent, "YYYY-MM-DD HH:mm:ss", "Asia/Manila").toDate();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const result = await client.query(
          `INSERT INTO tbldocuments 
            (dtsno, documenttype, route, remarks, documentdirection, datesent, datereleased, time, isarchive, processedby, payee, amount, seriesno, particulars, queueno, include_friday) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING *`,
          [
            dtsno.trim().toUpperCase(),
            documenttype?.trim() || null,
            route.trim(),
            remarks?.trim() || null,
            'outgoing',
            datesentDate,
            datereleased,
            null,
            false,
            processedby?.trim() || null,
            payee?.trim() || null,
            amount ? parseFloat(amount) : null,
            seriesno?.trim() || null,
            particulars?.trim() || null,
            queueno?.trim() || null,
            include_friday === undefined ? true : (include_friday === true || include_friday === 'true')
          ]
        );

        const newDoc = result.rows[0];
        await logAudit(client, {
          documentid: newDoc.documentid,
          action: 'CREATE',
          changedby: processedby?.trim() || 'System',
          changes: {
            dtsno: { old: null, new: newDoc.dtsno },
            documenttype: { old: null, new: newDoc.documenttype },
            route: { old: null, new: newDoc.route },
            remarks: { old: null, new: newDoc.remarks },
            datesent: { old: null, new: datesent },
            datereleased: { old: null, new: newDoc.datereleased },
            processedby: { old: null, new: newDoc.processedby },
            payee: { old: null, new: newDoc.payee },
            amount: { old: null, new: newDoc.amount },
            seriesno: { old: null, new: newDoc.seriesno },
            particulars: { old: null, new: newDoc.particulars },
            queueno: { old: null, new: newDoc.queueno },
            include_friday: { old: null, new: newDoc.include_friday },
          }
        });

        await client.query('COMMIT');
        res.status(201).json(newDoc);
        io.emit('documents_updated');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ error: 'Database operation failed', message: error.message });
    }
  });

  // Update document
  app.put('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    const { dtsno, documenttype, route, remarks, time, datereleased, datesent, processedby, payee, amount, seriesno, particulars, queueno, include_friday } = req.body;
    
    try {
        // Time-only quick edit
        if (Object.keys(req.body).length === 1 && typeof time !== 'undefined') {
            const timeValue = time === '' || time === '-' ? null : time;
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              const oldRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
              const oldDoc = oldRes.rows[0];
              const routeValue = oldDoc.route;
              const directionValue = ((timeValue && timeValue !== '-') || (routeValue && routeValue !== '-')) ? 'outgoing' : 'incoming';
              const result = await client.query(
                'UPDATE tbldocuments SET time = $1, documentdirection = $2 WHERE documentid = $3 RETURNING *',
                [timeValue, directionValue, parseInt(id)]
              );
              const newDoc = result.rows[0];
              const changes = diffFields(oldDoc, newDoc, ['time', 'documentdirection']);
              if (changes) {
                await logAudit(client, { documentid: parseInt(id), action: 'UPDATE', changedby: processedby || 'System', changes });
              }
              await client.query('COMMIT');
              io.emit('documents_updated');
              return res.json(newDoc);
            } catch (err) {
              await client.query('ROLLBACK');
              throw err;
            } finally {
              client.release();
            }
        }

        // Route-only quick edit
        if (Object.keys(req.body).length === 1 && typeof route !== 'undefined') {
            const routeValue = route === '' || route === '-' ? null : route;
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              const oldRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
              const oldDoc = oldRes.rows[0];
              const timeValue = oldDoc.time;
              const directionValue = ((timeValue && timeValue !== '-') || (routeValue && routeValue !== '-')) ? 'outgoing' : 'incoming';
              const result = await client.query(
                'UPDATE tbldocuments SET route = $1, documentdirection = $2 WHERE documentid = $3 RETURNING *',
                [routeValue, directionValue, parseInt(id)]
              );
              const newDoc = result.rows[0];
              const changes = diffFields(oldDoc, newDoc, ['route', 'documentdirection']);
              if (changes) {
                await logAudit(client, { documentid: parseInt(id), action: 'UPDATE', changedby: processedby || 'System', changes });
              }
              await client.query('COMMIT');
              io.emit('documents_updated');
              return res.json(newDoc);
            } catch (err) {
              await client.query('ROLLBACK');
              throw err;
            } finally {
              client.release();
            }
        }

        // DateReleased quick edit
        if (typeof datereleased !== 'undefined' && !dtsno && !route) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              const oldRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
              const oldDoc = oldRes.rows[0];
              const result = await client.query(
                'UPDATE tbldocuments SET datereleased = $1 WHERE documentid = $2 RETURNING *',
                [datereleased, parseInt(id)]
              );
              const newDoc = result.rows[0];
              const changes = diffFields(oldDoc, newDoc, ['datereleased']);
              if (changes) {
                await logAudit(client, { documentid: parseInt(id), action: 'UPDATE', changedby: processedby || 'System', changes });
              }
              await client.query('COMMIT');
              io.emit('documents_updated');
              return res.json(newDoc);
            } catch (err) {
              await client.query('ROLLBACK');
              throw err;
            } finally {
              client.release();
            }
        }

        if (!dtsno || !route) {
            return res.status(400).json({ 
                error: 'Missing required fields', 
                required: ['dtsno', 'route'] 
            });
        }

        if (datesent && !datesent.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            return res.status(400).json({ error: 'Invalid Date Sent format' });
        }

        const moment = require("moment-timezone");
        const datesentDate = datesent 
            ? moment.tz(datesent, "YYYY-MM-DD HH:mm:ss", "Asia/Manila").toDate()
            : null;

        const remarksValue = remarks?.trim() || null;
        const timeProvided = typeof time !== 'undefined';
        const timeValue = timeProvided ? (time === '' || time === '-' ? null : time) : undefined;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Fetch old record for diff
          const oldRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
          const oldDoc = oldRes.rows[0];
          if (!oldDoc) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found' });
          }

          let query, params;
          if (typeof datereleased !== 'undefined') {
              query = `
                  UPDATE tbldocuments 
                  SET dtsno = $1, documenttype = $2, route = $3::text::route_enum, remarks = $4,
                      time = CASE WHEN $5::boolean THEN $6::text::time_enum ELSE time END,
                      datereleased = $7, datesent = COALESCE($8, datesent),
                      processedby = COALESCE($9, processedby),
                      payee = $10, amount = $11, seriesno = $12, particulars = $13, queueno = $14,
                      include_friday = $15,
                      documentdirection = CASE WHEN (CASE WHEN $5::boolean THEN $6::text::time_enum ELSE time END IS NOT NULL) OR ($3::text IS NOT NULL AND $3::text <> '' AND $3::text <> '-') THEN 'outgoing'::documentdirection_enum ELSE 'incoming'::documentdirection_enum END
                  WHERE documentid = $16 
                  RETURNING *
              `;
              params = [
                  dtsno.trim().toUpperCase(),
                  documenttype?.trim() || null,
                  route.trim(),
                  remarksValue,
                  timeProvided,
                  timeProvided ? timeValue : null,
                  datereleased,
                  datesentDate,
                  processedby?.trim() || null,
                  payee?.trim() || null,
                  amount ? parseFloat(amount) : null,
                  seriesno?.trim() || null,
                  particulars?.trim() || null,
                  queueno?.trim() || null,
                  include_friday === undefined ? true : (include_friday === true || include_friday === 'true'),
                  parseInt(id)
              ];
          } else {
              query = `
                  UPDATE tbldocuments 
                  SET dtsno = $1, documenttype = $2, route = $3::text::route_enum, remarks = $4,
                      time = CASE WHEN $5::boolean THEN $6::text::time_enum ELSE time END,
                      datesent = COALESCE($7, datesent),
                      processedby = COALESCE($8, processedby),
                      payee = $9, amount = $10, seriesno = $11, particulars = $12, queueno = $13,
                      include_friday = $14,
                      documentdirection = CASE WHEN (CASE WHEN $5::boolean THEN $6::text::time_enum ELSE time END IS NOT NULL) OR ($3::text IS NOT NULL AND $3::text <> '' AND $3::text <> '-') THEN 'outgoing'::documentdirection_enum ELSE 'incoming'::documentdirection_enum END
                  WHERE documentid = $15 
                  RETURNING *
              `;
              params = [
                  dtsno.trim().toUpperCase(),
                  documenttype?.trim() || null,
                  route.trim(),
                  remarksValue,
                  timeProvided,
                  timeProvided ? timeValue : null,
                  datesentDate,
                  processedby?.trim() || null,
                  payee?.trim() || null,
                  amount ? parseFloat(amount) : null,
                  seriesno?.trim() || null,
                  particulars?.trim() || null,
                  queueno?.trim() || null,
                  include_friday === undefined ? true : (include_friday === true || include_friday === 'true'),
                  parseInt(id)
              ];
          }

          const result = await client.query(query, params);
          const updatedDoc = result.rows[0];

          // Log only changed fields
          const trackedFields = ['dtsno','documenttype','route','remarks','time','datereleased','datesent','processedby','payee','amount','seriesno','particulars','queueno', 'include_friday', 'documentdirection'];
          const changes = diffFields(oldDoc, updatedDoc, trackedFields);
          if (changes) {
            await logAudit(client, {
              documentid: parseInt(id),
              action: 'UPDATE',
              changedby: processedby?.trim() || 'System',
              changes
            });
          }

          await client.query('COMMIT');
          res.json(updatedDoc);
          io.emit('documents_updated');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const documentRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
        const document = documentRes.rows[0];
        if (!document) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Document not found' });
        }
        const updatedDocRes = await client.query(
          'UPDATE tbldocuments SET isarchive = true, archivedate = $1, archivedby = $2 WHERE documentid = $3 RETURNING *',
          [archivedate, archivedby || 'ITSM', parseInt(id)]
        );
        await logAudit(client, {
          documentid: parseInt(id),
          action: 'ARCHIVE',
          changedby: archivedby || 'ITSM',
          changes: { isarchive: { old: false, new: true }, archivedate: { old: null, new: archivedate } }
        });
        await client.query('COMMIT');
        res.json(updatedDocRes.rows[0]);
        io.emit('documents_updated');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Archive document error:', error);
      res.status(500).json({ error: 'Database operation failed', message: error.message, code: error.code });
    }
  });

  // Restore document
  app.put('/api/documents/:id/restore', async (req, res) => {
    const { id } = req.params;
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updatedDocRes = await client.query(
          'UPDATE tbldocuments SET isarchive = false, archivedate = NULL, archivedby = NULL WHERE documentid = $1 RETURNING *',
          [parseInt(id)]
        );
        const updatedDoc = updatedDocRes.rows[0];
        if (!updatedDoc) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Document not found' });
        }
        await logAudit(client, {
          documentid: parseInt(id),
          action: 'RESTORE',
          changedby: 'System',
          changes: { isarchive: { old: true, new: false } }
        });
        await client.query('COMMIT');
        res.json(updatedDoc);
        io.emit('documents_updated');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Restore document error:', error);
      res.status(500).json({ error: 'Database operation failed', message: error.message, code: error.code });
    }
  });

  // Get archived documents
  app.get('/api/documents/archived', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT documentid, dtsno, documenttype, datesent, datereleased, time, route, remarks, archivedate, archivedby, documentdirection, daysprocessed, payee, amount, seriesno, particulars, queueno, include_friday 
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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const documentRes = await client.query('SELECT * FROM tbldocuments WHERE documentid = $1', [parseInt(id)]);
        const document = documentRes.rows[0];
        if (!document) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Document not found' });
        }
        
        const deducteddaysVal = deducteddays !== null && deducteddays !== undefined 
          ? parseInt(deducteddays, 10) 
          : null;
        const calcnetworkdaysVal = calcnetworkdays !== null && calcnetworkdays !== undefined 
          ? parseInt(calcnetworkdays, 10) 
          : null;
          
        const updatedDocRes = await client.query(
          'UPDATE tbldocuments SET deducteddays = $1, calcnetworkdays = $2, networkdaysremarks = $3 WHERE documentid = $4 RETURNING *',
          [deducteddaysVal, calcnetworkdaysVal, remarks || null, parseInt(id)]
        );

        const changes = diffFields(document, updatedDocRes.rows[0], ['deducteddays', 'calcnetworkdays', 'networkdaysremarks']);
        if (changes) {
          await logAudit(client, {
            documentid: parseInt(id),
            action: 'PROCESSING_DAYS',
            changedby: 'System',
            changes
          });
        }

        await client.query('COMMIT');
        res.json(updatedDocRes.rows[0]);
        io.emit('documents_updated');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update network days error:', error);
      res.status(500).json({ error: 'Failed to update network days', message: error.message });
    }
  });
};