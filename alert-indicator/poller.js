/**
 * API Poller
 * Polls the alerts server for status updates (HTTP, like the PS script)
 */

const http = require('http');

const API_BASE = 'http://localhost:3002';

/**
 * Fetch alert status for a specific location UID
 * Returns: { location, alert, uid, alertTypes, countrywide, timestamp }
 */
function fetchStatus(locationUid) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}/api/status/${encodeURIComponent(locationUid)}`;

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Fetch all available locations from the server
 * Returns: [{ uid, name, short, type }, ...]
 */
function fetchLocations() {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}/api/locations`;

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Send a test alert/end to the bot
 * @param {string} locationUid 
 * @param {string} type - 'alert' or 'end'
 */
function sendTestAlert(locationUid, type) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ locationUid, type });

        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/test/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(postData);
        req.end();
    });
}

module.exports = { fetchStatus, fetchLocations, sendTestAlert, API_BASE };
