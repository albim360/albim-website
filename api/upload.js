const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

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
      multiples: false,
      keepExtensions: true
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

    // ✅ SOLUZIONE SEMPLICE E AFFIDABILE: Salva i dettagli e invia email con istruzioni Mega
    const fileInfo = await handleFileSubmission(clipFile, submissionId);
    
    // Invia email di notifica
    await sendEmailNotification(name, email, clipType, bugSpecific, description, clipFile, submissionId, fileInfo);

    res.status(200).json({ 
      success: true, 
      message: 'Submission received! Check your email for Mega upload instructions.',
      submissionId: submissionId
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

// ✅ Gestione file semplice - Salva temporaneamente e fornisce istruzioni
async function handleFileSubmission(file, submissionId) {
  try {
    // Crea cartella temporanea se non esiste
    const tempDir = path.join(process.cwd(), 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Nuovo nome file
    const newFileName = `${submissionId}_${file.originalFilename}`;
    const tempFilePath = path.join(tempDir, newFileName);

    // Copia il file temporaneamente
    fs.copyFileSync(file.filepath, tempFilePath);
    
    // Pulisci file temporaneo originale
    fs.unlinkSync(file.filepath);

    console.log('File saved temporarily:', tempFilePath);

    return {
      fileName: file.originalFilename,
      tempPath: tempFilePath,
      size: file.size,
      submissionId: submissionId
    };

  } catch (error) {
    console.error('Error handling file:', error);
    
    // Pulisci file temporaneo in caso di errore
    try {
      if (file && file.filepath) {
        fs.unlinkSync(file.filepath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp file:', cleanupError);
    }
    
    throw error;
  }
}

// ✅ Email con istruzioni dettagliate per Mega
async function sendEmailNotification(name, userEmail, clipType, bugSpecific, description, file, submissionId, fileInfo) {
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

    // Email per ALBIM (notifica)
    const albimMailOptions = {
      from: process.env.EMAIL_USER,
      to: 'alberto.zappala360@gmail.com',
      subject: `🎬 NEW CLIP SUBMISSION: ${clipTypeLabels[clipType] || clipType} - ${submissionId}`,
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
                .action-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                .instruction-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
                .btn { background: #28a745; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 New Clip Submission!</h1>
                    <p>Ready for Mega upload</p>
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
                        <span class="label">📁 File Info:</span>
                        <span class="value">${file.originalFilename} (${displaySize})</span>
                    </div>
                    
                    <div class="action-box">
                        <strong>📤 ACTION REQUIRED - MEGA UPLOAD</strong><br>
                        The user has been instructed to upload the file to Mega and share the link.<br>
                        <strong>Submission ID:</strong> ${submissionId}<br>
                        <strong>Expected File:</strong> ${file.originalFilename}
                    </div>
                    
                    <div class="instruction-box">
                        <strong>📧 Contact the user:</strong><br>
                        Email: ${userEmail}<br>
                        Ask them to share the Mega download link for: ${file.originalFilename}
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="mailto:${userEmail}?subject=MEGA Upload Instructions - ${submissionId}&body=Hi ${name},%0D%0A%0D%0APlease upload your clip '${file.originalFilename}' to MEGA and reply to this email with the download link.%0D%0A%0D%0AThanks!" class="btn">
                           📧 Send Upload Instructions
                        </a>
                    </div>
                    
                    <div style="text-align: center; margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <strong>Submission Time:</strong> ${new Date().toLocaleString('it-IT')}<br>
                        <strong>Submission ID:</strong> ${submissionId}<br>
                        <strong>File Size:</strong> ${displaySize}
                    </div>
                </div>
            </div>
        </body>
        </html>
      `
    };

    // Email per l'UTENTE (istruzioni)
    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `📤 MEGA Upload Instructions - ${submissionId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .step { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
                .mega-btn { background: #d32f2f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📤 Upload Your Clip to MEGA</h1>
                    <p>Follow these simple steps</p>
                </div>
                <div class="content">
                    <div class="step">
                        <strong>1. 📁 Go to MEGA</strong><br>
                        <a href="https://mega.nz" class="mega-btn" target="_blank">🌐 Open MEGA Website</a>
                    </div>
                    
                    <div class="step">
                        <strong>2. ⬆️ Upload Your File</strong><br>
                        File: <strong>${file.originalFilename}</strong> (${displaySize})<br>
                        - Login to your MEGA account<br>
                        - Click "Upload" and select your file<br>
                        - Wait for upload to complete
                    </div>
                    
                    <div class="step">
                        <strong>3. 🔗 Get Shareable Link</strong><br>
                        - Right-click on the uploaded file<br>
                        - Select "Get link" or "Share"<br>
                        - Copy the download link
                    </div>
                    
                    <div class="step">
                        <strong>4. 📧 Send Us the Link</strong><br>
                        Reply to this email with:<br>
                        - Your MEGA download link<br>
                        - Submission ID: <strong>${submissionId}</strong>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0; padding: 20px; background: #e8f5e8; border-radius: 8px;">
                        <strong>Submission Details:</strong><br>
                        <strong>File:</strong> ${file.originalFilename}<br>
                        <strong>Submission ID:</strong> ${submissionId}<br>
                        <strong>Submitted:</strong> ${new Date().toLocaleString('it-IT')}
                    </div>
                    
                    <p style="text-align: center; color: #666;">
                        Need help? Reply to this email for assistance.
                    </p>
                </div>
            </div>
        </body>
        </html>
      `
    };

    // Invia entrambe le email
    await transporter.sendMail(albimMailOptions);
    await transporter.sendMail(userMailOptions);
    
    console.log('Notification emails sent successfully');
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}