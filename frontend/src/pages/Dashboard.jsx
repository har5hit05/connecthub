import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function Dashboard() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalCalls: 0,
        completedCalls: 0,
        totalDuration: 0,
        totalContacts: 0
    });
    const [recentCalls, setRecentCalls] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch users count
                const usersRes = await axios.get(`${API_URL}/chat/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Fetch call history
                const callsRes = await axios.get(`${API_URL}/chat/calls`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const calls = callsRes.data.calls;
                const completedCalls = calls.filter(c => c.status === 'completed');
                const totalDuration = completedCalls.reduce((sum, c) => sum + (c.duration || 0), 0);

                setStats({
                    totalCalls: calls.length,
                    completedCalls: completedCalls.length,
                    totalDuration: totalDuration,
                    totalContacts: usersRes.data.users.length
                });

                // Get last 3 calls for recent activity
                setRecentCalls(calls.slice(0, 3));
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    // Format seconds into "Xm Ys"
    const formatDuration = (seconds) => {
        if (!seconds || seconds === 0) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        if (secs === 0) return `${mins}m`;
        return `${mins}m ${secs}s`;
    };

    const getOtherName = (call) => {
        return call.caller_id === user.id ? call.receiver_username : call.caller_username;
    };

    const getStatusColor = (status) => {
        if (status === 'completed') return '#4ade80';
        return '#f87171';
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading-screen">Loading...</div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="dashboard-header-left">
                    <h1 className="dashboard-title">ConnectHub</h1>
                </div>
                <div className="dashboard-header-right">
                    <span className="dashboard-username">👤 {user?.username}</span>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="dashboard-content">

                {/* Welcome Section */}
                <div className="dashboard-welcome">
                    <h2>Welcome back, {user?.username} 👋</h2>
                    <p>Here's what's happening</p>
                </div>

                {/* Stats Grid */}
                <div className="dashboard-stats">
                    <div className="dashboard-stat-card">
                        <div className="dashboard-stat-icon">👥</div>
                        <div className="dashboard-stat-value">{stats.totalContacts}</div>
                        <div className="dashboard-stat-label">Contacts</div>
                    </div>
                    <div className="dashboard-stat-card">
                        <div className="dashboard-stat-icon">📞</div>
                        <div className="dashboard-stat-value">{stats.totalCalls}</div>
                        <div className="dashboard-stat-label">Total Calls</div>
                    </div>
                    <div className="dashboard-stat-card">
                        <div className="dashboard-stat-icon">✅</div>
                        <div className="dashboard-stat-value">{stats.completedCalls}</div>
                        <div className="dashboard-stat-label">Completed</div>
                    </div>
                    <div className="dashboard-stat-card">
                        <div className="dashboard-stat-icon">⏱️</div>
                        <div className="dashboard-stat-value">{formatDuration(stats.totalDuration)}</div>
                        <div className="dashboard-stat-label">Total Duration</div>
                    </div>
                </div>

                {/* Bottom Row: Quick Actions + Recent Calls */}
                <div className="dashboard-bottom">

                    {/* Quick Actions */}
                    <div className="dashboard-card">
                        <h3 className="dashboard-card-title">Quick Actions</h3>
                        <div className="quick-actions">
                            <button className="quick-action-btn" onClick={() => navigate('/chat')}>
                                <span className="quick-action-icon">💬</span>
                                <span>Chat</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/chat')}>
                                <span className="quick-action-icon">📹</span>
                                <span>Video Call</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/chat')}>
                                <span className="quick-action-icon">📞</span>
                                <span>Audio Call</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/calls')}>
                                <span className="quick-action-icon">📋</span>
                                <span>History</span>
                            </button>
                        </div>
                    </div>

                    {/* Recent Calls */}
                    <div className="dashboard-card">
                        <div className="dashboard-card-header">
                            <h3 className="dashboard-card-title">Recent Calls</h3>
                            <Link to="/calls" className="see-all-link">See all →</Link>
                        </div>

                        {recentCalls.length === 0 ? (
                            <p className="dashboard-empty-text">No calls yet. Start chatting!</p>
                        ) : (
                            <div className="recent-calls-list">
                                {recentCalls.map((call) => (
                                    <div key={call.id} className="recent-call-item">
                                        <div className="recent-call-avatar">
                                            {getOtherName(call).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="recent-call-info">
                                            <span className="recent-call-name">{getOtherName(call)}</span>
                                            <span className="recent-call-meta">
                                                {call.call_type === 'video' ? '📹' : '📞'} {call.call_type}
                                                {call.status === 'completed' && ` · ${formatDuration(call.duration)}`}
                                            </span>
                                        </div>
                                        <span className="recent-call-status" style={{ color: getStatusColor(call.status) }}>
                                            {call.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;