const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const { pool, initDb } = require('./db');
const { 
    hashPassword, comparePassword, generateJwt, 
    apiAuthMiddleware, authenticateWs 
} = require('./auth');

const parties = new Map();

const app = express();

// Initialize Database
initDb().catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Port Configuration
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = 3001;

// 1. Standard HTTP Server (For Host/Rust compatibility)
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(HTTP_PORT, () => {
    console.log(`🚀 HTTP Relay (Host Port) running on port ${HTTP_PORT}`);
});

// 2. Secure HTTPS Server (Using Native Windows PFX Bundle)
const pfxPath = path.join(__dirname, 'certificate.pfx');
let wssSecure;

if (fs.existsSync(pfxPath)) {
    try {
        const options = {
            pfx: fs.readFileSync(pfxPath),
            passphrase: process.env.PFX_PASSPHRASE // Password set during native generation
        };
        const httpsServer = https.createServer(options, app);
        wssSecure = new WebSocketServer({ server: httpsServer });
        
        wssSecure.on('connection', (ws, req) => wss.emit('connection', ws, req));

        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`🔒 HTTPS Relay (Mobile Port) running on port ${HTTPS_PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to start HTTPS:', err.message);
    }
} else {
    console.log('⚠️ certificate.pfx not found. Mobile WakeLock may fail.');
}

// --- Public Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username/password' });
    
    try {
        const hashedPassword = await hashPassword(password);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        res.status(201).json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !(await comparePassword(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = generateJwt(user);
        res.json({ token, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Apply auth middleware to all routes below this line
app.use('/api', apiAuthMiddleware(parties));



// REST Endpoints for Desktop Host to Initialize
app.post('/api/host/create', (req, res) => {
    // Only users with a valid JWT (req.user) can create parties
    if (!req.user) {
        return res.status(403).json({ error: "Only registered hosts can create parties" });
    }

    const partyName = (req.body.partyName || 'Party').substring(0, 32).trim();
    const existingPartyId = req.body.partyId;
    const existingToken = req.body.token;

    // --- Reconnect flow: reclaim an existing party ---
    if (existingPartyId && existingToken) {
        const existing = parties.get(existingPartyId);
        if (existing && existing.token === existingToken) {
            // Close stale host socket if still lingering
            if (existing.hostWs && existing.hostWs.readyState === 1) {
                existing.hostWs.close();
            }
            existing.hostWs = null;
            console.log(`[Relay] Party reclaimed: "${existing.partyName}" (${existingPartyId}) by ${req.user.username}`);
            return res.json({
                partyId: existingPartyId,
                partyName: existing.partyName || partyName,
                token: existingToken
            });
        }
    }

    // --- New party: hash partyName + GUID into a secure partyId ---
    const guid = crypto.randomUUID();
    const raw = `${partyName}-${guid}`;
    const partyId = crypto.createHash('sha256').update(raw).digest('hex').substring(0, 12).toUpperCase();
    const token = crypto.randomBytes(32).toString('hex');

    parties.set(partyId, {
        hostWs: null,
        hostUser: req.user.username,
        token: token,
        partyName: partyName,
        clients: new Set(),
        deviceClients: new Map(),
        reqIdCounter: 0,
        pendingRequests: new Map(),
        currentMetadata: null
    });

    console.log(`[Relay] Party created by ${req.user.username}: "${partyName}" -> ${partyId}`);
    res.json({ partyId, partyName, token });
});

app.get('/api/host/parties', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authenticated host session required" });
    }
    
    const userParties = [];
    for (const [id, party] of parties.entries()) {
        if (party.hostUser === req.user.username) {
            userParties.push({
                partyId: id,
                partyName: party.partyName,
                token: party.token,
                status: (party.hostWs && party.hostWs.readyState === 1) ? 'online' : 'offline'
            });
        }
    }
    res.json(userParties);
});

app.post('/api/party/metadata', (req, res) => {
    const { partyId, token, metadata } = req.body;
    const partyIdUpper = partyId?.toUpperCase();
    const party = parties.get(partyIdUpper);
    if (!party || party.token !== token) {
        return res.status(401).json({ error: "Unauthorized or invalid party" });
    }
    party.currentMetadata = metadata;
    console.log(`Metadata updated for party ${partyIdUpper}`);
    res.json({ success: true });
});

app.get('/api/party/metadata', (req, res) => {
    const partyId = req.query.party_id?.toUpperCase();
    const party = parties.get(partyId);
    if (!party) return res.status(404).json({ error: "Party not found" });
    // Token/Auth check is handled by apiAuthMiddleware (Path 2: Party token)
    res.json(party.currentMetadata || {});
});

// Periodic Cleanup for parties with no host for too long
setInterval(() => {
    const now = Date.now();
    for (const [partyId, party] of parties.entries()) {
        const hasActiveHost = party.hostWs && party.hostWs.readyState === 1;
        if (!hasActiveHost) {
            // If no host for more than 5 minutes, cleanup the whole party
            if (!party.disconnectTime) {
                party.disconnectTime = now;
            } else if (now - party.disconnectTime > 300000) {
                console.log(`[Relay] Cleaning up stale party: ${partyId}`);
                for (let client of party.clients) {
                    client.send(JSON.stringify({ type: 'error', message: 'Party session expired' }));
                    client.close();
                }
                parties.delete(partyId);
            }
        } else {
            party.disconnectTime = null;
        }
    }
}, 60000);

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const authResult = authenticateWs(url, parties);
    
    if (!authResult.ok) {
        ws.send(JSON.stringify({ error: "Authentication failed" }));
        return ws.close();
    }

    const { user, partyAuth, partyId, partyToken } = authResult;
    const role = url.searchParams.get('role'); // 'host' or 'client'
    const token = partyToken;

    if (!partyId || !parties.has(partyId)) {
        ws.send(JSON.stringify({ error: "Party not found" }));
        return ws.close();
    }
    
    const party = parties.get(partyId);
    
    // HOST connection requirements
    if (role === 'host') {
        if (!user) {
            ws.send(JSON.stringify({ error: "Host connection requires a valid account login." }));
            return ws.close();
        }
        
        // Re-claiming: close any stale host socket
        if (party.hostWs && party.hostWs.readyState === 1) {
            console.log(`[Relay] Host re-claiming session: ${partyId} by ${user.username}`);
            party.hostWs.close();
        }

        party.hostWs = ws;
        console.log(`[Relay] Host connected to party ${partyId} (User: ${user.username})`);
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`[Relay] Received ${data.type} from Host. Broadcasting to ${party.clients.size} clients.`);
                
                // If it's a response to an API request (search/suggestions)
                if (data.replyTo && party.pendingRequests.has(data.replyTo)) {
                    const res = party.pendingRequests.get(data.replyTo);
                    res.json(data.payload);
                    party.pendingRequests.delete(data.replyTo);
                    return;
                }
                
                // Cache the latest state for new joiners
                if (data.type === 'sync_state') {
                    party.lastState = data.payload;
                }

                // Otherwise broadcast state to clients
                const msgString = JSON.stringify(data);
                for (let clientWs of party.clients) {
                    if (clientWs.readyState === 1) clientWs.send(msgString);
                }
                
                // If it's a specific notification for a singer
                if (data.type === 'notify_singer') {
                    const targetDeviceId = data.deviceId;
                    const sockets = party.deviceClients.get(targetDeviceId);
                    if (sockets) {
                        for (let s of sockets) {
                            if (s.readyState === 1) {
                                s.send(JSON.stringify({
                                    type: 'singer_alert',
                                    message: 'Get ready! Your song is starting!',
                                    song: data.payload
                                }));
                            }
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error("Error parsing/handling host message:", err);
            }
        });
        
        ws.on('close', () => {
            console.log(`Host disconnected from party ${partyId}`);
            party.hostWs = null;
            party.disconnectTime = Date.now();
            // Don't delete the party or disconnect clients — let the 5-min cleanup interval handle it.
            // The host can reconnect and reclaim the party, and clients keep their cached state.
        });
    } 
    // CLIENT connection
    else if (role === 'client') {
        const deviceId = url.searchParams.get('device_id');
        
        // Token is MANDATORY for client connections
        if (!token || party.token !== token) {
            ws.send(JSON.stringify({ error: "Invalid or missing access token" }));
            return ws.close();
        }
        
        party.clients.add(ws);
        if (deviceId) {
            if (!party.deviceClients.has(deviceId)) {
                party.deviceClients.set(deviceId, new Set());
            }
            party.deviceClients.get(deviceId).add(ws);
        }

        console.log(`Client connected to party ${partyId} (Device: ${deviceId})`);
        
        // 1. Immediately send the LATEST known state to this new client if we have it
        if (party.lastState) {
            ws.send(JSON.stringify({ type: 'sync_state', payload: party.lastState }));
        }

        // 2. Request a fresh sync from Host anyway
        if (party.hostWs && party.hostWs.readyState === 1) {
            party.hostWs.send(JSON.stringify({ type: 'client_joined' }));
        }
        
        const ALLOWED_CLIENT_TYPES = new Set(['queue_add', 'queue_remove', 'search', 'suggestions', 'process_yt', 'recommendations', 'lyrics', 'sync_state']);
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (!data.type || !ALLOWED_CLIENT_TYPES.has(data.type)) {
                    console.warn(`[Relay] Blocked unknown client message type: ${data.type}`);
                    return;
                }
                if (party.hostWs && party.hostWs.readyState === 1) {
                    party.hostWs.send(message.toString());
                }
            } catch (e) {
                console.warn('[Relay] Blocked malformed client message');
            }
        });
        
        ws.on('close', () => {
            party.clients.delete(ws);
            if (deviceId && party.deviceClients.has(deviceId)) {
                party.deviceClients.get(deviceId).delete(ws);
                if (party.deviceClients.get(deviceId).size === 0) {
                    party.deviceClients.delete(deviceId);
                }
            }
        });
    }
});

// Primary Heartbeat interval
const interval = setInterval(() => {
    [wss, wssSecure].forEach(currentWss => {
        if (!currentWss) return;
        currentWss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

// REST proxy endpoints for clients
app.get('/api/search', (req, res) => {
    proxyRestToHost(req, res, 'search');
});

app.get('/api/suggestions', (req, res) => {
    proxyRestToHost(req, res, 'suggestions');
});

app.get('/api/recommendations', (req, res) => {
    proxyRestToHost(req, res, 'recommendations');
});

app.get('/api/lyrics', (req, res) => {
    // This allows a direct fetch of lyrics if metadata cache is empty or stale
    proxyRestToHost(req, res, 'lyrics');
});

function proxyRestToHost(req, res, actionType) {
    const partyId = req.query.party_id?.toUpperCase();
    const token = req.query.token;
    
    if (!partyId || !parties.has(partyId)) {
        return res.status(404).json({ error: "Party not found" });
    }
    
    const party = parties.get(partyId);
    if (!party.hostWs || party.hostWs.readyState !== 1) {
        return res.status(503).json({ error: "Host disconnected" });
    }
    
    // Security check
    if (party.token !== token) {
        return res.status(401).json({ error: "Unauthorized - Invalid Token" });
    }
    
    // Generate reqId
    party.reqIdCounter++;
    const reqId = `req_${party.reqIdCounter}`;
    
    // Save response handler
    party.pendingRequests.set(reqId, res);
    
    // Send to host
    party.hostWs.send(JSON.stringify({
        type: actionType,
        id: reqId,
        query: req.query.query || req.query.video_id || ''
    }));
    
    // Cleanup if host doesn't reply in 30s
    setTimeout(() => {
        if (party.pendingRequests.has(reqId)) {
            party.pendingRequests.delete(reqId);
            res.status(504).json({ error: "Host timeout" });
        }
    }, 30000);
}

// Return React build path
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dual-server listening is handled at the top of the file

