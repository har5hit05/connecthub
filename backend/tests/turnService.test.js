const turnService = require('../services/turnService');

describe('TURN Service', () => {
    // Save original env values to restore later
    const originalTurnUrl = process.env.TURN_URL;
    const originalTurnSecret = process.env.TURN_SECRET;
    
    beforeAll(() => {
        process.env.TURN_URL = 'turn:localhost:3478';
        process.env.TURN_SECRET = 'my_test_secret';
    });
    
    afterAll(() => {
        process.env.TURN_URL = originalTurnUrl;
        process.env.TURN_SECRET = originalTurnSecret;
    });

    it('should correctly generate ephemeral TURN credentials', () => {
        const credentials = turnService.getTurnCredentials();
        
        expect(credentials).toBeDefined();
        // Should return a standard STUN server as well
        expect(credentials).toContainEqual(expect.objectContaining({
            urls: 'stun:stun.l.google.com:19302'
        }));
        
        // Find our dynamic TURN object
        const turnServer = credentials.find(server => server.urls === 'turn:localhost:3478');
        expect(turnServer).toBeDefined();
        
        // Assert cryptographic properties
        expect(turnServer.username).toMatch(/:connecthub_user$/);
        expect(turnServer.credential).toBeDefined();
        expect(typeof turnServer.credential).toBe('string');
    });
});
