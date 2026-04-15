const express = require('express');
const fs = require('fs');
const path = require('path');
const { appendAuditLog } = require('../db/auditDatabase');
const router = express.Router();

const usersPath = path.join(__dirname, '..', 'db', 'users.json');

/**
 * Read all users from users.json
 */
function getUsers() {
    try {
        const data = fs.readFileSync(usersPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users.json:', err.message);
        return [];
    }
}

/**
 * Sanitize a string to prevent basic injection
 */
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { success: true/false, user: { id, name, role } | null, error: "msg" }
 */
router.post('/login', (req, res) => {
    try {
        const email = sanitize(req.body.email || '');
        const password = (req.body.password || '').trim();

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'Email and password are required.'
            });
        }

        const users = getUsers();
        const user = users.find(
            u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                data: null,
                error: 'Invalid email or password.'
            });
        }

        // Never send the password back
        const resultUser = {
            id: user.id,
            name: user.name,
            role: user.role
        };

        appendAuditLog({
            action: 'user.login',
            actor: resultUser,
            details: `User ${user.name} logged into the system`
        });

        return res.json({
            success: true,
            data: {
                user: resultUser
            },
            error: null
        });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({
            success: false,
            data: null,
            error: 'An unexpected error occurred. Please try again.'
        });
    }
});

/**
 * POST /api/auth/logout
 * Uses headers (x-user-id, x-user-name, x-user-role) for the actor
 */
router.post('/logout', (req, res) => {
    const actor = {
        id: req.headers['x-user-id'] || 'unknown',
        name: req.headers['x-user-name'] || 'Unknown',
        role: req.headers['x-user-role'] || 'unknown'
    };

    appendAuditLog({
        action: 'user.logout',
        actor: actor,
        details: `User ${actor.name} logged out`
    });

    return res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
