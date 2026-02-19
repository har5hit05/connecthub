import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import IncomingCall from '../components/IncomingCall';
import VideoCall from '../components/VideoCall';

const API_URL = 'http://localhost:5000/api';
const BASE_URL = 'http://localhost:5000';

function Chat() {
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
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        callStatus,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        isSharing,
        shareScreen,
        stopSharing
    } = useSocket();

    const [contacts, setLocalContacts] = useState([]);
    const [inputText, setInputText] = useState('');
    const [unreadCounts, setUnreadCounts] = useState({}); // { userId: count }
    const prevMessagesLengthRef = useRef(0); // track previous message count to detect only new arrivals
    const [selectedFile, setSelectedFile] = useState(null); // file object chosen by user
    const [filePreview, setFilePreview] = useState(null);   // preview URL for images
    const [isUploading, setIsUploading] = useState(false);  // upload in progress
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const previousSelectedUserRef = useRef(null); // Track previous selection
    const fileInputRef = useRef(null);

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

    // ─── LOAD CHAT HISTORY (FIXED) ───
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedUser) {
                // If no user is selected, clear messages
                setMessages([]);
                return;
            }

            // Only fetch if this is a NEW selection (not the same user clicked again)
            if (previousSelectedUserRef.current?.id === selectedUser.id) {
                // Same user - do nothing, messages already loaded
                return;
            }

            // New user selected - fetch their messages
            try {
                const response = await axios.get(`${API_URL}/chat/history/${selectedUser.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedMessages = response.data.messages;
                prevMessagesLengthRef.current = fetchedMessages.length; // mark baseline so history load doesn't trigger unread count
                setMessages(fetchedMessages);

                // Clear unread count for this user
                setUnreadCounts(prev => ({
                    ...prev,
                    [selectedUser.id]: 0
                }));

                // Update the previous selection
                previousSelectedUserRef.current = selectedUser;
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        };

        fetchHistory();
    }, [selectedUser, token, setMessages]);

    // ─── COUNT UNREAD MESSAGES ───
    useEffect(() => {
        // Only count messages that are genuinely new (not loaded from history)
        if (messages.length === 0) {
            prevMessagesLengthRef.current = 0;
            return;
        }

        // If messages grew by exactly 1 it's a real-time arrival
        if (messages.length === prevMessagesLengthRef.current + 1) {
            const lastMessage = messages[messages.length - 1];
            // Support both snake_case (from DB) and camelCase (from socket)
            const senderId = lastMessage.sender_id ?? lastMessage.senderId;

            // Increment unread only if message is from someone else AND that user is not currently open
            if (senderId !== user.id && senderId !== selectedUser?.id) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [senderId]: (prev[senderId] || 0) + 1
                }));
            }
        }

        prevMessagesLengthRef.current = messages.length;
    }, [messages, user.id, selectedUser]);

    // ─── AUTO SCROLL ───
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleInputChange = (e) => {
        setInputText(e.target.value);
        if (selectedUser) {
            startTyping(selectedUser.id);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => stopTyping(selectedUser.id), 2000);
        }
    };

    // ─── FILE SELECTION ───
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);

        // Generate preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setFilePreview(reader.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }

        // Reset the input so same file can be selected again
        e.target.value = '';
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
    };

    // ─── SEND MESSAGE (text and/or file) ───
    const handleSend = async () => {
        if (!selectedUser) return;
        if (!inputText.trim() && !selectedFile) return;

        if (selectedFile) {
            // Upload file first, then emit message with file info
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const response = await axios.post(`${API_URL}/chat/upload`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                const { fileUrl, fileType, originalName } = response.data;

                // Send via socket with file info (and optional caption text)
                sendMessage(
                    selectedUser.id,
                    inputText.trim() || null,
                    { fileUrl, fileType, fileName: originalName }
                );

                setSelectedFile(null);
                setFilePreview(null);
                setInputText('');
            } catch (error) {
                console.error('File upload failed:', error);
                alert('Failed to upload file. Please try again.');
            } finally {
                setIsUploading(false);
            }
        } else {
            // Text-only message
            sendMessage(selectedUser.id, inputText.trim());
            setInputText('');
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) handleSend();
    };

    // ─── HANDLE USER SELECTION (FIXED) ───
    const handleUserClick = (contact) => {
        if (selectedUser?.id === contact.id) {
            // Same user clicked - deselect them (close conversation)
            selectUser(null);
            setMessages([]);
            previousSelectedUserRef.current = null;
        } else {
            // New user clicked - select them (will trigger history fetch)
            selectUser(contact);
        }
    };

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

    // ─── RENDER FILE ATTACHMENT IN MESSAGE ───
    const renderFileAttachment = (msg) => {
        const fileUrl = msg.file_url || msg.fileUrl;
        const fileType = msg.file_type || msg.fileType;
        const fileName = msg.file_name || msg.fileName;

        if (!fileUrl) return null;

        const fullUrl = `${BASE_URL}${fileUrl}`;

        if (fileType && fileType.startsWith('image/')) {
            return (
                <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="file-image-link">
                    <img
                        src={fullUrl}
                        alt={fileName || 'image'}
                        className="message-image"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                </a>
            );
        }

        if (fileType && fileType.startsWith('video/')) {
            return (
                <video controls className="message-video">
                    <source src={fullUrl} type={fileType} />
                </video>
            );
        }

        if (fileType && fileType.startsWith('audio/')) {
            return (
                <audio controls className="message-audio">
                    <source src={fullUrl} type={fileType} />
                </audio>
            );
        }

        // Generic file (PDF, doc, etc.)
        return (
            <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="file-attachment"
                download={fileName}
            >
                <span className="file-icon">📎</span>
                <span className="file-name">{fileName || 'Download file'}</span>
            </a>
        );
    };

    const isUserOnline = (userId) => onlineUsers.includes(userId);
    const isSelectedUserTyping = selectedUser && typingUsers[selectedUser.id];

    const incomingCaller = incomingCall
        ? { id: incomingCall.callerId, username: contacts.find(c => c.id === incomingCall.callerId)?.username || 'Someone' }
        : null;

    return (
        <div className="home-container">

            {/* Incoming Call Overlay */}
            {incomingCall && (
                <IncomingCall
                    caller={incomingCaller}
                    callType={incomingCall.callType}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                />
            )}

            {/* Active Video/Audio Call */}
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

            {/* Calling... screen */}
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

            {/* Normal Chat Layout */}
            {!activeCall && (
                <>
                    {/* Header */}
                    <div className="home-header">
                        <div className="header-left">
                            <Link to="/" className="header-logo">ConnectHub</Link>
                        </div>
                        <div className="header-nav">
                            <Link to="/" className="nav-link">Dashboard</Link>
                            <Link to="/chat" className="nav-link active">Chat</Link>
                            <Link to="/calls" className="nav-link">History</Link>
                            <Link to="/friends" className="nav-link">Friends</Link>
                            <Link to="/profile" className="nav-link">Profile</Link>
                        </div>
                        <div className="header-right">
                            <span className="header-username">👤 {user?.username}</span>
                            <button className="logout-btn" onClick={logout}>Logout</button>
                        </div>
                    </div>

                    <div className="chat-layout">
                        {/* Sidebar */}
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
                                        onClick={() => handleUserClick(contact)}
                                    >
                                        <div className={`avatar ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                                            {contact.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="contact-info">
                                            <div className="contact-name-row">
                                                <span className="contact-name">{contact.username}</span>
                                                {/* UNREAD BADGE */}
                                                {unreadCounts[contact.id] > 0 && (
                                                    <span className="unread-badge">{unreadCounts[contact.id]}</span>
                                                )}
                                            </div>
                                            <span className={`contact-status ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                                                {isUserOnline(contact.id) ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
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
                                {contacts.length === 0 && <p className="no-contacts">No other users yet.</p>}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="chat-area">
                            {!selectedUser ? (
                                <div className="chat-placeholder">
                                    <div className="placeholder-icon">💬</div>
                                    <h2>Select a contact</h2>
                                    <p>Choose someone from the left to start chatting or calling</p>
                                </div>
                            ) : (
                                <>
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
                                        {isUserOnline(selectedUser.id) && (
                                            <div className="chat-header-call-buttons">
                                                <button className="call-icon-btn audio-call" onClick={() => initiateCall(selectedUser, 'audio')} title="Audio Call">📞</button>
                                                <button className="call-icon-btn video-call" onClick={() => initiateCall(selectedUser, 'video')} title="Video Call">📹</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="messages-list">
                                        {chatMessages.map((msg, index) => {
                                            const isMine = (msg.sender_id === user.id) || (msg.senderId === user.id);
                                            const fileUrl = msg.file_url || msg.fileUrl;
                                            return (
                                                <div key={msg.id || index} className={`message ${isMine ? 'mine' : 'theirs'}`}>
                                                    <div className={`message-bubble ${fileUrl ? 'has-file' : ''}`}>
                                                        {/* File attachment */}
                                                        {renderFileAttachment(msg)}
                                                        {/* Text content (caption or message) */}
                                                        {msg.message && (
                                                            <span className="message-text">{msg.message}</span>
                                                        )}
                                                        <span className="message-time">{formatTime(msg.created_at || msg.createdAt)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {isSelectedUserTyping && (
                                            <div className="message theirs">
                                                <div className="message-bubble typing-bubble">
                                                    <span className="typing-indicator"><span></span><span></span><span></span></span>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* File preview bar (shown when a file is selected) */}
                                    {selectedFile && (
                                        <div className="file-preview-bar">
                                            <div className="file-preview-content">
                                                {filePreview ? (
                                                    <img src={filePreview} alt="preview" className="file-preview-img" />
                                                ) : (
                                                    <span className="file-preview-icon">📎</span>
                                                )}
                                                <div className="file-preview-info">
                                                    <span className="file-preview-name">{selectedFile.name}</span>
                                                    <span className="file-preview-size">
                                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            </div>
                                            <button className="file-preview-remove" onClick={handleRemoveFile} title="Remove file">✕</button>
                                        </div>
                                    )}

                                    <div className="message-input-area">
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                        />
                                        {/* Attach file button */}
                                        <button
                                            className="attach-btn"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Attach file"
                                            disabled={isUploading}
                                        >
                                            📎
                                        </button>
                                        <input
                                            type="text"
                                            className="message-input"
                                            placeholder={selectedFile ? 'Add a caption...' : `Message ${selectedUser.username}...`}
                                            value={inputText}
                                            onChange={handleInputChange}
                                            onKeyPress={handleKeyPress}
                                            disabled={isUploading}
                                        />
                                        <button
                                            className="send-btn"
                                            onClick={handleSend}
                                            disabled={(!inputText.trim() && !selectedFile) || isUploading}
                                        >
                                            {isUploading ? 'Sending...' : 'Send'}
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

export default Chat;
