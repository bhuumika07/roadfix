const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- PERSISTENCE LOGIC -----
const dbPath = path.join(__dirname, 'reports.txt');

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]), 'utf-8');
}

const readData = () => {
    try {
        const data = fs.readFileSync(dbPath, 'utf-8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error('Error reading from reports.txt:', err.message);
        return [];
    }
};

const writeData = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error writing to reports.txt:', err.message);
    }
};

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ----- API -----
app.get('/api/reports', (req, res) => {
    const { category, status } = req.query;
    let records = readData();
    if (category) records = records.filter(r => r.category === category);
    if (status) records = records.filter(r => r.status === status);
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ data: records });
});

app.post('/api/reports', (req, res) => {
    const { title, description, category, latitude, longitude, address, image_url } = req.body;
    if (!title || !category) return res.status(400).json({ error: 'Missing title/category' });

    const records = readData();
    const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const newReport = {
        id: newId,
        title,
        description: description || null,
        category,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || null,
        image_url: image_url || null,
        status: 'Reported',
        solution: null,
        created_at: new Date().toISOString()
    };
    records.push(newReport);
    writeData(records);
    res.status(201).json({ message: 'Success', reportId: newId });
});

app.patch('/api/reports/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, solution } = req.body;
    const records = readData();
    const index = records.findIndex(r => r.id == id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    records[index].status = status;
    if (solution !== undefined) records[index].solution = solution;
    writeData(records);
    res.json({ message: 'Updated' });
});

app.get('/api/reports/stats', (req, res) => {
    const records = readData();
    const statsObj = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});
    const rows = Object.keys(statsObj).map(s => ({ status: s, count: statsObj[s] }));
    res.json({ data: rows });
});

app.delete('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    let records = readData();
    const initial = records.length;
    records = records.filter(r => r.id != id);
    if (records.length === initial) return res.status(404).json({ error: 'Not found' });
    writeData(records);
    res.json({ message: 'Deleted' });
});

// START
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
