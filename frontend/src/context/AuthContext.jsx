import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL as BASE_API_URL } from '../config';

const AuthContext = createContext();

// Auth endpoints are under /auth — derived from the centralized API_URL
const API_URL = `${BASE_API_URL}/auth`;

// Send cookies with every axios request (for browsers that support third-party cookies)
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);

    // On first load, restore token from localStorage (handles page refresh and incognito)
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }

        axios
            .get(`${API_URL}/profile`)
            .then((response) => {
                setUser(response.data.user);
            })
            .catch(() => {
                // Token invalid/expired — clear everything
                localStorage.removeItem('token');
                delete axios.defaults.headers.common['Authorization'];
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

    // LOGIN function — server sets httpOnly cookie AND returns token in body
    // Token is stored in localStorage as fallback for cross-origin/incognito
    const login = async (email, password) => {
        const response = await axios.post(`${API_URL}/login`, { email, password });
        const { user, token } = response.data;

        if (token) {
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        setUser(user);
        return response.data;
    };

    // LOGOUT function — clear cookie, localStorage token, and local state
    const logout = async () => {
        try {
            await axios.post(`${API_URL}/logout`);
        } catch {
            // Clear state even if the request fails
        }
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
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
