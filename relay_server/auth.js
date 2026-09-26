const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_SECRET';
const JWT_EXPIRY = '24h';

function generateJwt(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

function verifyJwt(token) {
    return jwt.verify(token, JWT_SECRET);
}

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Express middleware for /api/* routes.
 * Accepts EITHER:
 *   1. JWT via Authorization: Bearer <token> header  (host/desktop)
 *   2. Valid party token via query string             (mobile clients)
 */
function apiAuthMiddleware(parties) {
    return (req, res, next) => {
        // --- Path 1: JWT Bearer token ---
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                req.user = verifyJwt(authHeader.substring(7));
                return next();
            } catch (_) { /* invalid JWT, try party token */ }
        }

        // --- Path 2: Party token (query string) ---
        const partyId = (req.query.party_id || req.body?.partyId || '').toUpperCase();
        const partyToken = req.query.token || req.body?.token;

        if (partyId && partyToken) {
            if (parties.has(partyId)) {
                if (parties.get(partyId).token === partyToken) {
                    req.partyAuth = { partyId };
                    return next();
                }
                console.log(`[Auth] Token mismatch for party ${partyId}. Expected: ${parties.get(partyId).token.substring(0, 8)}... Got: ${partyToken.substring(0, 8)}...`);
            } else {
                console.log(`[Auth] Party not found: ${partyId}. Active parties: [${[...parties.keys()].join(', ')}]`);
            }
        } else {
            console.log(`[Auth] Missing party credentials. partyId=${partyId || '(empty)'} token=${partyToken ? 'provided' : '(empty)'}`);
        }

        return res.status(401).json({ error: 'Authentication required' });
    };
}

/**
 * WebSocket connection authenticator.
 * Returns { ok, user?, partyAuth? } or { ok: false }.
 */
function authenticateWs(url, parties) {
    const partyId = url.searchParams.get('party_id')?.toUpperCase();
    const partyToken = url.searchParams.get('token');
    const jwtToken = url.searchParams.get('jwt');

    // Try JWT first (host connections)
    if (jwtToken) {
        try {
            const user = verifyJwt(jwtToken);
            return { ok: true, user, partyId, partyToken };
        } catch (_) { /* invalid */ }
    }

    // Try party token (mobile client connections)
    if (partyId && partyToken) {
        if (parties.has(partyId)) {
            if (parties.get(partyId).token === partyToken) {
                return { ok: true, partyAuth: { partyId }, partyId, partyToken };
            }
            console.log(`[WS Auth] Token mismatch for party ${partyId}. Expected: ${parties.get(partyId).token.substring(0, 8)}... Got: ${partyToken.substring(0, 8)}...`);
        } else {
            console.log(`[WS Auth] Party not found: ${partyId}. Active parties: [${[...parties.keys()].join(', ')}]`);
        }
    } else {
        console.log(`[WS Auth] Missing credentials. partyId=${partyId || '(empty)'} token=${partyToken ? 'provided' : '(empty)'}`);
    }

    return { ok: false };
}

module.exports = {
    generateJwt,
    verifyJwt,
    hashPassword,
    comparePassword,
    apiAuthMiddleware,
    authenticateWs
};
