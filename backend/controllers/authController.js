const authService = require('../services/authService');
const config = require('../config');

// Shared cookie options — pulled from centralized config
const COOKIE_OPTIONS = config.cookie;

/**
 * Controller Layer
 * 
 * WHY A THIN CONTROLLER?
 * Notice how clean this is. The controller's ONLY job is translating HTTP concepts
 * (req.body, res.cookie, res.status) to business logic concepts (authService)
 * and catching errors to pass to next().
 */

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const user = await authService.register(username, email, password);
        
        res.status(201).json({
            message: 'Registration successful',
            user
        });
    } catch (error) {
        next(error); // Global Error Handler will catch this (including our custom AppErrors)
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        
        // The service generated the token, but setting the HTTP cookie is the Controller's job
        res.cookie('jwt', result.token, COOKIE_OPTIONS);

        res.status(200).json({
            message: 'Login successful',
            user: result.user,
            token: result.token
        });
    } catch (error) {
        next(error);
    }
};

const logout = (req, res, next) => {
    try {
        res.clearCookie('jwt', {
            httpOnly: COOKIE_OPTIONS.httpOnly,
            secure:   COOKIE_OPTIONS.secure,
            sameSite: COOKIE_OPTIONS.sameSite
        });
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const user = await authService.getProfile(req.user.id);
        res.status(200).json({ user });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login, logout, getProfile };