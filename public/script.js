document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const clipTypeSelect = document.getElementById('clipType');
    const bugSpecificGroup = document.getElementById('bugSpecificGroup');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const messageDiv = document.getElementById('message');
    const fileInput = document.getElementById('clipFile');

    // Show/hide bug specification field
    clipTypeSelect.addEventListener('change', function() {
        if (this.value === 'bug') {
            bugSpecificGroup.style.display = 'block';
        } else {
            bugSpecificGroup.style.display = 'none';
        }
    });

    // File info display
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
            if (file.size > maxSize) {
                showMessage('File size must be less than 2GB', 'error');
                this.value = '';
            } else {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
                if (file.size > 1024 * 1024 * 1024) {
                    showMessage(`File selected: ${fileSizeGB} GB - Ready for Google Drive upload`, 'success');
                } else {
                    showMessage(`File selected: ${fileSizeMB} MB - Ready for Google Drive upload`, 'success');
                }
            }
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validazione campi obbligatori
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const description = document.getElementById('description').value;
        
        if (!name || !email || !description) {
            showMessage('Please fill all required fields', 'error');
            return;
        }

        // Validazione email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }

        // Validazione file
        const file = fileInput.files[0];
        if (!file) {
            showMessage('Please select a clip file', 'error');
            return;
        }

        // Validazione tipo file
        const validTypes = [
            'video/mp4', 
            'video/quicktime', 
            'video/avi', 
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm'
        ];
        if (!validTypes.includes(file.type)) {
            showMessage('Please upload a valid video file (MP4, MOV, AVI, MKV, WEBM)', 'error');
            return;
        }

        setLoading(true);

        try {
            // Get reCAPTCHA v3 token
            const token = await grecaptcha.execute('6LcolggsAAAAAIXx3zwptDhS2ArV8v29-Uc2x_Td', {action: 'submit'});
            
            // **IMPORTANTE: ORA INVIAMO ANCHE IL FILE per Google Drive**
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('clipType', document.getElementById('clipType').value);
            formData.append('bugSpecific', document.getElementById('bugSpecific').value);
            formData.append('description', description);
            formData.append('recaptchaToken', token);
            formData.append('clipFile', file); // FILE INCLUSO per Google Drive

            // Send to API (CON file per Google Drive)
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                showDriveSuccessMessage(file.name, result.submissionId, result.driveUrl);
                
                form.reset();
                bugSpecificGroup.style.display = 'none';
                fileInput.value = '';
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });

    // Funzione per mostrare successo Google Drive
    function showDriveSuccessMessage(fileName, submissionId, driveUrl) {
        const file = fileInput.files[0];
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
        const displaySize = file.size > 1024 * 1024 * 1024 ? `${fileSizeGB} GB` : `${fileSizeMB} MB`;
        
        const html = `
            <div style="text-align: center;">
                <h3 style="color: #155724; margin-bottom: 15px;">🎬 Upload Successful!</h3>
                
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                    <strong>✅ File uploaded to Google Drive!</strong><br>
                    <strong>File:</strong> ${fileName} (${displaySize})<br>
                    <strong>Submission ID:</strong> ${submissionId}<br>
                    <strong>Status:</strong> Saved securely in Google Drive
                </div>

                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                    <strong>📧 Notification Sent</strong><br>
                    Alberto has been notified and can access your clip immediately in Google Drive.
                </div>

                ${driveUrl ? `
                <a href="${driveUrl}" target="_blank" 
                   style="background: #34a853; color: white; padding: 15px 30px; border-radius: 8px; 
                          text-decoration: none; font-weight: bold; display: inline-block; margin: 10px 0;">
                   👀 VIEW IN GOOGLE DRIVE
                </a>
                ` : ''}
                
                <div style="margin-top: 15px; font-size: 14px; color: #666;">
                    Thank you for your submission! Your clip will be reviewed soon.
                </div>
            </div>
        `;
        
        messageDiv.innerHTML = html;
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';
    }

    function setLoading(loading) {
        if (loading) {
            submitBtn.disabled = true;
            btnText.textContent = 'Uploading to Google Drive...';
            btnSpinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Clip to Google Drive';
            btnSpinner.style.display = 'none';
        }
    }

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});