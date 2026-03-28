const db = require('../db/database');

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

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
};

const createReport = (req, res) => {
    const { title, description, category, latitude, longitude, address } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !category) {
        return res.status(400).json({ error: 'Title and category are required.' });
    }

    const sql = `INSERT INTO reports (title, description, category, latitude, longitude, address, image_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [title, description, category, latitude, longitude, address, image_url];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            message: 'Report created successfully',
            reportId: this.lastID
        });
    });
};

const updateReportStatus = (req, res) => {
    const { id } = req.params;
    const { status, solution } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
    }

    let sql = `UPDATE reports SET status = ?`;
    let params = [status];

    if (solution !== undefined) {
        sql += `, solution = ?`;
        params.push(solution);
    }
    
    sql += ` WHERE id = ?`;
    params.push(id);

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json({ message: 'Status updated successfully' });
    });
};

const getReportStats = (req, res) => {
    const sql = `SELECT status, COUNT(*) as count FROM reports GROUP BY status`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
};

const deleteReport = (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM reports WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
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
