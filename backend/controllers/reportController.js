const db = require('../db/database');
const { appendAuditLog } = require('../db/auditDatabase');

const getActor = (req) => ({
    id: req.headers['x-user-id'] || 'unknown',
    name: req.headers['x-user-name'] || 'Unknown User',
    role: req.headers['x-user-role'] || 'unknown'
});

const getReports = (req, res) => {
    const { category, status } = req.query;
    let query = 'SELECT * FROM reports';
    const params = [];

    if (category || status) {
        query += ' WHERE ';
        const conditions = [];
        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        query += conditions.join(' AND ');
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
};

const createReport = (req, res) => {
    console.log('--- Creating Report ---');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Request body is empty or not parsed correctly. Ensure you are sending multipart/form-data.' });
    }

    const { title, description, category, latitude, longitude, address } = req.body;
    let { image_url } = req.body;

    if (!title || !category) {
        return res.status(400).json({ error: 'Title and category are required.' });
    }

    // Handle Multer file upload
    if (req.file) {
        // Since frontend is served at root and uploads is served at /uploads, 
        // we store the path that can be used directly as an <img> src.
        image_url = `/uploads/${req.file.filename}`;
    }

    const sql = `INSERT INTO reports (title, description, category, latitude, longitude, address, image_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    // Ensure latitude and longitude are numbers
    const params = [title, description, category, parseFloat(latitude), parseFloat(longitude), address, image_url];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('DB Error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        const reportId = this.lastID.toString();
        
        appendAuditLog({
            action: 'report.created',
            actor: getActor(req),
            reportId: reportId,
            details: `Report #${reportId} titled '${title}' submitted in category ${category}`
        });

        res.status(201).json({
            message: 'Report created successfully',
            reportId: this.lastID
        });
    });
};

const updateReportStatus = (req, res) => {
    const { id } = req.params;
    const { status, solution } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required.' });

    // Fetch existing report to log "Status changed from X to Y" if we want, but simple db.run mock
    // only returns changes: 1. Let's just retrieve the current status via subquery or just log the new status.
    // The prompt says: "Status changed from X to Y for report #ID".
    db.all('SELECT * FROM reports', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const existing = rows.find(r => r.id == id);
        if (!existing) return res.status(404).json({ error: 'Report not found' });
        
        const oldStatus = existing.status;

        let sql = `UPDATE reports SET status = ?`;
    let params = [status];

    if (solution !== undefined) {
        sql += `, solution = ?`;
        params.push(solution);
    }
    
    sql += ` WHERE id = ?`;
    params.push(id);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Report not found' });
        
        appendAuditLog({
            action: 'report.status_changed',
            actor: getActor(req),
            reportId: id.toString(),
            details: `Status changed from ${oldStatus} to ${status} for report #${id}`
        });

        res.json({ message: 'Status updated successfully' });
    });
    }); // close db.all
};

const getReportStats = (req, res) => {
    db.all('SELECT * FROM reports', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const statsObj = rows.reduce((acc, report) => {
            acc[report.status] = (acc[report.status] || 0) + 1;
            return acc;
        }, {});
        
        const stats = Object.keys(statsObj).map(status => ({ status, count: statsObj[status] }));
        res.json({ data: stats });
    });
};

const deleteReport = (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM reports WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Report not found' });
        
        appendAuditLog({
            action: 'report.deleted',
            actor: getActor(req),
            reportId: id.toString(),
            details: `Report #${id} permanently deleted`
        });

        res.json({ message: 'Report deleted successfully' });
    });
};

module.exports = {
    getReports,
    createReport,
    updateReportStatus,
    getReportStats,
    deleteReport
};
