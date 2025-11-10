const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
const { google } = require('googleapis');
const fs = require('fs');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data CON file
    const form = formidable({
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
      multiples: false
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          if (err.code === 'maxFileSizeExceeded') {
            reject(new Error('File too large. Maximum size is 2GB.'));
          } else {
            reject(err);
          }
        } else {
          resolve([fields, files]);
        }
      });
    });

    console.log('Fields received:', Object.keys(fields));
    console.log('Files received:', Object.keys(files));

    // Verify reCAPTCHA
    const recaptchaToken = Array.isArray(fields.recaptchaToken) ? fields.recaptchaToken[0] : fields.recaptchaToken;
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
    });

    const recaptchaData = await recaptchaResponse.json();
    if (!recaptchaData.success) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }

    // Process form data
    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
    const clipType = Array.isArray(fields.clipType) ? fields.clipType[0] : fields.clipType;
    const bugSpecific = Array.isArray(fields.bugSpecific) ? fields.bugSpecific[0] : fields.bugSpecific;
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;

    // Validations
    if (!name || !email || !description) {
      return res.status(400).json({ error: 'Missing required fields: name, email, description' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if file exists - CORREZIONE QUI
    const clipFile = files.clipFile;
    if (!clipFile || !clipFile[0]) {
      console.log('No clip file found in files:', files);
      return res.status(400).json({ error: 'No clip file provided' });
    }

    const file = clipFile[0]; // Prendi il primo file

    const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Upload to Google Drive
    const driveResult = await uploadToGoogleDrive(file, name, email, description, submissionId);

    // Send email notification
    await sendEmailNotification(name, email, clipType, bugSpecific, description, file, submissionId, driveResult);

    res.status(200).json({ 
      success: true, 
      message: 'Clip uploaded successfully to Google Drive!',
      submissionId: submissionId,
      driveUrl: driveResult.webViewLink
    });

  } catch (error) {
    console.error('Error processing submission:', error);
    
    if (error.message.includes('File too large')) {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 2GB.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
};

// Upload file to Google Drive
async function uploadToGoogleDrive(file, name, email, description, submissionId) {
  try {
    // Configura l'autenticazione Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Crea i metadata del file
    const fileMetadata = {
      name: `${submissionId}_${file.originalFilename}`,
      description: `Clip submission from ${name} (${email})\n\nDescription: ${description}\nSubmission ID: ${submissionId}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.filepath)
    };

    // Upload del file
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink, mimeType, size'
    });

    // Rendi il file pubblico
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Pulisci il file temporaneo
    fs.unlinkSync(file.filepath);

    return {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
      mimeType: response.data.mimeType,
      size: response.data.size
    };

  } catch (error) {
    console.error('Google Drive upload error:', error);
    throw new Error('Failed to upload to Google Drive: ' + error.message);
  }
}

// Send email notification
async function sendEmailNotification(name, userEmail, clipType, bugSpecific, description, file, submissionId, driveResult) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Format clip type for display
  const clipTypeLabels = {
    bug: '🐛 Bug',
    funny: '😂 Funny Clip',
    error: '❌ Error',
    fail: '💥 Fail',
    other: '📁 Other'
  };

  // Calculate file size for display
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
  const displaySize = file.size > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'alberto.zappala360@gmail.com',
    subject: `🎬 NEW CLIP UPLOADED: ${clipTypeLabels[clipType] || clipType} - ${submissionId}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #2d3436; }
              .value { color: #636e72; }
              .rights-box { background: #e8f5e8; border-left: 4px solid #00b894; padding: 15px; margin: 20px 0; }
              .drive-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
              .download-btn { background: #34a853; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
              .view-btn { background: #4285f4; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎬 Clip Successfully Uploaded!</h1>
                  <p>Automatically saved to Google Drive</p>
              </div>
              <div class="content">
                  <div class="field">
                      <span class="label">👤 Submitted by:</span>
                      <span class="value">${name} (${userEmail})</span>
                  </div>
                  
                  <div class="field">
                      <span class="label">📝 Description:</span>
                      <span class="value">${description}</span>
                  </div>
                  
                  ${bugSpecific ? `
                  <div class="field">
                      <span class="label">🐛 Bug Details:</span>
                      <span class="value">${bugSpecific}</span>
                  </div>
                  ` : ''}
                  
                  <div class="field">
                      <span class="label">📁 File Uploaded:</span>
                      <span class="value">${file.originalFilename} (${displaySize})</span>
                  </div>
                  
                  <div class="drive-box">
                      <strong>☁️ Stored in Google Drive</strong><br>
                      File automatically uploaded and secured in your Google Drive.<br>
                      <strong>Submission ID:</strong> ${submissionId}<br>
                      <strong>Drive File ID:</strong> ${driveResult.fileId}
                  </div>
                  
                  <div style="text-align: center; margin: 25px 0;">
                      <a href="${driveResult.webContentLink}" class="download-btn" target="_blank">
                         📥 DOWNLOAD CLIP
                      </a>
                      <a href="${driveResult.webViewLink}" class="view-btn" target="_blank">
                         👀 VIEW IN DRIVE
                      </a>
                  </div>
                  
                  <div class="rights-box">
                      <strong>✅ Rights Agreement Confirmed</strong><br>
                      User agreed to YouTube publication rights and copyright transfer.
                  </div>
                  
                  <div style="text-align: center; margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                      <strong>Upload Time:</strong> ${new Date().toLocaleString('it-IT')}<br>
                      <strong>Submission ID:</strong> ${submissionId}<br>
                      <strong>File Size:</strong> ${displaySize}
                  </div>
              </div>
          </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
}