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

    // ✅ SUBMIT FORM - SOLO SALVATAGGIO DATI E REDIRECT A MEGA
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('=== MEGA UPLOAD PREPARATION ===');
        
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
            // ✅ Prepara i dati della submission
            const submissionData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                clipType: document.getElementById('clipType').value,
                bugSpecific: document.getElementById('bugSpecific').value || 'N/A',
                description: document.getElementById('description').value,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
                submissionId: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toLocaleString('it-IT')
            };

            console.log('Submission data prepared:', submissionData);

            // ✅ Salva i dati localmente (opzionale)
            saveSubmissionLocally(submissionData);
            
            // ✅ Redirect a MEGA per l'upload
            redirectToMegaUpload(file, submissionData);
            
        } catch (error) {
            console.error('Error:', error);
            showMessage(`❌ Error: ${error.message}`, 'error');
            setLoading(false);
        }
    });
});

// ✅ REDIRECT A MEGA PER UPLOAD
function redirectToMegaUpload(file, submissionData) {
    // Crea un nome file unico per Mega
    const uniqueFileName = `${submissionData.submissionId}_${file.name}`;
    
    // Prepara i dati per Mega
    const megaData = {
        fileName: uniqueFileName,
        fileSize: file.size,
        submissionId: submissionData.submissionId,
        userName: submissionData.name
    };
    
    // Salva i dati per dopo l'upload
    localStorage.setItem('megaUploadData', JSON.stringify(megaData));
    localStorage.setItem('submissionData', JSON.stringify(submissionData));
    
    // Mostra istruzioni per l'upload
    showMegaInstructions(file.name, submissionData.submissionId, file.size);
    
    setLoading(false);
}

// ✅ MOSTRA ISTRUZIONI MEGA
function showMegaInstructions(fileName, submissionId, fileSize) {
    const displaySize = formatFileSize(fileSize);
    
    const html = `
        <div style="text-align: center;">
            <h3 style="color: #155724; margin-bottom: 15px;">📤 Upload to MEGA</h3>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <strong>🚀 Ready to upload directly to MEGA!</strong><br><br>
                
                <div style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0;">
                    <strong>📋 File Details:</strong><br>
                    <strong>File:</strong> ${fileName}<br>
                    <strong>Size:</strong> ${displaySize}<br>
                    <strong>Submission ID:</strong> ${submissionId}
                </div>
                
                <div style="margin: 15px 0;">
                    <strong>📝 Instructions:</strong>
                    <ol style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        <li>Click the "Open MEGA" button below</li>
                        <li>Upload your file to MEGA</li>
                        <li>Get the shareable download link</li>
                        <li>Return here and submit the link</li>
                    </ol>
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center; margin: 20px 0;">
                <button onclick="openMegaWebsite()" style="background: #d32f2f; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                    🌐 OPEN MEGA
                </button>
                <button onclick="cancelUpload()" style="background: #6c757d; color: white; border: none; padding: 15px 20px; border-radius: 8px; cursor: pointer;">
                    Cancel
                </button>
            </div>
            
            <div style="margin-top: 15px; font-size: 14px; color: #666;">
                After uploading to MEGA, return here to submit your download link.
            </div>
        </div>
    `;
    
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = html;
    messageDiv.className = 'message success';
    messageDiv.style.display = 'block';
}

// ✅ APRI MEGA WEBSITE
function openMegaWebsite() {
    window.open('https://mega.nz', '_blank');
    
    // Mostra il form per inserire il link Mega
    showLinkSubmissionForm();
}

// ✅ MOSTRA FORM PER INSERIRE LINK MEGA
function showLinkSubmissionForm() {
    const submissionData = JSON.parse(localStorage.getItem('submissionData') || '{}');
    
    const html = `
        <div style="text-align: center;">
            <h3 style="color: #155724; margin-bottom: 15px;">🔗 Submit MEGA Link</h3>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <strong>📤 Upload completed?</strong><br>
                Paste your MEGA download link below:
            </div>
            
            <div style="margin: 20px 0;">
                <input type="url" id="megaLink" placeholder="https://mega.nz/file/..." 
                       style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;"
                       required>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="submitMegaLink()" style="background: #28a745; color: white; border: none; padding: 12px 25px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    ✅ Submit Link
                </button>
                <button onclick="cancelUpload()" style="background: #6c757d; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
            </div>
            
            <div style="margin-top: 15px; font-size: 14px; color: #666;">
                <strong>Submission ID:</strong> ${submissionData.submissionId}<br>
                <strong>File:</strong> ${submissionData.fileName}
            </div>
        </div>
    `;
    
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = html;
    messageDiv.className = 'message success';
    messageDiv.style.display = 'block';
}

// ✅ INVIA LINK MEGA AL SERVER
async function submitMegaLink() {
    const megaLink = document.getElementById('megaLink').value;
    const submissionData = JSON.parse(localStorage.getItem('submissionData') || '{}');
    
    if (!megaLink) {
        showMessage('Please enter your MEGA download link', 'error');
        return;
    }
    
    if (!megaLink.includes('mega.nz')) {
        showMessage('Please enter a valid MEGA link', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        // Invia i dati al server (solo il link Mega)
        const response = await fetch('/api/submit-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...submissionData,
                megaLink: megaLink,
                finalSubmission: true
            })
        });
        
        if (response.ok) {
            showFinalSuccess(submissionData.fileName, submissionData.submissionId, megaLink);
            localStorage.removeItem('submissionData');
            localStorage.removeItem('megaUploadData');
        } else {
            throw new Error('Failed to submit link');
        }
        
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

// ✅ SUCCESSO FINALE
function showFinalSuccess(fileName, submissionId, megaLink) {
    const html = `
        <div style="text-align: center;">
            <h3 style="color: #155724; margin-bottom: 15px;">🎬 Submission Complete!</h3>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <strong>✅ Successfully submitted to MEGA!</strong><br>
                <strong>File:</strong> ${fileName}<br>
                <strong>Submission ID:</strong> ${submissionId}<br>
                <strong>MEGA Link:</strong> Received and stored
            </div>

            <a href="${megaLink}" target="_blank" 
               style="background: #d32f2f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 0;">
               🔗 Open MEGA Link
            </a>
            
            <div style="margin-top: 15px; font-size: 14px; color: #666;">
                Thank you for your submission! Your clip will be reviewed soon.
            </div>
        </div>
    `;
    
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = html;
    messageDiv.className = 'message success';
    messageDiv.style.display = 'block';
    
    // Reset form
    document.getElementById('uploadForm').reset();
    resetForm();
}

// ✅ CANCELLA UPLOAD
function cancelUpload() {
    localStorage.removeItem('submissionData');
    localStorage.removeItem('megaUploadData');
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none';
}

// ✅ SALVA DATI LOCALMENTE (opzionale)
function saveSubmissionLocally(data) {
    const submissions = JSON.parse(localStorage.getItem('clipSubmissions') || '[]');
    submissions.push(data);
    localStorage.setItem('clipSubmissions', JSON.stringify(submissions));
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
        
        showMessage(`File selected: ${file.name} (${displaySize}) - Ready for MEGA upload`, 'success');
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
        btnText.textContent = 'Processing...';
        btnSpinner.style.display = 'block';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = '🎬 Upload to MEGA';
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