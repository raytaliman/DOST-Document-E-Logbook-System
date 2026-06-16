const { pool } = require('../db/pool');

module.exports = (app, io) => {
  // Get all settings as a key-value object
  app.get('/api/settings', async (req, res) => {
    try {
      const result = await pool.query('SELECT settingkey, settingvalue FROM tblsettings');
      
      const settings = {};
      result.rows.forEach((row) => {
        settings[row.settingkey] = row.settingvalue;
      });

      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings', message: error.message });
    }
  });

  // Update or insert a setting
  app.put('/api/settings', async (req, res) => {
    const { settingkey, settingvalue } = req.body;

    if (!settingkey || !settingkey.trim()) {
      return res.status(400).json({ error: 'Setting key is required' });
    }
    if (settingvalue === undefined || settingvalue === null) {
      return res.status(400).json({ error: 'Setting value is required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO tblsettings (settingkey, settingvalue)
         VALUES ($1, $2)
         ON CONFLICT (settingkey)
         DO UPDATE SET settingvalue = EXCLUDED.settingvalue
         RETURNING *`,
        [settingkey.trim(), String(settingvalue).trim()]
      );

      if (settingkey.trim() === 'office_hours_per_day') {
        await pool.query('UPDATE tbldocuments SET datesent = datesent');
        if (io) io.emit('documents_updated');
      }

      res.json({
        message: 'Setting updated successfully',
        setting: result.rows[0]
      });
    } catch (error) {
      console.error('Failed to update setting:', error);
      res.status(500).json({ error: 'Failed to update setting', message: error.message });
    }
  });
};
