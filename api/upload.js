const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const formidable = require('formidable');
const mega = require('mega');
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
    // Parse form data CON il file
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

    // ✅ UPLOAD AUTOMATICO SUL TUO MEGA
    console.log('Starting automatic upload to YOUR MEGA account...');
    const megaResult = await uploadToYourMega(clipFile, name, email, description, submissionId);

    // ✅ INVIA EMAIL DI NOTIFICA
    await sendSuccessNotification(name, email, clipType, description, clipFile, submissionId, megaResult);

    res.status(200).json({ 
      success: true, 
      message: 'Clip automatically uploaded to your MEGA account!',
      submissionId: submissionId,
      downloadUrl: megaResult.downloadUrl,
      fileName: megaResult.fileName
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

// ✅ FUNZIONE UPLOAD AUTOMATICO SUL TUO MEGA
async function uploadToYourMega(file, name, email, description, submissionId) {
  try {
    console.log('Connecting to YOUR MEGA account...');
    
    // Configura con le TUE credenziali Mega
    const storage = mega({
      email: process.env.MEGA_EMAIL, // Il TUO email Mega
      password: process.env.MEGA_PASSWORD // La TUA password Mega
    });

    // Attendiamo il login
    await storage.ready;
    console.log('✅ Successfully logged into YOUR MEGA account');

    // Crea nome file unico
    const uniqueFileName = `${submissionId}_${file.originalFilename}`;
    
    // ✅ CERCA O CREA LA CARTELLA "Albim-YT"
    let albimFolder;
    try {
      // Prova a trovare la cartella esistente
      const root = storage.root;
      const folders = await root.children;
      
      albimFolder = folders.find(folder => 
        folder.name === 'Albim-YT' || 
        folder.name === 'albim-yt' ||
        folder.name === 'Albim-YouTube'
      );
      
      if (!albimFolder) {
        // Se non esiste, creala
        console.log('Creating "Albim-YT" folder...');
        albimFolder = await storage.mkdir('Albim-YT');
        console.log('✅ Created "Albim-YT" folder');
      } else {
        console.log('✅ Found existing "Albim-YT" folder');
      }
    } catch (folderError) {
      console.log('Creating "Albim-YT" folder...');
      albimFolder = await storage.mkdir('Albim-YT');
      console.log('✅ Created "Albim-YT" folder');
    }

    // ✅ UPLOAD DEL FILE NELLA CARTELLA "Albim-YT"
    console.log(`Uploading file to Albim-YT folder: ${uniqueFileName}`);
    const uploadedFile = await storage.upload(uniqueFileName, file.filepath, albimFolder);
    console.log('✅ File uploaded successfully to Albim-YT');

    // ✅ CREA LINK DI DOWNLOAD PUBBLICO
    const downloadUrl = await storage.link(uploadedFile);
    console.log('✅ Public download link created:', downloadUrl);

    // Pulisci il file temporaneo
    fs.unlinkSync(file.filepath);

    return {
      fileName: uniqueFileName,
      downloadUrl: downloadUrl,
      folder: 'Albim-YT',
      submissionId: submissionId
    };

  } catch (error) {
    console.error('❌ MEGA upload error:', error);
    
    // Pulisci file temporaneo in caso di errore
    try {
      if (file && file.filepath) {
        fs.unlinkSync(file.filepath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp file:', cleanupError);
    }
    
    // Errori specifici di Mega
    if (error.message.includes('Invalid email')) {
      throw new Error('Invalid MEGA account credentials');
    } else if (error.message.includes('Invalid password')) {
      throw new Error('Invalid MEGA password');
    } else if (error.message.includes('ENOTFOUND')) {
      throw new Error('Cannot connect to MEGA servers');
    }
    
    throw new Error('Failed to upload to MEGA: ' + error.message);
  }
}

// ✅ INVIA EMAIL DI SUCCESSO
async function sendSuccessNotification(name, userEmail, clipType, description, file, submissionId, megaResult) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
    const displaySize = file.size > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;

    const clipTypeLabels = {
      funny: '😂 Funny Moment',
      epic: '🔥 Epic Play', 
      bug: '🐛 Game Bug',
      fail: '💥 Funny Fail',
      other: '📁 Other'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'alberto.zappala360@gmail.com', // Il TUO email
      subject: `🎬 NEW CLIP IN ALBIM-YT: ${submissionId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .success-box { background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .mega-box { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .download-btn { background: #d32f2f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎬 Clip Auto-Uploaded to Albim-YT!</h1>
                    <p>File automatically saved in your MEGA folder</p>
                </div>
                <div class="content">
                    <div class="success-box">
                        <strong>✅ AUTOMATIC UPLOAD SUCCESSFUL</strong><br>
                        File automatically uploaded to your "Albim-YT" MEGA folder.
                    </div>
                    
                    <div><strong>👤 From:</strong> ${name} (${userEmail})</div>
                    <div><strong>🎮 Type:</strong> ${clipTypeLabels[clipType] || clipType}</div>
                    <div><strong>📝 Description:</strong> ${description}</div>
                    <div><strong>📁 File:</strong> ${file.originalFilename} (${displaySize})</div>
                    
                    <div class="mega-box">
                        <strong>☁️ MEGA Details:</strong><br>
                        <strong>Folder:</strong> Albim-YT<br>
                        <strong>Saved as:</strong> ${megaResult.fileName}<br>
                        <strong>Submission ID:</strong> ${submissionId}
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${megaResult.downloadUrl}" class="download-btn" target="_blank">
                           📥 DOWNLOAD FROM MEGA
                        </a>
                    </div>
                </div>
            </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Success notification email sent');
    
  } catch (error) {
    console.error('Error sending email:', error);
    // Non blocchiamo l'upload se l'email fallisce
  }
}