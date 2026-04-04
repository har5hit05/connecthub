const crypto = require('crypto');
const config = require('../config');

/**
 * TURN Credential Service
 * 
 * WHY EPHEMERAL CREDENTIALS:
 * We can't ship static TURN passwords to the browser — anyone could extract
 * them from DevTools and abuse our relay server forever. Instead, CoTURN's
 * "REST API" auth mode lets us generate HMAC-signed credentials that expire
 * automatically. The flow:
 * 
 *   1. Frontend requests ICE config from our API (authenticated via JWT).
 *   2. We generate a username = "expiryTimestamp:userId" and an HMAC-SHA1 
 *      hash of that username using the shared secret.
 *   3. CoTURN independently computes the same HMAC and verifies it matches.
 *   4. After the expiry timestamp passes, the credential is rejected.
 * 
 * This is the standard mechanism documented at:
 * https://tools.ietf.org/html/draft-uberti-behave-turn-rest-00
 */
class TurnService {
    /**
     * Generate a full ICE servers configuration array.
     * Always includes free Google STUN servers + our private TURN relay.
     * 
     * @param {number} userId - The authenticated user's ID (embedded in credential)
     * @returns {Object} ICE configuration object ready for RTCPeerConnection
     */
    getIceServers(userId) {
        const iceServers = [
            // Public STUN servers (free, no auth needed, just helps discover public IP)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];

        // Only add TURN if configured (graceful fallback to STUN-only in dev)
        if (config.turn.url && config.turn.secret) {
            const turnCredentials = this._generateCredentials(userId);
            iceServers.push({
                urls: config.turn.url,
                username: turnCredentials.username,
                credential: turnCredentials.credential
            });
        }

        return { iceServers };
    }

    /**
     * Generate time-limited TURN credentials using HMAC-SHA1.
     * 
     * CoTURN's --use-auth-secret mode expects:
     *   username = "unixTimestampOfExpiry:arbitraryLabel"
     *   password = Base64( HMAC-SHA1(sharedSecret, username) )
     * 
     * @param {number} userId - Used as the arbitrary label portion
     * @returns {{ username: string, credential: string }}
     */
    _generateCredentials(userId) {
        const ttl = 24 * 60 * 60; // 24 hours in seconds
        const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
        const username = `${expiryTimestamp}:${userId}`;

        const hmac = crypto.createHmac('sha1', config.turn.secret);
        hmac.update(username);
        const credential = hmac.digest('base64');

        return { username, credential };
    }
}

module.exports = new TurnService();
