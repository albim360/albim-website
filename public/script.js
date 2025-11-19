// Gestione Steps
let currentStep = 1;

function nextStep() {
    if (currentStep < 3) {
        // Validazione prima di procedere
        if (currentStep === 1 && !validateStep1()) {
            return;
        }
        if (currentStep === 2 && !validateStep2()) {
            return;
        }
        
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}-content`).classList.remove('active');
        
        currentStep++;
        
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}-content`).classList.add('active');
        
        // Aggiorna review nella step 3
        if (currentStep === 3) {
            updateReview();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}-content`).classList.remove('active');
        
        currentStep--;
        
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}-content`).classList.add('active');
    }
}

function validateStep1() {
    const fileInput = document.getElementById('clipFile');
    if (!fileInput.files[0]) {
        showMessage('Please select a clip file to upload', 'error');
        return false;
    }
    return true;
}

function validateStep2() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const clipType = document.getElementById('clipType').value;
    const description = document.getElementById('description').value;
    
    if (!name || !email || !clipType || !description) {
        showMessage('Please fill all required fields', 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address', 'error');
        return false;
    }
    
    return true;
}

// Gestione Upload Zone
document.addEventListener('DOMContentLoaded', function() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('clipFile');
    const filePreview = document.getElementById('filePreview');
    const nextBtn = document.getElementById('nextBtn');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    // Click sulla upload zone
    uploadZone.addEventListener('click', function() {
        fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', function() {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelection();
        }
    });

    // Cambio file
    fileInput.addEventListener('change', handleFileSelection);
});

function handleFileSelection() {
    const fileInput = document.getElementById('clipFile');
    const filePreview = document.getElementById('filePreview');
    const nextBtn = document.getElementById('nextBtn');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const uploadZone = document.getElementById('uploadZone');
    
    const file = fileInput.files[0];
    
    if (file) {
        // Validazione file
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        const validTypes = [
            'video/mp4', 
            'video/quicktime', 
            'video/avi', 
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm'
        ];
        
        if (file.size > maxSize) {
            showMessage('File size must be less than 2GB', 'error');
            fileInput.value = '';
            return;
        }
        
        if (!validTypes.includes(file.type)) {
            showMessage('Please upload a valid video file (MP4, MOV, AVI, MKV, WEBM)', 'error');
            fileInput.value = '';
            return;
        }
        
        // Mostra preview
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
        const displaySize = file.size > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;
        
        fileName.textContent = file.name;
        fileSize.textContent = displaySize;
        
        filePreview.style.display = 'block';
        uploadZone.style.display = 'none';
        nextBtn.disabled = false;
        
        showMessage(`File selected: ${file.name} (${displaySize}) - Ready for upload`, 'success');
    }
}

function removeFile() {
    const fileInput = document.getElementById('clipFile');
    const filePreview = document.getElementById('filePreview');
    const uploadZone = document.getElementById('uploadZone');
    const nextBtn = document.getElementById('nextBtn');
    
    fileInput.value = '';
    filePreview.style.display = 'none';
    uploadZone.style.display = 'block';
    nextBtn.disabled = true;
}

// Aggiorna review
function updateReview() {
    const fileInput = document.getElementById('clipFile');
    const file = fileInput.files[0];
    
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
        const displaySize = file.size > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;
        
        document.getElementById('reviewFileName').textContent = `${file.name} (${displaySize})`;
    }
    
    document.getElementById('reviewName').textContent = document.getElementById('name').value;
    document.getElementById('reviewEmail').textContent = document.getElementById('email').value;
    document.getElementById('reviewClipType').textContent = document.getElementById('clipType').options[document.getElementById('clipType').selectedIndex].text;
    document.getElementById('reviewDescription').textContent = document.getElementById('description').value;
}

// Gestione form submit (esistente ma migliorato)
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const clipTypeSelect = document.getElementById('clipType');
    const bugSpecificGroup = document.getElementById('bugSpecificGroup');

    // Mostra/nascondi campo bug
    clipTypeSelect.addEventListener('change', function() {
        if (this.value === 'bug') {
            bugSpecificGroup.style.display = 'block';
        } else {
            bugSpecificGroup.style.display = 'none';
        }
    });

    // Submit form
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateStep2()) {
            return;
        }

        const agreeRights = document.getElementById('agreeRights');
        if (!agreeRights.checked) {
            showMessage('You must agree to the rights agreement', 'error');
            return;
        }

        setLoading(true);

        try {
            // Il resto del tuo codice di submit rimane uguale...
            const token = await grecaptcha.execute('6LcolggsAAAAAIXx3zwptDhS2ArV8v29-Uc2x_Td', {action: 'submit'});
            
            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('email', document.getElementById('email').value);
            formData.append('clipType', document.getElementById('clipType').value);
            formData.append('bugSpecific', document.getElementById('bugSpecific').value);
            formData.append('description', document.getElementById('description').value);
            formData.append('recaptchaToken', token);
            formData.append('clipFile', document.getElementById('clipFile').files[0]);

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
                showSuccessMessage(result.submissionId);
                form.reset();
                resetForm();
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
});

function setLoading(loading) {
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    
    if (loading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Uploading...';
        btnSpinner.style.display = 'block';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = '🎬 Submit Clip';
        btnSpinner.style.display = 'none';
    }
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function showSuccessMessage(submissionId) {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = `
        <div style="text-align: center;">
            <h3 style="color: #155724; margin-bottom: 15px;">✅ Upload Successful!</h3>
            <p>Your clip has been submitted successfully.</p>
            <p><strong>Submission ID:</strong> ${submissionId}</p>
            <p>Thank you for your submission!</p>
        </div>
    `;
    messageDiv.className = 'message success';
    messageDiv.style.display = 'block';
}

function resetForm() {
    currentStep = 1;
    
    // Reset steps UI
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.getElementById('step1').classList.add('active');
    
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('step1-content').classList.add('active');
    
    // Reset file preview
    removeFile();
    
    // Hide bug specific
    document.getElementById('bugSpecificGroup').style.display = 'none';
}

// Funzioni modal (se necessario)
function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

function openWeTransfer() {
    window.open('https://wetransfer.com', '_blank');
}