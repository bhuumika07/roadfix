// Constants
const API_URL = 'http://localhost:3000/api/reports';

// Map Initialization
let map;
let marker;

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize map if coordinates exist on page (index.html)
    const mapElement = document.getElementById('map');
    if (mapElement) {
        initMap();
    }

    // Form submission
    const form = document.getElementById('reportForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Custom File Upload Preview
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('imagePreview');
    const uploadContent = document.getElementById('uploadContent');

    if (imageInput && imagePreview && uploadContent) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    uploadContent.style.display = 'none';
                }
                reader.readAsDataURL(file);
            } else {
                imagePreview.src = '';
                imagePreview.style.display = 'none';
                uploadContent.style.display = 'flex';
            }
        });

        // Optional: Drag and drop styling
        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, highlight, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, unhighlight, false);
            });

            function highlight(e) {
                dropzone.style.borderColor = 'var(--primary)';
                dropzone.style.background = 'rgba(79, 70, 229, 0.05)';
            }

            function unhighlight(e) {
                dropzone.style.borderColor = 'var(--border)';
                dropzone.style.background = '#f8fafc';
            }

            dropzone.addEventListener('drop', handleDrop, false);

            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                imageInput.files = files;
                imageInput.dispatchEvent(new Event('change'));
            }
        }
    }
});

function initMap() {
    let defaultCoords = [40.7128, -74.0060]; // NY

    map = L.map('map').setView(defaultCoords, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    marker = L.marker(defaultCoords, { draggable: true }).addTo(map);
    updateInputs(defaultCoords[0], defaultCoords[1]);

    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        marker.setLatLng([lat, lng]);
        updateInputs(lat, lng);
    });

    marker.on('dragend', function(e) {
        const position = marker.getLatLng();
        updateInputs(position.lat, position.lng);
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = [position.coords.latitude, position.coords.longitude];
                map.setView(pos, 15);
                marker.setLatLng(pos);
                updateInputs(pos[0], pos[1]);
            },
            () => {
                console.log("Geolocation failed or denied. Using default coords.");
            }
        );
    }
}

function updateInputs(lat, lng) {
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lng;
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const msgBox = document.getElementById('formMessage');
    
    // Disable btn and show spinner
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    msgBox.className = 'message hidden';

    try {
        const formData = new FormData(form);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            msgBox.innerHTML = '<i class="fas fa-check-circle"></i> Report submitted successfully! Thank you for your contribution.';
            msgBox.className = 'message success';
            form.reset();
            
            // Reset image preview
            const imagePreview = document.getElementById('imagePreview');
            const uploadContent = document.getElementById('uploadContent');
            if (imagePreview && uploadContent) {
                imagePreview.src = '';
                imagePreview.style.display = 'none';
                uploadContent.style.display = 'flex';
            }

            // Reset marker
            if (marker && map) {
                const center = map.getCenter();
                marker.setLatLng(center);
                updateInputs(center.lat, center.lng);
            }
        } else {
            throw new Error(data.error || 'Failed to submit report');
        }
    } catch (err) {
        console.error(err);
        msgBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'An error occurred. Please try again.'}`;
        msgBox.className = 'message error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
    }
}
