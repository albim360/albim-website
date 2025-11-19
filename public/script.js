// Inizializza EmailJS
emailjs.init("AfY2qgV3ETueAukZ5");

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
    const clipTypeSelect = document.getElementById('clipType');
    const bugSpecificGroup = document.getElementById('bugSpecificGroup');
    const form = document.getElementById('uploadForm');

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

    // Mostra/nascondi campo bug
    clipTypeSelect.addEventListener('change', function() {
        if (this.value === 'bug') {
            bugSpecificGroup.style.display = 'block';
        } else {
            bugSpecificGroup.style.display = 'none';
        }
    });

    // ✅ SUBMIT FORM - SOLO EMAIL CON ISTRUZIONI MEGA
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('=== MEGA UPLOAD PROCESS STARTED ===');
        
        if (!validateStep2()) {
            return;
        }

        const agreeRights = document.getElementById('agreeRights');
        if (!agreeRights.checked) {
            showMessage('You must agree to the rights agreement', 'error');
            return;
        }

        const fileInput = document.getElementById('clipFile');
        const file = fileInput.files[0];
        if (!file) {
            showMessage('Please select a clip file', 'error');
            return;
        }

        setLoading(true);

        try {
            // ✅ Prepara i dati per l'email
            const submissionData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                clipType: document.getElementById('clipType').value,
                bugSpecific: document.getElementById('bugSpecific').value || 'N/A',
                description: document.getElementById('description').value,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
                fileSizeBytes: file.size,
                submissionId: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                uploadTime: new Date().toLocaleString('it-IT')
            };

            console.log('Submission data:', submissionData);

            // ✅ Invia email di notifica ad Albim
            console.log('Sending notification to Albim...');
            await sendNotificationToAlbim(submissionData);
            
            // ✅ Invia email di istruzioni all'utente
            console.log('Sending instructions to user...');
            await sendInstructionsToUser(submissionData);
            
            // ✅ Mostra successo
            showSuccessMessage(submissionData.fileName, submissionData.submissionId);
            
            // ✅ Reset form
            form.reset();
            resetForm();

        } catch (error) {
            console.error('=== PROCESS ERROR ===:', error);
            showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });
});

// ✅ INVIA EMAIL DI NOTIFICA AD ALBIM
async function sendNotificationToAlbim(data) {
    try {
        const templateParams = {
            to_email: 'alberto.zappala360@gmail.com',
            from_name: data.name,
            from_email: data.email,
            submission_id: data.submissionId,
            clip_type: data.clipType,
            description: data.description,
            file_name: data.fileName,
            file_size: data.fileSize,
            bug_details: data.bugSpecific,
            upload_time: data.uploadTime,
            user_email: data.email,
            user_name: data.name
        };

        const response = await emailjs.send(
            'default_service', // Service ID - usa 'default_service' o creane uno su EmailJS
            'template_albim_notification', // Template ID - dovrai creare questo template
            templateParams
        );

        console.log('Email to Albim sent successfully:', response);
        return true;

    } catch (error) {
        console.error('Error sending email to Albim:', error);
        throw new Error('Failed to send notification email');
    }
}

// ✅ INVIA EMAIL DI ISTRUZIONI ALL'UTENTE
async function sendInstructionsToUser(data) {
    try {
        const templateParams = {
            to_email: data.email,
            to_name: data.name,
            submission_id: data.submissionId,
            file_name: data.fileName,
            file_size: data.fileSize,
            upload_time: data.uploadTime,
            user_name: data.name
        };

        const response = await emailjs.send(
            'default_service', // Service ID
            'template_user_instructions', // Template ID - dovrai creare questo template
            templateParams
        );

        console.log('Instructions email sent successfully:', response);
        return true;

    } catch (error) {
        console.error('Error sending instructions email:', error);
        // Non blocchiamo il processo se questa email fallisce
        return false;
    }
}

// ✅ FUNZIONE FORMATTA DIMENSIONE FILE
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
        const displaySize = formatFileSize(file.size);
        
        fileName.textContent = file.name;
        fileSize.textContent = displaySize;
        
        filePreview.style.display = 'block';
        uploadZone.style.display = 'none';
        nextBtn.disabled = false;
        
        showMessage(`File selected: ${file.name} (${displaySize}) - Ready for submission`, 'success');
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
        const displaySize = formatFileSize(file.size);
        document.getElementById('reviewFileName').textContent = `${file.name} (${displaySize})`;
    }
    
    document.getElementById('reviewName').textContent = document.getElementById('name').value;
    document.getElementById('reviewEmail').textContent = document.getElementById('email').value;
    document.getElementById('reviewClipType').textContent = document.getElementById('clipType').options[document.getElementById('clipType').selectedIndex].text;
    document.getElementById('reviewDescription').textContent = document.getElementById('description').value;
}

function setLoading(loading) {
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    
    if (loading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
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

// ✅ FUNZIONE SUCCESSO
function showSuccessMessage(fileName, submissionId) {
    const fileInput = document.getElementById('clipFile');
    const file = fileInput.files[0];
    const displaySize = file ? formatFileSize(file.size) : '0 MB';
    
    const html = `
        <div style="text-align: center;">
            <h3 style="color: #155724; margin-bottom: 15px;">✅ Submission Received!</h3>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <strong>📧 Check Your Email!</strong><br>
                We've sent you detailed instructions to upload your clip to MEGA.<br>
                <strong>File:</strong> ${fileName} (${displaySize})<br>
                <strong>Submission ID:</strong> ${submissionId}
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <strong>📤 Next Steps:</strong>
                <ol style="text-align: left; margin: 10px 0;">
                    <li><strong>Check your email</strong> for MEGA upload instructions</li>
                    <li><strong>Upload your file</strong> to MEGA following the steps</li>
                    <li><strong>Reply to the email</strong> with your MEGA download link</li>
                    <li><strong>We'll review</strong> your clip for potential feature</li>
                </ol>
            </div>
            
            <div style="margin-top: 15px; font-size: 14px; color: #666;">
                Thank you for your submission! Follow the email instructions to complete the upload.
            </div>
        </div>
    `;
    
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = html;
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

// Funzioni modal
function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}