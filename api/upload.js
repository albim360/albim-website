const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
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

    // ✅ SOLUZIONE SEMPLICE: Salva i dettagli e invia email, poi l'utente caricherà manualmente su Mega
    await handleSubmission(name, email, clipType, bugSpecific, description, clipFile, submissionId);

    res.status(200).json({ 
      success: true, 
      message: 'Submission received! We will contact you with upload instructions.',
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

// ✅ FUNZIONE SEMPLIFICATA - Solo email senza upload automatico
async function handleSubmission(name, userEmail, clipType, bugSpecific, description, file, submissionId) {
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

    // Email per ALBIM
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
                .upload-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                .action-btn { background: #28a745; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 New Clip Submission!</h1>
                    <p>Waiting for file upload</p>
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
                    
                    <div class="upload-box">
                        <strong>📤 ACTION REQUIRED:</strong><br>
                        Contact ${userEmail} to receive the clip file via MEGA.<br>
                        <strong>Submission ID:</strong> ${submissionId}
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="mailto:${userEmail}?subject=Clip Upload Instructions - ${submissionId}&body=Hi ${name},%0D%0A%0D%0APlease upload your clip to MEGA and share the download link.%0D%0A%0D%0AFile: ${file.originalFilename}%0D%0ASubmission ID: ${submissionId}%0D%0A%0D%0AThanks!" class="action-btn">
                           📧 Email Upload Instructions
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

    // Email per l'utente (conferma)
    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `🎬 Clip Submission Received - ${submissionId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .upload-steps { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 Submission Received!</h1>
                    <p>Thank you for your clip submission</p>
                </div>
                <div class="content">
                    <div class="info-box">
                        <strong>✅ Submission Confirmed</strong><br>
                        We've received your clip details and will contact you shortly with upload instructions.
                    </div>
                    
                    <div class="upload-steps">
                        <h3>📤 Next Steps:</h3>
                        <ol>
                            <li><strong>Wait for our email</strong> with MEGA upload instructions</li>
                            <li><strong>Upload your clip</strong> to MEGA when requested</li>
                            <li><strong>Share the download link</strong> with us</li>
                            <li><strong>Your clip will be reviewed</strong> for potential feature</li>
                        </ol>
                    </div>
                    
                    <div style="text-align: center; margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <strong>Submission ID:</strong> ${submissionId}<br>
                        <strong>File:</strong> ${file.originalFilename} (${displaySize})<br>
                        <strong>Submitted:</strong> ${new Date().toLocaleString('it-IT')}
                    </div>
                    
                    <p style="text-align: center; margin-top: 20px; color: #666;">
                        If you have any questions, reply to this email.
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
    
    // Pulisci il file temporaneo
    try {
      if (file && file.filepath) {
        fs.unlinkSync(file.filepath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp file:', cleanupError);
    }
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}