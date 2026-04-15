const API_URL = '/api/reports';

// ---- RBAC: Read role from localStorage ----
function getUserRole() {
    return (localStorage.getItem('userRole') || '').toLowerCase();
}

function getUserName() {
    return localStorage.getItem('userName') || 'User';
}

function getUserId() {
    return localStorage.getItem('userId') || 'unknown';
}

// ---- Auth guard: redirect to login if not logged in ----
function requireAuth() {
    const role = getUserRole();
    if (!role) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    setupRoleUI();
    fetchReports();
    fetchStats();

    document.getElementById('filterCategory').addEventListener('change', fetchReports);
    document.getElementById('filterStatus').addEventListener('change', fetchReports);
});

/**
 * Setup UI elements based on user role:
 * - Show role badge in header
 * - Show/hide controls per role
 * - Show "Assigned to me" filter for inspector
 */
function setupRoleUI() {
    const role = getUserRole();
    const name = getUserName();

    // Inject role badge + user name into the dashboard header
    const headerDiv = document.querySelector('.dashboard-header > div');
    if (headerDiv) {
        const badgeHTML = `
            <div class="user-role-display">
                <span class="role-badge role-${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
                <span class="user-name-label">Logged in as <strong>${escapeHTML(name)}</strong></span>
            </div>
        `;
        headerDiv.insertAdjacentHTML('beforeend', badgeHTML);
    }

    // Inspector: show "Assigned to me" filter
    if (role === 'inspector') {
        const filtersContainer = document.querySelector('.filters-container');
        if (filtersContainer) {
            const assignedFilter = document.createElement('div');
            assignedFilter.className = 'filter-group';
            assignedFilter.innerHTML = `
                <label for="filterAssigned"><i class="fas fa-user-check"></i> View:</label>
                <select id="filterAssigned">
                    <option value="all">All Reports</option>
                    <option value="mine">Assigned to Me</option>
                </select>
            `;
            filtersContainer.appendChild(assignedFilter);
            document.getElementById('filterAssigned').addEventListener('change', fetchReports);
        }
    }

    // Admin: show export & analytics links in header
    if (role === 'admin') {
        const headerParent = document.querySelector('.dashboard-header');
        if (headerParent) {
            const adminActions = document.createElement('div');
            adminActions.className = 'admin-header-actions';
            adminActions.innerHTML = `
                <button class="btn-admin-action" id="exportBtn" title="Export Reports">
                    <i class="fas fa-file-export"></i> Export
                </button>
                <a href="#analytics" class="btn-admin-action" id="analyticsLink" title="Analytics">
                    <i class="fas fa-chart-bar"></i> Analytics
                </a>
            `;
            headerParent.appendChild(adminActions);

            // Export handler
            document.getElementById('exportBtn').addEventListener('click', exportReports);
        }
    }

    // Non-admin: hide export and analytics (they won't be rendered)
    // Citizen: also hide status update dropdown (handled in renderReports)
}

/**
 * Export reports as JSON download (admin only)
 */
