const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to database
const dbPath = path.join(__dirname, 'reports.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create reports table
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            address TEXT,
            image_url TEXT,
            status TEXT DEFAULT 'Reported',
            solution TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            } else {
                // Gracefully attempt to add the solution column to old databases
                db.run(`ALTER TABLE reports ADD COLUMN solution TEXT`, (alterErr) => {
                    // Ignore errors like "duplicate column name" if it already exists
                });
            }
        });
    }
});

module.exports = db;
