const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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

if (fs.existsSync(pfxPath)) {
    try {
        const options = {
            pfx: fs.readFileSync(pfxPath),
            passphrase: process.env.PFX_PASSPHRASE // Password set during native generation
        };
        const httpsServer = https.createServer(options, app);
        const wssSecure = new WebSocketServer({ server: httpsServer });
        
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

// Global WebSocket logic (already handled by mirroring above if HTTPS is on)

// Mappings
// partyId -> { hostWs: WebSocket, token: string, clients: Set<WebSocket> }
const parties = new Map();

// Generate Random ID
function generatePartyId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// REST Endpoints for Desktop Host to Initialize
app.post('/api/host/create', (req, res) => {
    let partyId = req.body.partyId || generatePartyId();
    // basic sanity limit
    partyId = partyId.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
    
    const token = generateToken();
    
    // Reserve the party
    parties.set(partyId, {
        hostWs: null,
        token: token,
        clients: new Set(),
        reqIdCounter: 0,
        pendingRequests: new Map(), // reqId -> Express Res object
        currentMetadata: null
    });
    
    res.json({ partyId, token, wssUrl: `ws://${req.get('host')}` });
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
    res.json(party.currentMetadata || {});
});

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const partyId = url.searchParams.get('party_id')?.toUpperCase();
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role'); // 'host' or 'client'
    
    if (!partyId) {
        ws.send(JSON.stringify({ error: "Missing Party ID" }));
        return ws.close();
    }

    // Auto-create party if connector is Host and it doesn't exist
    if (role === 'host' && !parties.has(partyId)) {
        console.log(`Creating new party session: ${partyId}`);
        parties.set(partyId, {
            hostWs: null,
            token: token, // The first host to connect sets the token
            clients: new Set(),
            deviceClients: new Map(), // deviceId -> Set of WebSockets
            reqIdCounter: 0,
            pendingRequests: new Map(),
            currentMetadata: null
        });
    }

    if (!parties.has(partyId)) {
        ws.send(JSON.stringify({ error: "Party not found" }));
        return ws.close();
    }
    
    const party = parties.get(partyId);
    
    // HOST connection
    if (role === 'host') {
        if (party.token !== token) {
            ws.send(JSON.stringify({ error: "Invalid Host Token" }));
            return ws.close();
        }
        
        party.hostWs = ws;
        console.log(`Host connected to party ${partyId}`);
        
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
            parties.delete(partyId);
            for (let clientWs of party.clients) {
                clientWs.send(JSON.stringify({ type: 'error', message: 'Host disconnected' }));
                clientWs.close();
            }
        });
    } 
    // CLIENT connection
    else if (role === 'client') {
        const deviceId = url.searchParams.get('device_id');
        
        if (token && party.token !== token) {
            ws.send(JSON.stringify({ error: "Invalid Access Token" }));
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
        
        ws.on('message', (message) => {
            // Forward client actions directly to host
            if (party.hostWs && party.hostWs.readyState === 1) {
                party.hostWs.send(message.toString());
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

