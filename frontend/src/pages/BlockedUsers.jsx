import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function BlockedUsers() {
    const { user, token } = useAuth();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBlockedUsers();
    }, []);

    const fetchBlockedUsers = async () => {
        try {
            const response = await axios.get(`${API_URL}/block/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedUsers(response.data.blockedUsers);
        } catch (error) {
            console.error('Failed to fetch blocked users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (blockedId) => {
        if (!confirm('Unblock this user?')) return;

        try {
            await axios.delete(`${API_URL}/block/unblock/${blockedId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('User unblocked successfully');
            fetchBlockedUsers(); // Refresh list
        } catch (error) {
            console.error('Unblock failed:', error);
            alert('Failed to unblock user');
        }
    };

    if (loading) {
        return (
            <div className="blocked-container">
                <div className="loading-screen">Loading...</div>
            </div>
        );
    }

    return (
        <div className="blocked-container">
            {/* Header */}
            <div className="blocked-header">
                <div className="header-left">
                    <Link to="/" className="header-logo">ConnectHub</Link>
                </div>
                <div className="header-nav">
                    <Link to="/" className="nav-link">Dashboard</Link>
                    <Link to="/chat" className="nav-link">Chat</Link>
                    <Link to="/friends" className="nav-link">Friends</Link>
                    <Link to="/calls" className="nav-link">History</Link>
                    <Link to="/profile" className="nav-link">Profile</Link>
                </div>
                <div className="header-right">
                    <span className="header-username">
                        <span className="user-icon">&#128100;</span> {user?.username}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="blocked-content">
                <div className="blocked-wrapper">
                    <div className="blocked-title-section">
                        <h1 className="blocked-title">Blocked Users</h1>
                        <p className="blocked-subtitle">
                            Users you have blocked cannot message or call you
                        </p>
                    </div>

                    {blockedUsers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">&#128683;</div>
                            <h3>No blocked users</h3>
                            <p>You haven't blocked anyone yet</p>
                        </div>
                    ) : (
                        <div className="blocked-list">
                            {blockedUsers.map((blockedUser) => (
                                <div key={blockedUser.block_id} className="blocked-user-card">
                                    <div className="blocked-user-avatar">
                                        {blockedUser.avatar_url ? (
                                            <img
                                                src={`http://localhost:5000${blockedUser.avatar_url}`}
                                                alt={blockedUser.username}
                                            />
                                        ) : (
                                            <span>{blockedUser.username.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="blocked-user-info">
                                        <span className="blocked-user-name">
                                            {blockedUser.display_name || blockedUser.username}
                                        </span>
                                        <span className="blocked-user-username">@{blockedUser.username}</span>
                                        <span className="blocked-date">
                                            Blocked {new Date(blockedUser.blocked_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <button
                                        className="unblock-btn"
                                        onClick={() => handleUnblock(blockedUser.blocked_id)}
                                    >
                                        Unblock
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BlockedUsers;