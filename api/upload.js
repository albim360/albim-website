const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
const mega = require('megajs');
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
    // Parse form data
    const form = formidable({
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
      multiples: false
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          if (err.code === 'maxFileSizeExceeded') {
            reject(new Error('File too large. Maximum size is 2GB.'));
          } else {
            reject(err);
          }
        } else {
          resolve({ fields, files });
        }
      });
    });

    console.log('Fields received:', Object.keys(fields));
    console.log('Files received:', files);

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

    // Check if file exists
    const clipFile = files.clipFile;
    if (!clipFile) {
      console.log('No clip file found in files:', files);
      return res.status(400).json({ error: 'No clip file provided' });
    }

    const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Upload to MEGA
    const megaResult = await uploadToMega(clipFile, name, email, description, submissionId);

    // Send email notification
    await sendEmailNotification(name, email, clipType, bugSpecific, description, clipFile, submissionId, megaResult);

    res.status(200).json({ 
      success: true, 
      message: 'Clip uploaded successfully to MEGA!',
      submissionId: submissionId,
      downloadUrl: megaResult.downloadUrl
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

// ✅ FUNZIONE UPLOAD SU MEGA REALE
async function uploadToMega(file, name, email, description, submissionId) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting MEGA upload...');
      
      // Crea una cartella con nome unico
      const folderName = `Clip_${submissionId}_${Date.now()}`;
      
      // Upload su MEGA
      const storage = await mega.storage({
        email: process.env.MEGA_EMAIL,
        password: process.env.MEGA_PASSWORD
      });

      console.log('Logged into MEGA successfully');

      // Aspetta che lo storage sia pronto
      await new Promise((resolve, reject) => {
        storage.on('ready', resolve);
        storage.on('error', reject);
      });

      // Crea cartella nella root
      const folder = await storage.mkdir(folderName);
      console.log('Folder created:', folderName);

      // Leggi il file
      const fileBuffer = fs.readFileSync(file.filepath);
      
      // Upload del file
      console.log('Uploading file to MEGA...');
      const uploadedFile = await folder.upload(file.originalFilename, fileBuffer);
      console.log('File uploaded successfully');

      // Crea link di download
      const downloadUrl = await uploadedFile.link();
      console.log('Download URL created:', downloadUrl);

      // Pulisci il file temporaneo
      fs.unlinkSync(file.filepath);

      resolve({
        fileName: file.originalFilename,
        downloadUrl: downloadUrl,
        folderName: folderName
      });

    } catch (error) {
      console.error('MEGA upload error:', error);
      
      // Pulisci il file temporaneo anche in caso di errore
      try {
        if (file && file.filepath) {
          fs.unlinkSync(file.filepath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
      
      reject(new Error('Failed to upload to MEGA: ' + error.message));
    }
  });
}

// Send email notification per MEGA
async function sendEmailNotification(name, userEmail, clipType, bugSpecific, description, file, submissionId, megaResult) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Format clip type for display
    const clipTypeLabels = {
      funny: '😂 Funny Moment',
      epic: '🔥 Epic Play', 
      bug: '🐛 Game Bug',
      fail: '💥 Funny Fail',
      other: '📁 Other'
    };

    // Calculate file size for display
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
    const displaySize = file.size > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'alberto.zappala360@gmail.com',
      subject: `🎬 CLIP UPLOADED TO MEGA: ${clipTypeLabels[clipType] || clipType} - ${submissionId}`,
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
                .mega-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
                .download-btn { background: #d32f2f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 Clip Auto-Uploaded to MEGA!</h1>
                    <p>File automatically saved to your MEGA account</p>
                </div>
                <div class="content">
                    <div class="field">
                        <span class="label">👤 Submitted by:</span>
                        <span class="value">${name} (${userEmail})</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">🎮 Clip Type:</span>
                        <span class="value">${clipTypeLabels[clipType] || clipType}</span>
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
                    
                    <div class="mega-box">
                        <strong>☁️ Automatically Saved to MEGA</strong><br>
                        File successfully uploaded to your MEGA account.<br>
                        <strong>Submission ID:</strong> ${submissionId}<br>
                        <strong>Folder:</strong> ${megaResult.folderName}
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${megaResult.downloadUrl}" class="download-btn" target="_blank">
                           📥 DOWNLOAD FROM MEGA
                        </a>
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
    console.log('Notification email sent successfully');
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    // Non blocchiamo l'upload se l'email fallisce
  }
}