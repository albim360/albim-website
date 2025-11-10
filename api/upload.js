const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify reCAPTCHA
        const recaptchaToken = req.body.recaptchaToken;
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
        
        const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
        });

        const recaptchaData = await recaptchaResponse.json();
        
        if (!recaptchaData.success || recaptchaData.score < 0.5) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }

        // Process form data
        const { name, email, clipType, bugSpecific, description } = req.body;
        const clipFile = req.files?.clipFile;

        if (!clipFile) {
            return res.status(400).json({ error: 'No clip file provided' });
        }

        // Create email transporter
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
                            
                            <div class="field">
                                <span class="label">📁 File Info:</span>
                                <span class="value">${clipFile.name} (${(clipFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                            </div>
                            
                            <div class="rights-box">
                                <strong>✅ Rights Agreement Confirmed:</strong><br>
                                Submitter has agreed to all terms including YouTube publication rights and copyright transfer.
                            </div>
                            
                            <p><em>Clip file is attached to this email.</em></p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            attachments: [
                {
                    filename: clipFile.name,
                    content: clipFile.data,
                    contentType: clipFile.type
                }
            ]
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            success: true, 
            message: 'Clip submitted successfully' 
        });

    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).json({ 
            error: 'Internal server error: ' + error.message 
        });
    }
};