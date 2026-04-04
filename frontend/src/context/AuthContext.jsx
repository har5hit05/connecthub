import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL as BASE_API_URL } from '../config';

const AuthContext = createContext();

// Auth endpoints are under /auth — derived from the centralized API_URL
const API_URL = `${BASE_API_URL}/auth`;

// Send cookies with every axios request (required for httpOnly cookie auth)
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);

    // On first load, check if a valid session cookie exists
    useEffect(() => {
        axios
            .get(`${API_URL}/profile`)
            .then((response) => {
                setUser(response.data.user);
            })
            .catch(() => {
                // No valid cookie — user is not logged in
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // REGISTER function
    const register = async (username, email, password) => {
        const response = await axios.post(`${API_URL}/register`, {
            username,
            email,
            password
        });
        return response.data;
    };

    // LOGIN function — server sets httpOnly cookie, we just store the user object
    const login = async (email, password) => {
        const response = await axios.post(`${API_URL}/login`, { email, password });
        setUser(response.data.user);
        return response.data;
    };

    // LOGOUT function — ask server to clear the cookie, then clear local state
    const logout = async () => {
        try {
            await axios.post(`${API_URL}/logout`);
        } catch {
            // Clear state even if the request fails
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, register, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return context;
};
