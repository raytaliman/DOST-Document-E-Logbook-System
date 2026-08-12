const { pool } = require('../db/pool');

module.exports = (app) => {
  const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
  const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
  const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  const handleAuthorize = (req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error('Microsoft 365 OAuth configuration is missing in environment variables.');
      return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('OAuth Configuration Missing')}`);
    }

    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` + 
      `client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent('openid profile email User.Read')}` +
      `&state=dost_elogbook_m365`;

    res.redirect(authUrl);
  };

  const handleCallback = async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error('Microsoft OAuth error:', error_description || error);
      return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('No authorization code provided')}`);
    }

    try {
      // Exchange Authorization Code for Token
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          scope: 'openid profile email User.Read',
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
          client_secret: CLIENT_SECRET
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
      }

      const accessToken = tokenData.access_token;

      // Fetch user profile from Microsoft Graph API
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        console.error('Graph API request failed:', profileData);
        return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('Failed to fetch Microsoft profile')}`);
      }

      // Check email in profile: mail or userPrincipalName
      const email = (profileData.mail || profileData.userPrincipalName || '').toLowerCase();
      if (!email) {
        return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('No email address associated with this Microsoft account')}`);
      }

      // Look up user in tbladmin
      const result = await pool.query('SELECT * FROM tbladmin WHERE LOWER(adminemail) = $1', [email]);
      const admin = result.rows[0];

      if (!admin) {
        return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('Unauthorized. Email not registered in the system.')}`);
      }

      if (admin.isarchive) {
        return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent("Account has been archived.")}`);
      }

      // Successful verification. Construct payload
      const payload = {
        success: true,
        adminid: admin.adminid,
        adminname: admin.adminname,
        adminemail: admin.adminemail,
        usertype: admin.usertype,
        documentdirection: admin.documentdirection,
      };

      // Base64 encode details to return securely via query parameters
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

      return res.redirect(`${FRONTEND_URL}/?m365_success=${base64Payload}`);

    } catch (err) {
      console.error('Error during Microsoft 365 authentication:', err);
      return res.redirect(`${FRONTEND_URL}/?m365_error=${encodeURIComponent('Internal server error during authentication')}`);
    }
  };

  // Endpoint to initiate Microsoft 365 OAuth 2.0 flow
  app.get('/api/auth/microsoft', handleAuthorize);
  app.get('/auth/microsoft', handleAuthorize);

  // Callback endpoint for Microsoft 365 OAuth 2.0 flow
  app.get('/api/auth/microsoft/callback', handleCallback);
  app.get('/auth/microsoft/callback', handleCallback);
};
