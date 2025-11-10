const { put } = require('@vercel/blob');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
const fs = require('fs');

// Vercel Functions usa module.exports, non export
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
    // Parse form data with formidable - 1GB MAX
    const form = formidable({
      maxFileSize: 1 * 1024 * 1024 * 1024, // 1GB
      multiples: false
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          if (err.code === 'maxFileSizeExceeded') {
            reject(new Error('File too large. Maximum size is 1GB.'));
          } else {
            reject(err);
          }
        } else {
          resolve([fields, files]);
        }
      });
    });

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
    
    const clipFile = files.clipFile;

    if (!clipFile) {
      return res.status(400).json({ error: 'No clip file provided' });
    }

    // Upload to Vercel Blob Storage
    const fileBuffer = fs.readFileSync(clipFile.filepath);
    
    const blob = await put(clipFile.originalFilename, fileBuffer, {
      access: 'public',
    });

    // Clean up temporary file
    fs.unlinkSync(clipFile.filepath);

    // Create email transporter
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
    const fileSizeGB = (clipFile.size / (1024 * 1024 * 1024)).toFixed(2);
    const fileSizeMB = (clipFile.size / (1024 * 1024)).toFixed(2);
    const displaySize = clipFile.size > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;

    // Create email message
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'alberto.zappala360@gmail.com',
      subject: `🎬 New Clip Submission: ${clipTypeLabels[clipType] || clipType}`,
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
                .download-link { background: #ff6b6b; color: white; padding: 15px 25px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 15px 0; font-weight: bold; text-align: center; }
                .file-info { background: #e3f2fd; padding: 10px; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 New Clip Received!</h1>
                    <p>Clip Type: ${clipTypeLabels[clipType] || clipType}</p>
                </div>
                <div class="content">
                    <div class="field">
                        <span class="label">👤 Submitted by:</span>
                        <span class="value">${name} (${email})</span>
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
                    
                    <div class="file-info">
                        <div class="field">
                            <span class="label">📁 File Name:</span>
                            <span class="value">${clipFile.originalFilename}</span>
                        </div>
                        <div class="field">
                            <span class="label">📊 File Size:</span>
                            <span class="value">${displaySize}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${blob.url}" class="download-link" target="_blank">
                            📥 DOWNLOAD CLIP (${displaySize})
                        </a>
                        <p><small>Link expires in 1 hour</small></p>
                    </div>
                    
                    <div class="rights-box">
                        <strong>✅ Rights Agreement Confirmed:</strong><br>
                        Submitter has agreed to all terms including YouTube publication rights and copyright transfer.
                    </div>
                    
                    <p><em>Clip stored securely in Vercel Blob Storage and available for download via the link above.</em></p>
                </div>
            </div>
        </body>
        </html>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: `Clip submitted successfully! Download link sent to your email.` 
    });

  } catch (error) {
    console.error('Error processing submission:', error);
    
    if (error.message.includes('File too large')) {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 1GB.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
};