async function exportReports() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (!response.ok) {
            showToast('Failed to export reports.', 'error');
            return;
        }
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadfix-reports-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Reports exported successfully.', 'success');
    } catch (err) {
        showToast('Network error while exporting.', 'error');
    }
}

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
    const role = getUserRole();

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
        
        // Use Image URL or inline SVG placeholder (no external dependency)
        const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2394a3b8'%3ENo Image Provided%3C/text%3E%3C/svg%3E`;
        const imageUrl = report.image_url || PLACEHOLDER;

        const dateStr = new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        let badgeClass = 'badge-warning';
        if (report.status === 'In Progress') badgeClass = 'badge-info';
        if (report.status === 'Resolved') badgeClass = 'badge-success';

        // Build action buttons based on role
        let statusSelectHTML = '';
        let deleteButtonHTML = '';

        // Status update: admin and inspector only
        if (role === 'admin' || role === 'inspector') {
            statusSelectHTML = `
                <div class="status-select-wrapper">
                    <select class="update-status" data-id="${report.id}">
                        <option value="Reported" ${report.status === 'Reported' ? 'selected' : ''}>Reported</option>
                        <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </div>
            `;
        } else {
            // Citizen sees read-only status
            statusSelectHTML = `
                <div class="status-read-only">
                    <span class="badge ${badgeClass}">${report.status}</span>
                </div>
            `;
        }

        // Delete: admin only
        if (role === 'admin') {
            deleteButtonHTML = `
                <button class="btn-small btn-delete" data-id="${report.id}" title="Delete Report">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            `;
        }

        card.innerHTML = `
            <div class="report-img-wrapper">
                <img src="${imageUrl}" alt="Report Image" class="report-img" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\'%3E%3Crect width=\\'400\\' height=\\'200\\' fill=\\'%23fef2f2\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'13\\' fill=\\'%23f87171\\'%3EImage failed to load%3C/text%3E%3C/svg%3E'">
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
                    ${statusSelectHTML}
                    ${deleteButtonHTML}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add event listeners to status selects (admin + inspector only)
    document.querySelectorAll('.update-status').forEach(select => {
        select.addEventListener('change', async (e) => {
            const reportId = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            
            let solution = undefined;
            if (newStatus === 'Resolved') {
                solution = prompt('Please describe how this issue was resolved (or leave blank):');
                if (solution === null) {
                    fetchReports();
                    return;
                }
            }

            e.target.disabled = true;
            await updateStatus(reportId, newStatus, solution);
            fetchReports();
        });
    });

    // Add event listeners to delete buttons (admin only)
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetBtn = e.target.closest('button');
            const reportId = targetBtn.getAttribute('data-id');
            if (confirm('Are you sure you want to permanently delete this report?')) {
                const card = targetBtn.closest('.report-card');
                card.style.opacity = '0.5';
                await deleteReport(reportId);
                fetchReports();
                fetchStats();
            }
        });
    });
}

async function deleteReport(id) {
    const role = getUserRole();
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-role': role,
                'x-user-id': getUserId(),
                'x-user-name': getUserName()
            }
        });
        if (!response.ok) {
            const data = await response.json();
            showToast(data.error || 'Failed to delete report. Please try again.', 'error');
        } else {
            showToast('Report permanently deleted.', 'info');
        }
    } catch (err) {
        showToast('Network error while deleting report.', 'error');
    }
}

async function updateStatus(id, newStatus, solution) {
    const role = getUserRole();
    try {
        const payload = { status: newStatus };
        if (solution !== undefined) {
            payload.solution = solution;
        }

        const response = await fetch(`${API_URL}/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': role,
                'x-user-id': getUserId(),
                'x-user-name': getUserName()
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const data = await response.json();
            showToast(data.error || 'Failed to update status. Please try again.', 'error');
        } else {
            showToast('Status updated successfully.', 'success');
            fetchStats();
        }
    } catch (err) {
        showToast('Network error while updating status.', 'error');
    }
}

// Basic HTML escaper
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

// Toast Utility
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Fetch Stats
async function fetchStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        const statsContainer = document.getElementById('statsContainer');
        if (!statsContainer) return;
        
        let total = 0, reported = 0, progress = 0, resolved = 0;
        
        if (response.ok && data.data) {
            data.data.forEach(stat => {
                total += stat.count;
                if (stat.status === 'Reported') reported = stat.count;
                if (stat.status === 'In Progress') progress = stat.count;
                if (stat.status === 'Resolved') resolved = stat.count;
            });
        }
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon total"><i class="fas fa-list-alt"></i></div>
                <div class="stat-details">
                    <h3>${total}</h3>
                    <p>Total Issues</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon reported"><i class="fas fa-bullhorn"></i></div>
                <div class="stat-details">
                    <h3>${reported}</h3>
                    <p>Newly Reported</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon progress"><i class="fas fa-tools"></i></div>
                <div class="stat-details">
                    <h3>${progress}</h3>
                    <p>In Progress</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon resolved"><i class="fas fa-check"></i></div>
                <div class="stat-details">
                    <h3>${resolved}</h3>
                    <p>Resolved</p>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Stats error:', e);
    }
}
