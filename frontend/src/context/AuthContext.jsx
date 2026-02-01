import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// This is the shared state for authentication
// Any component in the app can access this
const AuthContext = createContext();

const API_URL = 'http://localhost:5000/api/auth';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);       // Stores logged-in user info
    const [token, setToken] = useState(null);     // Stores the JWT token
    const [loading, setLoading] = useState(true); // Shows loading while checking login status

    // When app first loads, check if user is already logged in
    useEffect(() => {
        const savedToken = localStorage.getItem('connecthub_token');
        if (savedToken) {
            // User was logged in before, let's verify the token is still valid
            axios
                .get(`${API_URL}/profile`, {
                    headers: { Authorization: `Bearer ${savedToken}` }
                })
                .then((response) => {
                    setUser(response.data.user);
                    setToken(savedToken);
                })
                .catch(() => {
                    // Token is invalid or expired, clear it
                    localStorage.removeItem('connecthub_token');
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
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

    // LOGIN function
    const login = async (email, password) => {
        const response = await axios.post(`${API_URL}/login`, {
            email,
            password
        });

        // Save token to localStorage so user stays logged in after refresh
        localStorage.setItem('connecthub_token', response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);

        return response.data;
    };

    // LOGOUT function
    const logout = () => {
        localStorage.removeItem('connecthub_token');
        setToken(null);
        setUser(null);
    };

    // Make these available to the entire app
    return (
        <AuthContext.Provider value={{ user, token, loading, register, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook — makes it easy to use auth in any component
// Instead of writing useContext(AuthContext), just write useAuth()
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return context;
};