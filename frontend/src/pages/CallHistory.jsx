import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function CallHistory() {
  const { user, token } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await axios.get(`${API_URL}/chat/calls`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCalls(response.data.calls);
      } catch (error) {
        console.error('Failed to fetch call history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, [token]);

  // Format seconds into "Xm Ys"
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '< 1s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get the OTHER person's name (not me)
  const getOtherUser = (call) => {
    if (call.caller_id === user.id) {
      return { name: call.receiver_username, isCaller: true };
    }
    return { name: call.caller_username, isCaller: false };
  };

  // Icon and color based on status
  const getStatusStyle = (status, isCaller) => {
    switch (status) {
      case 'completed':
        return { icon: isCaller ? '↗' : '↙', color: '#4ade80', label: isCaller ? 'Outgoing' : 'Incoming' };
      case 'missed':
        return { icon: '↙', color: '#f87171', label: 'Missed' };
      case 'rejected':
        return { icon: isCaller ? '↗' : '↙', color: '#f87171', label: isCaller ? 'Rejected' : 'You Rejected' };
      default:
        return { icon: '↗', color: '#64748b', label: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <div className="callhistory-container">
        <div className="callhistory-header">
          <Link to="/" className="back-btn">← Back</Link>
          <h2>Call History</h2>
        </div>
        <div className="callhistory-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="callhistory-container">
      {/* Header */}
      <div className="callhistory-header">
        <Link to="/" className="back-btn">← Back</Link>
        <h2>Call History</h2>
      </div>

      {/* Stats Summary */}
      <div className="callhistory-stats">
        <div className="stat-card">
          <span className="stat-number">{calls.length}</span>
          <span className="stat-label">Total Calls</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{calls.filter(c => c.status === 'completed').length}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {formatDuration(calls.reduce((sum, c) => sum + (c.duration || 0), 0))}
          </span>
          <span className="stat-label">Total Time</span>
        </div>
      </div>

      {/* Call List */}
      <div className="callhistory-list">
        {calls.length === 0 ? (
          <div className="callhistory-empty">
            <div className="empty-icon">📞</div>
            <h3>No calls yet</h3>
            <p>Your call history will appear here after you make or receive calls.</p>
          </div>
        ) : (
          calls.map((call) => {
            const otherUser = getOtherUser(call);
            const statusStyle = getStatusStyle(call.status, otherUser.isCaller);

            return (
              <div key={call.id} className="call-item">
                {/* Direction + Status icon */}
                <div className="call-icon-wrap" style={{ color: statusStyle.color }}>
                  <span className="call-direction-icon">{statusStyle.icon}</span>
                  <span className="call-type-icon">
                    {call.call_type === 'video' ? '📹' : '📞'}
                  </span>
                </div>

                {/* Info */}
                <div className="call-info">
                  <span className="call-other-name">{otherUser.name}</span>
                  <span className="call-meta">
                    <span style={{ color: statusStyle.color }}>{statusStyle.label}</span>
                    <span className="call-meta-sep">·</span>
                    <span>{call.call_type === 'video' ? 'Video' : 'Audio'}</span>
                    {call.status === 'completed' && (
                      <>
                        <span className="call-meta-sep">·</span>
                        <span>{formatDuration(call.duration)}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Date */}
                <div className="call-date">{formatDate(call.created_at)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CallHistory;