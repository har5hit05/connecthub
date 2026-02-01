import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import IncomingCall from '../components/IncomingCall.jsx';
import VideoCall from '../components/VideoCall';

const API_URL = 'http://localhost:5000/api';

function Home() {
    const { user, token, logout } = useAuth();
    const {
        onlineUsers,
        messages,
        setMessages,
        typingUsers,
        selectedUser,
        selectUser,
        sendMessage,
        startTyping,
        stopTyping,
        setContacts,
        // Call stuff
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        callStatus,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        // Screen sharing
        isSharing,
        shareScreen,
        stopSharing
    } = useSocket();

    const [contacts, setLocalContacts] = useState([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // ─── LOAD ALL USERS ───
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get(`${API_URL}/chat/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLocalContacts(response.data.users);
                setContacts(response.data.users);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            }
        };
        fetchUsers();
    }, [token, setContacts]);

    // ─── LOAD CHAT HISTORY ───
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedUser) return;
            try {
                const response = await axios.get(`${API_URL}/chat/history/${selectedUser.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMessages(response.data.messages);
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        };
        fetchHistory();
    }, [selectedUser, token, setMessages]);

    // ─── AUTO SCROLL ───
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // ─── TYPING HANDLER ───
    const handleInputChange = (e) => {
        setInputText(e.target.value);
        if (selectedUser) {
            startTyping(selectedUser.id);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => stopTyping(selectedUser.id), 2000);
        }
    };

    // ─── SEND MESSAGE ───
    const handleSend = () => {
        if (!inputText.trim() || !selectedUser) return;
        sendMessage(selectedUser.id, inputText.trim());
        setInputText('');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    // ─── FILTER MESSAGES ───
    const chatMessages = selectedUser
        ? messages.filter(
            (msg) =>
                (msg.sender_id === user.id && msg.receiver_id === selectedUser.id) ||
                (msg.sender_id === selectedUser.id && msg.receiver_id === user.id) ||
                (msg.senderId === user.id && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === user.id)
        )
        : [];

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    };

    const isUserOnline = (userId) => onlineUsers.includes(userId);
    const isSelectedUserTyping = selectedUser && typingUsers[selectedUser.id];

    // Find the incoming caller's username
    const incomingCaller = incomingCall
        ? { id: incomingCall.callerId, username: contacts.find(c => c.id === incomingCall.callerId)?.username || 'Someone' }
        : null;

    // ─── RENDER ───
    return (
        <div className="home-container">

            {/* ── INCOMING CALL OVERLAY ── */}
            {incomingCall && (
                <IncomingCall
                    caller={incomingCaller}
                    callType={incomingCall.callType}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                />
            )}

            {/* ── ACTIVE VIDEO/AUDIO CALL SCREEN ── */}
            {activeCall && (callStatus === 'connected' || activeCall.callType) && remoteStream ? (
                <VideoCall
                    localStream={localStream}
                    remoteStream={remoteStream}
                    otherUser={activeCall}
                    callType={activeCall.callType}
                    onEndCall={endCall}
                    isSharing={isSharing}
                    onShareScreen={shareScreen}
                    onStopSharing={stopSharing}
                />
            ) : null}

            {/* ── CALLING... SCREEN (waiting for other person to accept) ── */}
            {activeCall && callStatus === 'calling' && (
                <div className="calling-overlay">
                    <div className="calling-box">
                        <div className="calling-avatar">
                            {activeCall?.username?.charAt(0).toUpperCase()}
                        </div>
                        <h2>Calling {activeCall?.username}...</h2>
                        <div className="calling-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <button className="calling-end-btn" onClick={endCall}>Cancel</button>
                    </div>
                </div>
            )}

            {/* ── NORMAL CHAT LAYOUT (shown when no active call) ── */}
            {!activeCall && (
                <>
                    {/* Header */}
                    <div className="home-header">
                        <h1>ConnectHub</h1>
                        <div className="header-right">
                            <span className="header-username">👤 {user?.username}</span>
                            <button className="logout-btn" onClick={logout}>Logout</button>
                        </div>
                    </div>

                    <div className="chat-layout">
                        {/* LEFT SIDEBAR */}
                        <div className="sidebar">
                            <div className="sidebar-header">
                                <h3>Contacts</h3>
                                <span className="online-count">{onlineUsers.length} online</span>
                            </div>

                            <div className="contact-list">
                                {contacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className={`contact-item ${selectedUser?.id === contact.id ? 'active' : ''}`}
                                        onClick={() => selectUser(contact)}
                                    >
                                        <div className={`avatar ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                                            {contact.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="contact-info">
                                            <span className="contact-name">{contact.username}</span>
                                            <span className={`contact-status ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                                                {isUserOnline(contact.id) ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        {/* Call buttons — only show if user is online */}
                                        {isUserOnline(contact.id) && (
                                            <div className="contact-call-buttons">
                                                <button
                                                    className="call-icon-btn audio-call"
                                                    onClick={(e) => { e.stopPropagation(); initiateCall(contact, 'audio'); }}
                                                    title="Audio Call"
                                                >📞</button>
                                                <button
                                                    className="call-icon-btn video-call"
                                                    onClick={(e) => { e.stopPropagation(); initiateCall(contact, 'video'); }}
                                                    title="Video Call"
                                                >📹</button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {contacts.length === 0 && (
                                    <p className="no-contacts">No other users yet.</p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT CHAT AREA */}
                        <div className="chat-area">
                            {!selectedUser ? (
                                <div className="chat-placeholder">
                                    <div className="placeholder-icon">💬</div>
                                    <h2>Select a contact</h2>
                                    <p>Choose someone from the left to start chatting or calling</p>
                                </div>
                            ) : (
                                <>
                                    {/* Chat Header */}
                                    <div className="chat-header">
                                        <div className={`chat-header-avatar ${isUserOnline(selectedUser.id) ? 'online' : 'offline'}`}>
                                            {selectedUser.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="chat-header-info">
                                            <span className="chat-header-name">{selectedUser.username}</span>
                                            <span className={`chat-header-status ${isUserOnline(selectedUser.id) ? 'online' : 'offline'}`}>
                                                {isUserOnline(selectedUser.id) ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        {/* Call buttons in chat header */}
                                        {isUserOnline(selectedUser.id) && (
                                            <div className="chat-header-call-buttons">
                                                <button
                                                    className="call-icon-btn audio-call"
                                                    onClick={() => initiateCall(selectedUser, 'audio')}
                                                    title="Audio Call"
                                                >📞</button>
                                                <button
                                                    className="call-icon-btn video-call"
                                                    onClick={() => initiateCall(selectedUser, 'video')}
                                                    title="Video Call"
                                                >📹</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Messages */}
                                    <div className="messages-list">
                                        {chatMessages.map((msg, index) => {
                                            const isMine = (msg.sender_id === user.id) || (msg.senderId === user.id);
                                            return (
                                                <div key={msg.id || index} className={`message ${isMine ? 'mine' : 'theirs'}`}>
                                                    <div className="message-bubble">
                                                        <span className="message-text">{msg.message}</span>
                                                        <span className="message-time">
                                                            {formatTime(msg.created_at || msg.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {isSelectedUserTyping && (
                                            <div className="message theirs">
                                                <div className="message-bubble typing-bubble">
                                                    <span className="typing-indicator">
                                                        <span></span><span></span><span></span>
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input */}
                                    <div className="message-input-area">
                                        <input
                                            type="text"
                                            className="message-input"
                                            placeholder={`Message ${selectedUser.username}...`}
                                            value={inputText}
                                            onChange={handleInputChange}
                                            onKeyPress={handleKeyPress}
                                        />
                                        <button className="send-btn" onClick={handleSend} disabled={!inputText.trim()}>
                                            Send
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Home;