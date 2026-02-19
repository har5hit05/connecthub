import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function Friends() {
    const { user, token, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'search', 'requests'

    // Friends list
    const [friends, setFriends] = useState([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Friend requests
    const [receivedRequests, setReceivedRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);

    const [loading, setLoading] = useState(true);

    // Load friends when component mounts or token changes
    useEffect(() => {
        if (!token) return;
        fetchFriends();
        fetchRequests();
    }, [token]);

    const fetchFriends = async () => {
        try {
            const response = await axios.get(`${API_URL}/friends/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriends(response.data.friends);
        } catch (error) {
            console.error('Failed to fetch friends:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRequests = async () => {
        try {
            const [received, sent] = await Promise.all([
                axios.get(`${API_URL}/friends/requests/received`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/friends/requests/sent`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setReceivedRequests(received.data.requests);
            setSentRequests(sent.data.requests);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) {
            alert('Please enter at least 2 characters to search');
            return;
        }

        setSearchLoading(true);
        try {
            const response = await axios.get(`${API_URL}/friends/search?query=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Search results:', response.data.users);

            // Get friendship status for each user
            const usersWithStatus = await Promise.all(
                response.data.users.map(async (searchUser) => {
                    try {
                        const statusRes = await axios.get(`${API_URL}/friends/status/${searchUser.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        console.log(`Status for ${searchUser.username}:`, statusRes.data);
                        return { ...searchUser, friendshipStatus: statusRes.data };
                    } catch (error) {
                        console.error(`Failed to get status for user ${searchUser.id}:`, error);
                        // Return user with default 'none' status if status check fails
                        return { ...searchUser, friendshipStatus: { status: 'none' } };
                    }
                })
            );

            console.log('Users with status:', usersWithStatus);
            setSearchResults(usersWithStatus);
        } catch (error) {
            console.error('Search failed:', error);
            alert('Search failed. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    };

    const sendFriendRequest = async (receiverId) => {
        try {
            const response = await axios.post(`${API_URL}/friends/request`,
                { receiverId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(response.data.message || 'Friend request sent!');
            handleSearch(); // Refresh search results
            fetchRequests(); // Refresh requests
        } catch (error) {
            console.error('Send request error:', error);
            alert(error.response?.data?.message || 'Failed to send request');
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            await axios.post(`${API_URL}/friends/requests/${requestId}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Friend request accepted!');
            fetchFriends();
            fetchRequests();
        } catch (error) {
            console.error('Accept error:', error);
            alert('Failed to accept request');
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            await axios.delete(`${API_URL}/friends/requests/${requestId}/reject`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Friend request rejected');
            fetchRequests();
        } catch (error) {
            console.error('Reject error:', error);
            alert('Failed to reject request');
        }
    };

    const cancelRequest = async (requestId) => {
        try {
            await axios.delete(`${API_URL}/friends/requests/${requestId}/cancel`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Friend request cancelled');
            fetchRequests();
            handleSearch(); // Refresh search if active
        } catch (error) {
            console.error('Cancel error:', error);
            alert('Failed to cancel request');
        }
    };

    const removeFriend = async (friendId) => {
        if (!confirm('Remove this friend?')) return;

        try {
            await axios.delete(`${API_URL}/friends/${friendId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Friend removed');
            fetchFriends();
        } catch (error) {
            console.error('Remove error:', error);
            alert('Failed to remove friend');
        }
    };

    const renderActionButton = (searchUser) => {
        const status = searchUser.friendshipStatus?.status;

        if (status === 'friends') {
            return (
                <Link to="/chat" className="btn-primary-small">
                    Chat
                </Link>
            );
        } else if (status === 'request_sent') {
            return (
                <button
                    className="btn-secondary-small"
                    onClick={() => cancelRequest(searchUser.friendshipStatus.requestId)}
                >
                    Pending
                </button>
            );
        } else if (status === 'request_received') {
            return (
                <button
                    className="btn-success-small"
                    onClick={() => acceptRequest(searchUser.friendshipStatus.requestId)}
                >
                    Accept
                </button>
            );
        } else {
            return (
                <button
                    className="btn-primary-small"
                    onClick={() => sendFriendRequest(searchUser.id)}
                >
                    + Add Friend
                </button>
            );
        }
    };

    const handleBlockUser = async (userId) => {
        if (!confirm('Block this user? This will remove them from your friends and they will not be able to contact you.')) return;

        try {
            await axios.post(`${API_URL}/block/block`,
                { blockedId: userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('User blocked successfully');
            fetchFriends(); // Refresh friends list
        } catch (error) {
            console.error('Block failed:', error);
            alert(error.response?.data?.message || 'Failed to block user');
        }
    };

    if (loading) {
        return (
            <div className="friends-container">
                <div className="loading-screen">Loading...</div>
            </div>
        );
    }

    return (
        <div className="friends-container">
            {/* Header */}
            <div className="friends-header">
                <div className="header-left">
                    <Link to="/" className="header-logo">ConnectHub</Link>
                </div>
                <div className="header-nav">
                    <Link to="/" className="nav-link">Dashboard</Link>
                    <Link to="/chat" className="nav-link">Chat</Link>
                    <Link to="/calls" className="nav-link">History</Link>
                    <Link to="/friends" className="nav-link active">Friends</Link>
                    <Link to="/profile" className="nav-link">Profile</Link>
                </div>
                <div className="header-right">
                    <span className="header-username">
                        <span className="user-icon">👤 </span> {user?.username}
                        <button className="logout-btn" onClick={logout}>Logout</button>
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="friends-content">
                <div className="friends-wrapper">
                    {/* Tabs */}
                    <div className="friends-tabs">
                        <button
                            className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
                            onClick={() => setActiveTab('friends')}
                        >
                            Friends ({friends.length})
                        </button>
                        <button
                            className={`friends-tab ${activeTab === 'search' ? 'active' : ''}`}
                            onClick={() => setActiveTab('search')}
                        >
                            Search
                        </button>
                        <button
                            className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            Requests ({receivedRequests.length})
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="friends-tab-content">

                        {/* FRIENDS LIST */}
                        {activeTab === 'friends' && (
                            <div className="friends-list">
                                {friends.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">&#128101;</div>
                                        <h3>No friends yet</h3>
                                        <p>Search for users and send friend requests!</p>
                                        <button
                                            className="btn-primary"
                                            onClick={() => setActiveTab('search')}
                                        >
                                            Search Users
                                        </button>
                                    </div>
                                ) : (
                                    friends.map((friend) => (
                                        <div key={friend.friend_id} className="friend-card">
                                            <div className={`friend-avatar ${friend.is_online ? 'online' : 'offline'}`}>
                                                {friend.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="friend-info">
                                                <span className="friend-name">{friend.username}</span>
                                                <span className={`friend-status ${friend.is_online ? 'online' : 'offline'}`}>
                                                    {friend.is_online ? 'Online' : 'Offline'}
                                                </span>
                                            </div>
                                            <div className="friend-actions">
                                                <Link to="/chat" className="btn-icon" title="Chat">
                                                    &#128172;
                                                </Link>
                                                <button
                                                    className="btn-icon-warning"
                                                    onClick={() => handleBlockUser(friend.friend_id)}
                                                    title="Block User"
                                                >
                                                    &#128683;
                                                </button>
                                                <button
                                                    className="btn-icon-danger"
                                                    onClick={() => removeFriend(friend.friend_id)}
                                                    title="Remove Friend"
                                                >
                                                    &#128465;
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* SEARCH TAB */}
                        {activeTab === 'search' && (
                            <div className="search-section">
                                <div className="search-bar">
                                    <input
                                        type="text"
                                        placeholder="Search by username..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                        className="search-input"
                                    />
                                    <button
                                        className="search-btn"
                                        onClick={handleSearch}
                                        disabled={searchLoading || searchQuery.trim().length < 2}
                                    >
                                        {searchLoading ? 'Searching...' : 'Search'}
                                    </button>
                                </div>

                                <div className="search-results">
                                    {searchResults.length === 0 && !searchLoading ? (
                                        <div className="empty-state-small">
                                            <p>
                                                {searchQuery.trim().length >= 2
                                                    ? 'No users found. Try a different search term.'
                                                    : 'Enter a username to search'}
                                            </p>
                                        </div>
                                    ) : (
                                        searchResults.map((searchUser) => (
                                            <div key={searchUser.id} className="search-result-card">
                                                <div className={`result-avatar ${searchUser.is_online ? 'online' : 'offline'}`}>
                                                    {searchUser.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="result-info">
                                                    <span className="result-name">{searchUser.username}</span>
                                                    <span className="result-email">{searchUser.email}</span>
                                                </div>
                                                {renderActionButton(searchUser)}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* REQUESTS TAB */}
                        {activeTab === 'requests' && (
                            <div className="requests-section">
                                <h3 className="section-title">Received Requests</h3>
                                {receivedRequests.length === 0 ? (
                                    <p className="empty-text">No pending requests</p>
                                ) : (
                                    <div className="requests-list">
                                        {receivedRequests.map((req) => (
                                            <div key={req.id} className="request-card">
                                                <div className="request-avatar">
                                                    {req.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="request-info">
                                                    <span className="request-name">{req.username}</span>
                                                    <span className="request-time">
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="request-actions">
                                                    <button
                                                        className="btn-success-small"
                                                        onClick={() => acceptRequest(req.id)}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        className="btn-danger-small"
                                                        onClick={() => rejectRequest(req.id)}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <h3 className="section-title" style={{ marginTop: '32px' }}>Sent Requests</h3>
                                {sentRequests.length === 0 ? (
                                    <p className="empty-text">No sent requests</p>
                                ) : (
                                    <div className="requests-list">
                                        {sentRequests.map((req) => (
                                            <div key={req.id} className="request-card">
                                                <div className="request-avatar">
                                                    {req.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="request-info">
                                                    <span className="request-name">{req.username}</span>
                                                    <span className="request-time">
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <button
                                                    className="btn-secondary-small"
                                                    onClick={() => cancelRequest(req.id)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

export default Friends;