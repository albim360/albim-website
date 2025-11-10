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

    // File info display (SOLO per mostrare all'utente)
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
                    showMessage(`File selected: ${fileSizeGB} GB - Will be uploaded via WeTransfer`, 'success');
                } else {
                    showMessage(`File selected: ${fileSizeMB} MB - Will be uploaded via WeTransfer`, 'success');
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
            
            // **IMPORTANTE: SOLO METADATI, NESSUN FILE**
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('clipType', document.getElementById('clipType').value);
            formData.append('bugSpecific', document.getElementById('bugSpecific').value);
            formData.append('description', description);
            formData.append('recaptchaToken', token);
            
            // **SOLO INFO FILE (METADATI) - NESSUN FILE CONTENT**
            formData.append('fileName', file.name);
            formData.append('fileSize', file.size.toString());
            formData.append('fileType', file.type);

            // Send to API (SOLO metadati, pochi KB)
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
                showMessage('✅ Submission received! Opening WeTransfer...', 'success');
                
                // Apri WeTransfer in nuova finestra
                setTimeout(() => {
                    window.open('https://wetransfer.com/', '_blank');
                }, 1000);
                
                form.reset();
                bugSpecificGroup.style.display = 'none';
                fileInput.value = '';
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(loading) {
        if (loading) {
            submitBtn.disabled = true;
            btnText.textContent = 'Processing...';
            btnSpinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Clip Request';
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