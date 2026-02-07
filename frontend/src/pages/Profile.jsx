import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function Profile() {
    const { user: currentUser, token, logout } = useAuth();
    const { userId } = useParams(); // If viewing another user's profile
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Edit form state
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [status, setStatus] = useState('Available');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);

    const isMyProfile = !userId || parseInt(userId) === currentUser.id;

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const fetchProfile = async () => {
        try {
            const endpoint = isMyProfile
                ? `${API_URL}/profile/me`
                : `${API_URL}/profile/${userId}`;

            const response = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProfile(response.data.user);

            // Initialize form with current values
            if (isMyProfile) {
                setDisplayName(response.data.user.display_name || '');
                setBio(response.data.user.bio || '');
                setStatus(response.data.user.status || 'Available');
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            alert('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }

            // Check file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            setAvatarFile(file);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadAvatar = async () => {
        if (!avatarFile) return;

        const formData = new FormData();
        formData.append('avatar', avatarFile);

        try {
            const response = await axios.post(`${API_URL}/profile/avatar`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert('Avatar updated successfully!');
            setAvatarFile(null);
            setAvatarPreview(null);
            fetchProfile(); // Refresh profile
        } catch (error) {
            console.error('Avatar upload failed:', error);
            alert(error.response?.data?.message || 'Failed to upload avatar');
        }
    };

    const handleDeleteAvatar = async () => {
        if (!confirm('Delete your profile picture?')) return;

        try {
            await axios.delete(`${API_URL}/profile/avatar`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Avatar deleted');
            fetchProfile();
        } catch (error) {
            console.error('Delete avatar failed:', error);
            alert('Failed to delete avatar');
        }
    };

    const handleSaveProfile = async () => {
        try {
            await axios.put(`${API_URL}/profile/me`, {
                displayName,
                bio,
                status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Profile updated successfully!');
            setEditing(false);
            fetchProfile();
        } catch (error) {
            console.error('Update profile failed:', error);
            alert('Failed to update profile');
        }
    };

    if (loading) {
        return (
            <div className="profile-container">
                <div className="loading-screen">Loading...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-container">
                <div className="error-screen">User not found</div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Header */}
            <div className="profile-header">
                <div className="header-left">
                    <Link to="/" className="header-logo">ConnectHub</Link>
                </div>
                <div className="header-nav">
                    <Link to="/" className="nav-link">Dashboard</Link>
                    <Link to="/chat" className="nav-link">Chat</Link>
                    <Link to="/friends" className="nav-link">Friends</Link>
                    <Link to="/calls" className="nav-link">History</Link>
                    <Link to="/profile" className="nav-link active">Profile</Link>
                </div>
                <div className="header-right">
                    <span className="header-username">
                        <span className="user-icon">&#128100;</span> {currentUser?.username}
                    </span>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
            </div>

            {/* Content */}
            <div className="profile-content">
                <div className="profile-card">

                    {/* Avatar Section */}
                    <div className="profile-avatar-section">
                        <div className="avatar-large">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Preview" />
                            ) : profile.avatar_url ? (
                                <img src={`http://localhost:5000${profile.avatar_url}`} alt="Avatar" />
                            ) : (
                                <span>{(profile.display_name || profile.username).charAt(0).toUpperCase()}</span>
                            )}
                        </div>

                        {isMyProfile && (
                            <div className="avatar-actions">
                                {avatarPreview ? (
                                    <>
                                        <button className="btn-primary" onClick={handleUploadAvatar}>
                                            Upload
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => {
                                                setAvatarFile(null);
                                                setAvatarPreview(null);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <label htmlFor="avatar-input" className="btn-primary">
                                            Change Avatar
                                        </label>
                                        <input
                                            id="avatar-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            style={{ display: 'none' }}
                                        />
                                        {profile.avatar_url && (
                                            <button className="btn-danger" onClick={handleDeleteAvatar}>
                                                Delete
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Profile Info */}
                    <div className="profile-info-section">
                        {!editing ? (
                            // View Mode
                            <>
                                <div className="profile-field">
                                    <label>USERNAME</label>
                                    <div className="field-value">@{profile.username}</div>
                                </div>

                                <div className="profile-field">
                                    <label>DISPLAY NAME</label>
                                    <div className="field-value">{profile.display_name || 'Not set'}</div>
                                </div>

                                <div className="profile-field">
                                    <label>EMAIL</label>
                                    <div className="field-value">{profile.email}</div>
                                </div>

                                <div className="profile-field">
                                    <label>STATUS</label>
                                    <div className="status-badge">
                                        {profile.status || 'Available'}
                                    </div>
                                </div>

                                <div className="profile-field">
                                    <label>BIO</label>
                                    <div className="field-value bio-text">
                                        {profile.bio || 'No bio yet'}
                                    </div>
                                </div>

                                <div className="profile-field">
                                    <label>MEMBER SINCE</label>
                                    <div className="field-value">
                                        {new Date(profile.created_at).toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                </div>

                                {isMyProfile && (
                                    <>
                                        <button className="btn-primary btn-full-width" onClick={() => setEditing(true)}>
                                            Edit Profile
                                        </button>
                                        <Link to="/blocked" className="btn-secondary btn-full-width" style={{ textAlign: 'center', display: 'block', marginTop: '12px', textDecoration: 'none' }}>
                                            Blocked Users
                                        </Link>
                                    </>
                                )}
                            </>
                        ) : (
                            // Edit Mode
                            <>
                                <div className="profile-field">
                                    <label>DISPLAY NAME</label>
                                    <input
                                        type="text"
                                        className="field-input"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Your display name"
                                    />
                                </div>

                                <div className="profile-field">
                                    <label>STATUS</label>
                                    <select
                                        className="field-input"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="Available">Available</option>
                                        <option value="Busy">Busy</option>
                                        <option value="Away">Away</option>
                                        <option value="Do Not Disturb">Do Not Disturb</option>
                                    </select>
                                </div>

                                <div className="profile-field">
                                    <label>BIO</label>
                                    <textarea
                                        className="field-textarea"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..."
                                        rows="4"
                                    />
                                </div>

                                <div className="profile-actions">
                                    <button className="btn-primary" onClick={handleSaveProfile}>
                                        Save Changes
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => {
                                            setEditing(false);
                                            // Reset to original values
                                            setDisplayName(profile.display_name || '');
                                            setBio(profile.bio || '');
                                            setStatus(profile.status || 'Available');
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;