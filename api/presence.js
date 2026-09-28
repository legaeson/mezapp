// LezgiMez - Real Online Presence Tracker for Vercel Serverless
const presenceMap = new Map();
const TTL_MS = 25000;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const now = Date.now();

    // Clean up stale entries
    for (const [id, info] of presenceMap.entries()) {
        if (now - info.time > TTL_MS) {
            presenceMap.delete(id);
        }
    }

    let clientId = null;
    let searching = false;
    let bye = false;

    if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }
        body = body || {};
        clientId = body.id;
        searching = Boolean(body.searching);
        bye = Boolean(body.bye);
    } else {
        clientId = req.query.id;
        searching = req.query.searching === '1' || req.query.searching === 'true';
        bye = req.query.bye === '1' || req.query.bye === 'true';
    }

    if (clientId && typeof clientId === 'string') {
        const cleanId = clientId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        if (bye) {
            presenceMap.delete(cleanId);
        } else if (cleanId) {
            presenceMap.set(cleanId, { time: now, searching });
        }
    }

    let searchingCount = 0;
    for (const info of presenceMap.values()) {
        if (info.searching) searchingCount++;
    }

    const onlineCount = Math.max(1, presenceMap.size);

    return res.status(200).json({
        ok: true,
        online: onlineCount,
        searching: searchingCount,
        timestamp: now
    });
};
