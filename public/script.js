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

    // File size validation
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const maxSize = 1 * 1024 * 1024 * 1024; // 1GB
            if (file.size > maxSize) {
                showMessage('File size must be less than 1GB', 'error');
                this.value = '';
            } else {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
                if (file.size > 1024 * 1024 * 1024) {
                    showMessage(`File selected: ${fileSizeGB} GB`, 'success');
                } else {
                    showMessage(`File selected: ${fileSizeMB} MB`, 'success');
                }
            }
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate file
        const file = fileInput.files[0];
        if (!file) {
            showMessage('Please select a clip file', 'error');
            return;
        }

        // Validate file type
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
            const token = await grecaptcha.execute('6LephAgsAAAAAC80hvaotX1CWEe14rgtLIAskZxO', {action: 'submit'});
            
            // Create FormData
            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('email', document.getElementById('email').value);
            formData.append('clipType', document.getElementById('clipType').value);
            formData.append('bugSpecific', document.getElementById('bugSpecific').value);
            formData.append('description', document.getElementById('description').value);
            formData.append('clipFile', file);
            formData.append('recaptchaToken', token);

            // Send to API
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showMessage('✅ Clip submitted successfully! Thank you!', 'success');
                form.reset();
                bugSpecificGroup.style.display = 'none';
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
            btnText.textContent = 'Submitting...';
            btnSpinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Clip';
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