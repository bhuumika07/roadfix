const API_URL = 'http://localhost:3000/api/reports';
const IMAGE_BASE_URL = 'http://localhost:3000'; // Make sure this matches the backend port

document.addEventListener('DOMContentLoaded', () => {
    fetchReports();

    document.getElementById('filterCategory').addEventListener('change', fetchReports);
    document.getElementById('filterStatus').addEventListener('change', fetchReports);
});

async function fetchReports() {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('reportsGrid');
    
    const category = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;

    loader.style.display = 'block';
    grid.innerHTML = '';

    try {
        let url = `${API_URL}?`;
        if (category) url += `category=${encodeURIComponent(category)}&`;
        if (status) url += `status=${encodeURIComponent(status)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            renderReports(data.data);
        } else {
            console.error('Error fetching data:', data.error);
            grid.innerHTML = `<div class="message error"><i class="fas fa-exclamation-triangle"></i> Failed to load reports. Ensure backend is running.</div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        grid.innerHTML = `<div class="message error"><i class="fas fa-wifi"></i> Network error. Ensure backend is running.</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

function renderReports(reports) {
    const grid = document.getElementById('reportsGrid');
    if (!reports || reports.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; background: var(--bg-white); border-radius: var(--radius-lg); border: 1px dashed var(--border);">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-dark);">No reports found</h3>
                <p style="color: var(--text-muted);">Try adjusting your filters or checking back later.</p>
            </div>`;
        return;
    }

    reports.forEach(report => {
        const card = document.createElement('div');
        card.className = 'report-card';
        
        const imageUrl = report.image_url 
            ? `${IMAGE_BASE_URL}${report.image_url}` 
            : 'https://via.placeholder.com/400x200?text=No+Image+Provided';

        const dateStr = new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        let badgeClass = 'badge-warning';
        if (report.status === 'In Progress') badgeClass = 'badge-info';
        if (report.status === 'Resolved') badgeClass = 'badge-success';

        card.innerHTML = `
            <div class="report-img-wrapper">
                <img src="${imageUrl}" alt="Report Image" class="report-img" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Load+Error'">
                <div class="badge-position">
                    <span class="badge ${badgeClass}">${report.status}</span>
                </div>
            </div>
            <div class="report-content">
                <div class="report-title">${escapeHTML(report.title)}</div>
                
                <div class="report-meta">
                    <span class="report-meta-item"><i class="fas fa-map-marker-alt" style="color:var(--secondary)"></i> ${escapeHTML(report.address) || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}</span>
                    <span class="report-meta-item"><i class="far fa-calendar-alt" style="color:var(--secondary)"></i> ${dateStr}</span>
                    <span class="report-meta-item"><i class="fas fa-tag" style="color:var(--secondary)"></i> ${escapeHTML(report.category)}</span>
                </div>
                
                <div class="report-desc">
                    ${escapeHTML(report.description) || '<i>No additional description provided.</i>'}
                </div>
                
                ${report.solution ? `
                <div class="report-solution">
                    <strong><i class="fas fa-check-circle"></i> Resolution Note</strong>
                    ${escapeHTML(report.solution)}
                </div>` : ''}
                
                <div class="report-actions">
                    <div class="status-select-wrapper">
                        <select class="update-status" data-id="${report.id}">
                            <option value="Reported" ${report.status === 'Reported' ? 'selected' : ''}>Reported</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                    </div>
                    <button class="btn-small btn-delete" data-id="${report.id}" title="Delete Report">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add event listeners to status selects
    document.querySelectorAll('.update-status').forEach(select => {
        select.addEventListener('change', async (e) => {
            const reportId = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            
            let solution = undefined;
            if (newStatus === 'Resolved') {
                solution = prompt('Please describe how this issue was resolved (or leave blank):');
                if (solution === null) {
                    // User clicked cancel, revert select
                    fetchReports();
                    return;
                }
            }

            // visually indicate updating
            e.target.disabled = true;
            await updateStatus(reportId, newStatus, solution);
            fetchReports(); // Refresh the list
        });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Find the closest button element in case the icon was clicked
            const targetBtn = e.target.closest('button');
            const reportId = targetBtn.getAttribute('data-id');
            if (confirm('Are you sure you want to permanently delete this report?')) {
                const card = targetBtn.closest('.report-card');
                card.style.opacity = '0.5';
                await deleteReport(reportId);
                fetchReports(); // Refresh the list
            }
        });
    });
}

async function deleteReport(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            console.error('Failed to delete report');
            alert('Failed to delete report. Please try again.');
        }
    } catch (err) {
        console.error(err);
        alert('Network error while deleting report.');
    }
}

async function updateStatus(id, newStatus, solution) {
    try {
        const payload = { status: newStatus };
        if (solution !== undefined) {
            payload.solution = solution;
        }

        const response = await fetch(`${API_URL}/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.error('Failed to update status');
            alert('Failed to update status. Please try again.');
        }
    } catch (err) {
        console.error(err);
        alert('Network error while updating status.');
    }
}

// Basic HTML escaper to prevent XSS
function escapeHTML(str) {
    if (!str) return str;
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}
