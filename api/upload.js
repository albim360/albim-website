const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');

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
    // Parse SOLO metadati - NO FILE UPLOAD
    const form = formidable({
      maxFields: 20,
      maxFieldsSize: 2 * 1024 * 1024, // 2MB per i campi testo
      maxFileSize: 0, // IMPORTANTE: NESSUN FILE
      multiples: false
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve([fields, fields]); // Secondo parametro è fields invece di files
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

    // Process form data (SOLO METADATI)
    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
    const clipType = Array.isArray(fields.clipType) ? fields.clipType[0] : fields.clipType;
    const bugSpecific = Array.isArray(fields.bugSpecific) ? fields.bugSpecific[0] : fields.bugSpecific;
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
    const fileName = Array.isArray(fields.fileName) ? fields.fileName[0] : fields.fileName;
    const fileSize = Array.isArray(fields.fileSize) ? fields.fileSize[0] : fields.fileSize;
    const fileType = Array.isArray(fields.fileType) ? fields.fileType[0] : fields.fileType;

    // Validazione campi obbligatori
    if (!name || !email || !description) {
      return res.status(400).json({ error: 'Missing required fields: name, email, description' });
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Generate unique submission ID
    const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Send email notification
    await sendEmailNotification(name, email, clipType, bugSpecific, description, fileName, fileSize, fileType, submissionId);

    res.status(200).json({ 
      success: true, 
      message: 'Submission received! Open WeTransfer to upload your file.',
      submissionId: submissionId,
      weTransferUrl: 'https://wetransfer.com/'
    });

  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
};

// Funzione per inviare email di notifica
async function sendEmailNotification(name, email, clipType, bugSpecific, description, fileName, fileSize, fileType, submissionId) {
  const transporter = nodemailer.createTransporter({
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
  let displaySize = 'Unknown size';
  if (fileSize) {
    const fileSizeNum = parseInt(fileSize);
    const fileSizeMB = (fileSizeNum / (1024 * 1024)).toFixed(2);
    const fileSizeGB = (fileSizeNum / (1024 * 1024 * 1024)).toFixed(2);
    displaySize = fileSizeNum > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;
  }

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
              .instruction-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
              .contact-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎬 New Clip Submission Received!</h1>
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
                  
                  ${fileName ? `
                  <div class="field">
                      <span class="label">📁 File Info:</span>
                      <span class="value">${fileName} (${displaySize}${fileType ? ', ' + fileType : ''})</span>
                  </div>
                  ` : ''}
                  
                  <div class="instruction-box">
                      <strong>📤 WeTransfer Upload Required</strong><br>
                      User has been directed to upload their file via WeTransfer.<br>
                      <strong>Submission ID:</strong> ${submissionId}<br>
                      <strong>Expected File:</strong> ${fileName || 'Not specified'}
                  </div>
                  
                  <div class="contact-box">
                      <strong>📧 Contact Information</strong><br>
                      <strong>User Email:</strong> ${email}<br>
                      <strong>User Name:</strong> ${name}<br>
                      Contact them directly if the file doesn't arrive via WeTransfer.
                  </div>
                  
                  <div class="rights-box">
                      <strong>✅ Rights Agreement Confirmed</strong><br>
                      Submitter has agreed to all terms including:<br>
                      • YouTube publication rights<br>
                      • Copyright transfer<br>
                      • No compensation claims<br>
                      • Ownership verification
                  </div>
                  
                  <div style="text-align: center; margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                      <strong>Submission Time:</strong> ${new Date().toLocaleString('it-IT')}<br>
                      <strong>Submission ID:</strong> ${submissionId}
                  </div>
              </div>
          </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully for submission:', submissionId);
  } catch (emailError) {
    console.error('Failed to send notification email:', emailError);
    throw new Error('Failed to send notification email');
  }
}