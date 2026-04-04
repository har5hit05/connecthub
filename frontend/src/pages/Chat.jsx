// Chat.jsx
// Responsibility: thin orchestrator that:
// - Loads contacts and chat history
// - Manages pagination state (cursor-based)
// - Tracks unread message counts
// - Handles scroll-to-bottom and scroll restoration after load-more
// - Wires together ContactList, ChatHeader, MessageList, MessageInput,
//   IncomingCall, and VideoCall

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

import IncomingCall  from '../components/IncomingCall';
import VideoCall     from '../components/VideoCall';
import ContactList   from '../components/ContactList';
import ChatHeader    from '../components/ChatHeader';
import MessageList   from '../components/MessageList';
import MessageInput  from '../components/MessageInput';

function Chat() {
    const { user, logout } = useAuth();
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
        callQuality,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        isSharing,
        shareScreen,
        stopSharing
    } = useSocket();

    // ── Contacts & unread ──
    const [contacts, setLocalContacts] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});   // { userId: count }

    // ── Pagination ──
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [nextCursor, setNextCursor]           = useState(null);
    const [isLoadingMore, setIsLoadingMore]     = useState(false);

    // ── Refs ──
    const prevMessagesLengthRef    = useRef(0);     // baseline for detecting real-time arrivals
    const previousSelectedUserRef  = useRef(null);  // tracks last selected user to avoid re-fetching
    const messagesEndRef           = useRef(null);  // scroll anchor at bottom of list
    const messagesListRef          = useRef(null);  // the scrollable container
    const scrollHeightBeforeLoadRef = useRef(0);    // saved height before prepending older messages
    const loadingMoreRef           = useRef(false); // sync flag: suppress bottom-scroll after prepend

    // ─── LOAD CONTACTS ───
    useEffect(() => {
        const controller = new AbortController();
        const fetchUsers = async () => {
            try {
                const response = await axios.get(`${API_URL}/chat/users`, { signal: controller.signal });
                setLocalContacts(response.data.users);
                setContacts(response.data.users);
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Failed to fetch contacts:', error);
                }
            }
        };
        fetchUsers();
        return () => controller.abort();
    }, [user, setContacts]);

    // ─── LOAD CHAT HISTORY (cursor-based pagination) ───
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedUser) {
                setMessages([]);
                setHasMoreMessages(false);
                setNextCursor(null);
                return;
            }

            // Skip re-fetch if the same user is still selected
            if (previousSelectedUserRef.current?.id === selectedUser.id) return;

            // Reset pagination before fetching fresh history
            setHasMoreMessages(false);
            setNextCursor(null);

            try {
                const response = await axios.get(
                    `${API_URL}/chat/history/${selectedUser.id}?limit=50`
                );
                const { messages: fetched, hasMore, nextCursor: cursor } = response.data;

                prevMessagesLengthRef.current = fetched.length;
                setMessages(fetched);
                setHasMoreMessages(hasMore);
                setNextCursor(cursor);
                setUnreadCounts(prev => ({ ...prev, [selectedUser.id]: 0 }));
                previousSelectedUserRef.current = selectedUser;
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        };

        fetchHistory();
    }, [selectedUser, user, setMessages]);

    // ─── LOAD OLDER MESSAGES ───
    const loadMoreMessages = async () => {
        if (!selectedUser || !nextCursor || isLoadingMore || !hasMoreMessages) return;

        setIsLoadingMore(true);
        loadingMoreRef.current = true;

        // Save scroll height BEFORE prepending — used to restore position afterwards
        if (messagesListRef.current) {
            scrollHeightBeforeLoadRef.current = messagesListRef.current.scrollHeight;
        }

        try {
            const response = await axios.get(
                `${API_URL}/chat/history/${selectedUser.id}?limit=50&before=${nextCursor}`
            );
            const { messages: older, hasMore, nextCursor: newCursor } = response.data;

            setMessages(prev => [...older, ...prev]);
            setHasMoreMessages(hasMore);
            setNextCursor(newCursor);
        } catch (error) {
            console.error('Failed to load older messages:', error);
            loadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    };

    // ─── UNREAD MESSAGE COUNTER ───
    useEffect(() => {
        if (messages.length === 0) {
            prevMessagesLengthRef.current = 0;
            return;
        }

        // Only a +1 growth means a real-time arrival (not a history load or load-more)
        if (messages.length === prevMessagesLengthRef.current + 1) {
            const lastMsg  = messages[messages.length - 1];
            const senderId = lastMsg.sender_id ?? lastMsg.senderId;

            if (senderId !== user.id && senderId !== selectedUser?.id) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [senderId]: (prev[senderId] || 0) + 1
                }));
            }
        }

        prevMessagesLengthRef.current = messages.length;
    }, [messages, user.id, selectedUser]);

    // ─── AUTO-SCROLL / SCROLL RESTORATION ───
    useEffect(() => {
        if (loadingMoreRef.current && messagesListRef.current) {
            // Restore scroll to where the user was before older messages were prepended
            messagesListRef.current.scrollTop =
                messagesListRef.current.scrollHeight - scrollHeightBeforeLoadRef.current;
            loadingMoreRef.current = false;
            setIsLoadingMore(false);
            return;
        }
        // Default: scroll to the latest message
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // ─── CONTACT CLICK ───
    const handleUserClick = (contact) => {
        if (selectedUser?.id === contact.id) {
            // Same contact clicked → deselect
            selectUser(null);
            setMessages([]);
            setHasMoreMessages(false);
            setNextCursor(null);
            previousSelectedUserRef.current = null;
        } else {
            selectUser(contact);
        }
    };

    // ─── DERIVED VALUES ───
    const isUserOnline = (userId) => onlineUsers.includes(userId);

    // Filter global messages to only this conversation
    const chatMessages = selectedUser
        ? messages.filter(
            (msg) =>
                (msg.sender_id === user.id && msg.receiver_id === selectedUser.id) ||
                (msg.sender_id === selectedUser.id && msg.receiver_id === user.id) ||
                (msg.senderId === user.id && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === user.id)
        )
        : [];

    const isSelectedUserTyping = selectedUser && typingUsers[selectedUser.id];

    const incomingCaller = incomingCall
        ? {
            id: incomingCall.callerId,
            username: contacts.find(c => c.id === incomingCall.callerId)?.username || 'Someone'
          }
        : null;

    return (
        <div className="home-container">

            {/* ── Incoming Call Overlay ── */}
            {incomingCall && (
                <IncomingCall
                    caller={incomingCaller}
                    callType={incomingCall.callType}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                />
            )}

            {/* ── Active Video/Audio Call ── */}
            {activeCall && (callStatus === 'connected' || activeCall.callType) && remoteStream && (
                <VideoCall
                    localStream={localStream}
                    remoteStream={remoteStream}
                    otherUser={activeCall}
                    callType={activeCall.callType}
                    onEndCall={endCall}
                    isSharing={isSharing}
                    onShareScreen={shareScreen}
                    onStopSharing={stopSharing}
                    callQuality={callQuality}
                />
            )}

            {/* ── Calling... screen ── */}
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

            {/* ── Call Rejected ── */}
            {activeCall && callStatus === 'rejected' && (
                <div className="calling-overlay">
                    <div className="calling-box">
                        <div className="calling-avatar" style={{ backgroundColor: '#ff4d4f' }}>
                            ✖
                        </div>
                        <h2>Call Rejected</h2>
                        <p>{activeCall?.username} declined the call.</p>
                    </div>
                </div>
            )}

            {/* ── Call Failed ── */}
            {activeCall && callStatus === 'failed' && (
                <div className="calling-overlay">
                    <div className="calling-box">
                        <div className="calling-avatar" style={{ backgroundColor: '#ff4d4f' }}>
                            !
                        </div>
                        <h2>Call Failed</h2>
                        <p>{activeCall?.username} is offline or unavailable.</p>
                    </div>
                </div>
            )}

            {/* ── Normal Chat Layout ── */}
            {!activeCall && (
                <>
                    {/* Navigation header */}
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

                        {/* Sidebar — contact list */}
                        <ContactList
                            contacts={contacts}
                            selectedUser={selectedUser}
                            onlineUsers={onlineUsers}
                            unreadCounts={unreadCounts}
                            onUserClick={handleUserClick}
                            onInitiateCall={initiateCall}
                        />

                        {/* Main chat area */}
                        <div className="chat-area">
                            {!selectedUser ? (
                                <div className="chat-placeholder">
                                    <div className="placeholder-icon">💬</div>
                                    <h2>Select a contact</h2>
                                    <p>Choose someone from the left to start chatting or calling</p>
                                </div>
                            ) : (
                                <>
                                    {/* Top bar with username and call buttons */}
                                    <ChatHeader
                                        selectedUser={selectedUser}
                                        isOnline={isUserOnline(selectedUser.id)}
                                        onInitiateCall={initiateCall}
                                    />

                                    {/* Scrollable message list */}
                                    <MessageList
                                        messages={chatMessages}
                                        currentUserId={user.id}
                                        isTyping={isSelectedUserTyping}
                                        hasMoreMessages={hasMoreMessages}
                                        isLoadingMore={isLoadingMore}
                                        onLoadMore={loadMoreMessages}
                                        messagesEndRef={messagesEndRef}
                                        messagesListRef={messagesListRef}
                                    />

                                    {/* Text input + file attach + send */}
                                    <MessageInput
                                        selectedUser={selectedUser}
                                        sendMessage={sendMessage}
                                        startTyping={startTyping}
                                        stopTyping={stopTyping}
                                    />
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
