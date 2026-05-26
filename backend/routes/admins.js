const { pool } = require('../db/pool');

module.exports = (app) => {
  // Get all admins
  app.get('/api/admins', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT adminid, adminname, adminemail, documentdirection, datecreated, archivedate, isarchive, usertype 
         FROM tbladmin 
         WHERE isarchive = false 
         ORDER BY datecreated DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admins:', error);
      res.status(500).json({ error: 'Failed to fetch admins', message: error.message });
    }
  });

  // Get archived admins
  app.get('/api/admins/archived', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT adminid, adminname, adminemail, documentdirection, datecreated, archivedate, isarchive 
         FROM tbladmin 
         WHERE isarchive = true 
         ORDER BY archivedate DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching archived admins:', error);
      res.status(500).json({ error: 'Failed to fetch archived admins', message: error.message });
    }
  });

  // Create admin
  app.post('/api/admins', async (req, res) => {
    const { adminname, adminemail, adminpass, documentdirection, usertype } = req.body;
    
    // More specific validation
    if (!adminname) return res.status(400).json({ error: 'Name is required' });
    if (!adminemail) return res.status(400).json({ error: 'Email is required' });
    if (!adminpass) return res.status(400).json({ error: 'Password is required' });
  
    try {
      const email = adminemail.trim().toLowerCase();
      
      // Validate email format
      if (!/^[^@]+@region1\.dost\.gov\.ph$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email domain. Must be @region1.dost.gov.ph' });
      }
  
      const existingAdminRes = await pool.query('SELECT * FROM tbladmin WHERE adminemail = $1', [email]);
      if (existingAdminRes.rows[0]) {
        return res.status(400).json({ error: 'Email already exists' });
      }
  
      const newAdminRes = await pool.query(
        `INSERT INTO tbladmin (adminname, adminemail, adminpass, documentdirection, usertype, datecreated) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [adminname, email, adminpass, documentdirection || null, usertype || 'admin', new Date()]
      );
      
      const newAdmin = newAdminRes.rows[0];
      const { adminpass: _, ...adminWithoutPassword } = newAdmin;
      res.status(201).json(adminWithoutPassword);
    } catch (error) {
      console.error('Failed to create admin:', error);
      res.status(500).json({ 
        error: 'Failed to create admin', 
        message: error.message
      });
    }
  });

  // Update admin
  app.put('/api/admins/:id', async (req, res) => {
    const { id } = req.params;
    const { adminname, adminemail, adminpass, documentdirection, usertype } = req.body;
    if (!adminname && !adminemail && !adminpass && !documentdirection && !usertype) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }
    try {
      const updateFields = [];
      const queryValues = [];
      let index = 1;
      if (adminname) {
        updateFields.push(`adminname = $${index++}`);
        queryValues.push(adminname);
      }
      if (adminemail) {
        updateFields.push(`adminemail = $${index++}`);
        queryValues.push(adminemail);
      }
      if (documentdirection !== undefined) {
        updateFields.push(`documentdirection = $${index++}`);
        queryValues.push(documentdirection || null);
      }
      if (usertype) {
        updateFields.push(`usertype = $${index++}`);
        queryValues.push(usertype);
      }
      if (adminpass) {
        updateFields.push(`adminpass = $${index++}`);
        queryValues.push(adminpass);
      }
      queryValues.push(parseInt(id));
      const updatedAdminRes = await pool.query(
        `UPDATE tbladmin SET ${updateFields.join(', ')} WHERE adminid = $${index} RETURNING *`,
        queryValues
      );
      const updatedAdmin = updatedAdminRes.rows[0];
      if (!updatedAdmin) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      const { adminpass: _, ...adminWithoutPassword } = updatedAdmin;
      res.json(adminWithoutPassword);
    } catch (error) {
      console.error('Failed to update admin:', error);
      res.status(500).json({ error: 'Failed to update admin', message: error.message, code: error.code });
    }
  });

  // Archive admin
  app.put('/api/admins/:id/archive', async (req, res) => {
    const { id } = req.params;
    const { archivedate } = req.body;
    try {
      const adminRes = await pool.query('SELECT * FROM tbladmin WHERE adminid = $1', [parseInt(id)]);
      const admin = adminRes.rows[0];
      if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      const updatedAdminRes = await pool.query(
        'UPDATE tbladmin SET isarchive = true, archivedate = $1 WHERE adminid = $2 RETURNING *',
        [archivedate, parseInt(id)]
      );
      const updatedAdmin = updatedAdminRes.rows[0];
      const { adminpass: _, ...adminWithoutPassword } = updatedAdmin;
      res.json(adminWithoutPassword);
    } catch (error) {
      console.error('Archive admin error:', error);
      res.status(500).json({ error: 'Failed to archive admin', message: error.message, code: error.code });
    }
  });

  // Restore admin
  app.put('/api/admins/:id/restore', async (req, res) => {
    const { id } = req.params;
    try {
      const adminRes = await pool.query('SELECT * FROM tbladmin WHERE adminid = $1', [parseInt(id)]);
      const admin = adminRes.rows[0];
      if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      const updatedAdminRes = await pool.query(
        'UPDATE tbladmin SET isarchive = false, archivedate = NULL WHERE adminid = $2 RETURNING *',
        [parseInt(id)]
      );
      const updatedAdmin = updatedAdminRes.rows[0];
      const { adminpass: _, ...adminWithoutPassword } = updatedAdmin;
      res.json(adminWithoutPassword);
    } catch (error) {
      console.error('Restore admin error:', error);
      res.status(500).json({ error: 'Failed to restore admin', message: error.message, code: error.code });
    }
  });

  // Delete admin
  app.delete('/api/admins/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const adminRes = await pool.query('SELECT * FROM tbladmin WHERE adminid = $1', [parseInt(id)]);
      const admin = adminRes.rows[0];
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      await pool.query('DELETE FROM tbladmin WHERE adminid = $1', [parseInt(id)]);
      return res.status(200).json({ message: 'Admin deleted successfully' });
    } catch (error) {
      console.error('Error deleting admin:', error);
      return res.status(500).json({ message: 'Error deleting admin', error: error.message });
    }
  });
}; 