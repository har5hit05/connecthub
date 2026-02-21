# ConnectHub - Complete Project Documentation
## Real-time Communication Platform

**Author:** Your Name  
**Technology Stack:** MERN + WebRTC + Socket.io  
**Purpose:** Full-stack real-time chat and video calling application

---

# Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Database Design](#database-design)
4. [Authentication System](#authentication-system)
5. [Real-time Messaging](#real-time-messaging)
6. [Friend Request System](#friend-request-system)
7. [User Profile Management](#user-profile-management)
8. [Block Users Feature](#block-users-feature)
9. [File Sharing in Chat](#file-sharing-in-chat)
10. [Video & Audio Calling (WebRTC)](#video--audio-calling-webrtc)
11. [Call History Tracking](#call-history-tracking)
12. [Issues We Faced & Solutions](#issues-we-faced--solutions)
13. [Interview Questions & Answers](#interview-questions--answers)

---

# Project Overview

## What is ConnectHub?

ConnectHub is a **real-time communication platform** similar to WhatsApp Web or Slack, where users can:
- Register and login with secure authentication
- Send text messages instantly (real-time)
- Share files and images in chat
- Add friends through a friend request system
- Block unwanted users
- Make video and audio calls using WebRTC
- View call history
- Manage their profile with avatar, bio, and status

## Why We Built It This Way

**Problem:** Traditional HTTP-based chat apps require constant page refreshes to see new messages.

**Solution:** We used Socket.io for real-time, bidirectional communication. When one user sends a message, the other user sees it instantly without refreshing the page.

**Key Advantage:** WebRTC allows direct peer-to-peer video/audio calls without storing video streams on the server, making it fast and efficient.

---

# Architecture & Technology Stack

## High-Level Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │ ◄─────► │   Backend   │ ◄─────► │  Database   │
│  (React)    │         │  (Node.js)  │         │ (PostgreSQL)│
│             │         │             │         │             │
│  - Chat UI  │  HTTP   │  - REST API │  SQL    │  - Users    │
│  - WebRTC   │  Socket │  - Socket.io│         │  - Messages │
└─────────────┘         └─────────────┘         └─────────────┘
      ↑                                                
      │ WebRTC (P2P)                                   
      ↓                                                
┌─────────────┐                                        
│   Browser   │                                        
│  (React)    │                                        
└─────────────┘                                        
```

## Why This Stack?

### Frontend: React + Vite
- **React:** Component-based UI, easy to manage complex state
- **Vite:** Fast development server, hot module replacement
- **Why not Next.js?** We don't need server-side rendering for a chat app

### Backend: Node.js + Express
- **Node.js:** Event-driven, perfect for real-time applications
- **Express:** Simple routing and middleware support
- **Why Node.js?** JavaScript on both frontend and backend = easier development

### Database: PostgreSQL
- **Why PostgreSQL?** Relational data (users, friends, messages need relationships)
- **Why not MongoDB?** Friend relationships and message threads are better with SQL joins
- **Why not MySQL?** PostgreSQL has better JSON support and is more modern

### Real-time: Socket.io
- **Why Socket.io?** Abstracts WebSocket complexity, automatic reconnection, fallback to polling
- **Why not raw WebSocket?** More boilerplate code, no automatic reconnection

### Video Calls: WebRTC
- **Why WebRTC?** Direct browser-to-browser connection, no video goes through server
- **Alternative:** Twilio/Agora (costly, we wanted free solution)

---

# Database Design

## Complete Schema

```sql
users
├── id (PRIMARY KEY)
├── username (UNIQUE)
├── email (UNIQUE)
├── password (hashed with bcrypt)
├── display_name
├── bio
├── status ('Available', 'Busy', 'Away', 'Do Not Disturb')
├── avatar_url
├── is_online (BOOLEAN)
├── last_seen
└── created_at

messages
├── id (PRIMARY KEY)
├── sender_id (FOREIGN KEY → users.id)
├── receiver_id (FOREIGN KEY → users.id)
├── message (TEXT)
├── file_url (for file attachments)
├── file_name
├── file_type
├── file_size
└── created_at

calls
├── id (PRIMARY KEY)
├── caller_id (FOREIGN KEY → users.id)
├── receiver_id (FOREIGN KEY → users.id)
├── call_type ('audio' or 'video')
├── status ('completed', 'missed', 'rejected')
├── duration (in seconds)
├── started_at
├── ended_at
└── created_at

friendships
├── id (PRIMARY KEY)
├── user_id (FOREIGN KEY → users.id)
├── friend_id (FOREIGN KEY → users.id)
├── status ('pending', 'accepted', 'rejected')
└── created_at

blocked_users
├── id (PRIMARY KEY)
├── blocker_id (FOREIGN KEY → users.id)
├── blocked_id (FOREIGN KEY → users.id)
└── created_at
```

## Why This Design?

### Users Table
**Purpose:** Store user account information

**Key Fields:**
- `password`: Hashed with bcrypt (never store plain text!)
- `is_online`: Updated via Socket.io when user connects/disconnects
- `avatar_url`: Path to uploaded profile picture

### Messages Table
**Purpose:** Store chat history

**Design Decision:** One-to-one chat only
- Each message has exactly one sender and one receiver
- To show conversation: `WHERE (sender_id=A AND receiver_id=B) OR (sender_id=B AND receiver_id=A)`

**File Fields:** 
- `file_url`: Server path like `/uploads/messages/123_photo.jpg`
- `file_type`: MIME type like `image/jpeg` or `application/pdf`

### Calls Table
**Purpose:** Track call history

**Why separate from messages?** 
- Calls have different data (duration, call type)
- Easier to query "show me all my calls" vs mixing with messages

**Status values:**
- `completed`: Both users were on the call
- `missed`: Receiver didn't answer
- `rejected`: Receiver declined

### Friendships Table
**Purpose:** Manage friend connections

**Design Decision:** Two-way relationship stored as two rows
```sql
-- User A sends request to User B:
INSERT (user_id=A, friend_id=B, status='pending')

-- User B accepts:
INSERT (user_id=B, friend_id=A, status='accepted')
UPDATE WHERE user_id=A AND friend_id=B SET status='accepted'
```

**Why two rows?** Easier queries:
- "Show my friends" = `SELECT * FROM friendships WHERE user_id=me AND status='accepted'`
- "Show pending requests" = `SELECT * FROM friendships WHERE friend_id=me AND status='pending'`

### Blocked Users Table
**Purpose:** Prevent communication from unwanted users

**One-way blocking:** Only blocker_id → blocked_id
- User A blocks User B
- User B doesn't know they're blocked
- Queries check: "Is either person blocking the other?"

---

# Authentication System

## How It Works (Simple Explanation)

**Registration Flow:**
1. User enters username, email, password
2. Frontend sends to `/api/auth/register`
3. Backend checks if username/email already exists
4. Backend hashes password using bcrypt
5. Backend saves user to database
6. Backend creates JWT token
7. Backend sends token back to frontend
8. Frontend saves token in localStorage
9. User is logged in!

**Login Flow:**
1. User enters username and password
2. Frontend sends to `/api/auth/login`
3. Backend finds user by username
4. Backend compares password with hashed password (bcrypt.compare)
5. If match: Create JWT token and send to frontend
6. If no match: Return error
7. Frontend saves token and redirects to dashboard

## What is JWT (JSON Web Token)?

**Simple Analogy:** Think of it like a cinema ticket.

When you buy a ticket (login), the cinema gives you a stamped ticket (JWT token). Every time you want to enter the hall (access protected routes), you show your ticket. The cinema staff checks the stamp (verifies JWT signature) and lets you in.

**JWT Structure:**
```
header.payload.signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTYzMjc2ODQwMH0.abc123xyz
```

**Contains:**
- `userId`: Who you are
- `iat` (issued at): When token was created
- `exp` (expiry): When token expires

**Why JWT?**
- Stateless: Server doesn't need to store "who's logged in"
- Scalable: Can have multiple backend servers
- Secure: Signature prevents tampering

## Password Security

**Why hash passwords?**

If someone hacks our database, they get:
```
username: john_doe
password: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

This is **useless** to the hacker because:
1. Hash is one-way (can't reverse to get original password)
2. Even same password produces different hash (due to salt)

**Bcrypt Process:**
```javascript
// Registration
const hashedPassword = await bcrypt.hash('user_password', 10);
// Stores: $2b$10$N9qo8uLO...

// Login
const isMatch = await bcrypt.compare('user_password', hashedPassword);
// Returns: true
```

**The number 10 (salt rounds):** 
- Higher = more secure but slower
- 10 rounds = ~10 hashing iterations = 100ms
- 12 rounds = ~60 hashing iterations = 300ms

## Protected Routes

**How we protect routes:**

Every request to protected endpoints includes:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Backend middleware (`verifyToken`) checks:
1. Does token exist?
2. Is token valid? (JWT signature check)
3. Has token expired?
4. If valid: Attach user data to request
5. If invalid: Return 401 Unauthorized

**Example:**
```javascript
// Backend
router.get('/api/profile/me', verifyToken, getMyProfile);

// verifyToken middleware
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId: 123 }
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
```

---

# Real-time Messaging

## How Socket.io Works (Simple Explanation)

**Traditional HTTP:**
```
Client: "Are there new messages?" (request)
Server: "No" (response)
[5 seconds later]
Client: "How about now?" (request)
Server: "Yes, here's a message" (response)
```

**Socket.io (WebSocket):**
```
Client: [Opens connection]
Server: [Connection open, both can send anytime]
Client: "Here's a message"
Server: [Immediately sends to other client]
Other Client: [Receives message instantly]
```

**Key Difference:** 
- HTTP = One-way (client asks, server responds)
- WebSocket = Two-way (both can send anytime)

## Complete Message Flow

### Step-by-Step: User A sends message to User B

**1. User A types message and clicks Send**
```javascript
// Frontend (Chat.jsx)
sendMessage(selectedUser.id, "Hello!");
```

**2. SocketContext sends message immediately to sender's UI**
```javascript
// Add to sender's chat immediately (optimistic update)
const newMessage = {
    id: Date.now(),
    senderId: user.id,
    receiverId: selectedUser.id,
    message: "Hello!",
    createdAt: new Date().toISOString()
};
setMessages([...messages, newMessage]);
```

**Why add immediately?** Better UX - user sees their message right away instead of waiting for server confirmation.

**3. Emit message to backend via Socket.io**
```javascript
socketRef.current.emit('send_message', {
    senderId: user.id,
    receiverId: selectedUser.id,
    message: "Hello!"
});
```

**4. Backend receives message**
```javascript
// socketHandler.js
socket.on('send_message', async (data) => {
    // Check if users have blocked each other
    const blockCheck = await db.query(`
        SELECT * FROM blocked_users 
        WHERE (blocker_id = $1 AND blocked_id = $2) 
        OR (blocker_id = $2 AND blocked_id = $1)
    `, [senderId, receiverId]);
    
    if (blockCheck.rows.length > 0) {
        // Someone is blocked - don't send message
        return socket.emit('message_blocked', { message: 'Cannot send' });
    }
    
    // Save to database
    const result = await db.query(`
        INSERT INTO messages (sender_id, receiver_id, message) 
        VALUES ($1, $2, $3) RETURNING *
    `, [senderId, receiverId, message]);
    
    const savedMessage = result.rows[0];
});
```

**5. Backend finds receiver's socket connection**
```javascript
// onlineUsers Map stores: userId → socketId
// Example: { 1: 'abc123', 2: 'xyz789' }

const receiverSocketId = onlineUsers.get(receiverId);
// Returns: 'xyz789'
```

**What is a socket ID?** 
When a user connects via Socket.io, they get a unique ID like `'xyz789'`. This is like a phone number - we use it to send messages to that specific user.

**6. Backend emits message to receiver**
```javascript
if (receiverSocketId) {
    io.to(receiverSocketId).emit('receive_message', {
        id: savedMessage.id,
        senderId: savedMessage.sender_id,
        receiverId: savedMessage.receiver_id,
        message: savedMessage.message,
        createdAt: savedMessage.created_at
    });
}
```

**`io.to(socketId)`** means "send to this specific socket connection only"

**7. User B's frontend receives message**
```javascript
// SocketContext.jsx
socketRef.current.on('receive_message', (data) => {
    setMessages(prev => [...prev, data]);
});
```

**8. User B sees message appear in chat**

## Online/Offline Status

### How we track who's online:

**User connects (logs in):**
```javascript
// Frontend
socketRef.current.emit('authenticate', { userId: user.id });

// Backend
socket.on('authenticate', async (data) => {
    const { userId } = data;
    
    // Store in Map
    onlineUsers.set(userId, socket.id);
    // Now: { 1: 'abc123', 2: 'xyz789' }
    
    // Update database
    await db.query('UPDATE users SET is_online = TRUE WHERE id = $1', [userId]);
    
    // Tell this user who's online
    const onlineUserIds = Array.from(onlineUsers.keys());
    socket.emit('online_users_list', { users: [1, 2] });
    
    // Tell others this user came online
    socket.broadcast.emit('user_online', { userId });
});
```

**Why `broadcast`?** 
- `io.emit()` = Send to everyone (including sender)
- `socket.broadcast.emit()` = Send to everyone EXCEPT sender
- `io.to(socketId).emit()` = Send to specific user only

**User disconnects (closes browser):**
```javascript
socket.on('disconnect', async () => {
    // Find which user disconnected
    let disconnectedUserId = null;
    for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
            disconnectedUserId = userId;
            onlineUsers.delete(userId);
            break;
        }
    }
    
    // Update database
    await db.query(`
        UPDATE users 
        SET is_online = FALSE, last_seen = NOW() 
        WHERE id = $1
    `, [disconnectedUserId]);
    
    // Notify others
    io.emit('user_offline', { userId: disconnectedUserId });
});
```

## Typing Indicators

**How "User is typing..." works:**

**User A starts typing:**
```javascript
// Frontend (Chat.jsx)
<input 
    onChange={(e) => {
        setInputText(e.target.value);
        startTyping(selectedUser.id); // Notify backend
        
        // Auto-stop after 2 seconds
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            stopTyping(selectedUser.id);
        }, 2000);
    }}
/>
```

**Backend forwards to User B:**
```javascript
socket.on('typing_start', (data) => {
    const { senderId, receiverId } = data;
    const receiverSocket = onlineUsers.get(receiverId);
    
    if (receiverSocket) {
        io.to(receiverSocket).emit('user_typing', { userId: senderId });
    }
});
```

**User B's UI shows typing indicator:**
```javascript
// Frontend
socketRef.current.on('user_typing', (data) => {
    setTypingUsers(prev => ({ ...prev, [data.userId]: true }));
    // typingUsers = { 1: true }
});

// In render:
{typingUsers[selectedUser.id] && (
    <div>User is typing...</div>
)}
```

## Chat History Loading

**When User A opens chat with User B:**

```javascript
// Frontend
useEffect(() => {
    const fetchHistory = async () => {
        const response = await axios.get(
            `/api/chat/history/${selectedUser.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(response.data.messages);
    };
    fetchHistory();
}, [selectedUser]);
```

**Backend query:**
```javascript
// chatController.js
const getChatHistory = async (req, res) => {
    const userId = req.user.id; // From JWT token
    const otherUserId = req.params.userId;
    
    const messages = await db.query(`
        SELECT * FROM messages
        WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY created_at ASC
        LIMIT 50
    `, [userId, otherUserId]);
    
    res.json({ messages: messages.rows });
};
```

**Why ORDER BY created_at ASC?** 
We want oldest messages first, newest at bottom (like WhatsApp).

**Why LIMIT 50?**
Performance - don't load thousands of messages at once. Can add "Load More" button for older messages.

---

# Friend Request System

## How Friend Requests Work

Think of it like Facebook friend requests:
1. User A sends request to User B
2. User B sees "pending request" notification
3. User B can Accept or Reject
4. If accepted: Both become friends
5. If rejected: Request disappears

## Database Design for Friendships

**Two-row approach:**

When User A sends request to User B, we create ONE row:
```sql
INSERT INTO friendships (user_id, friend_id, status) 
VALUES (1, 2, 'pending');
-- User 1 → User 2, status: pending
```

When User B accepts, we:
1. Update the first row
2. Create reverse row

```sql
UPDATE friendships 
SET status = 'accepted' 
WHERE user_id = 1 AND friend_id = 2;

INSERT INTO friendships (user_id, friend_id, status) 
VALUES (2, 1, 'accepted');
-- User 2 → User 1, status: accepted
```

**Result:** Two rows representing mutual friendship
```
user_id | friend_id | status
--------|-----------|----------
1       | 2         | accepted
2       | 1         | accepted
```

**Why this approach?**

Makes queries simple:
```sql
-- Get all MY friends
SELECT u.* FROM users u
JOIN friendships f ON f.friend_id = u.id
WHERE f.user_id = 1 AND f.status = 'accepted';

-- Get pending requests TO ME
SELECT u.* FROM users u
JOIN friendships f ON f.user_id = u.id
WHERE f.friend_id = 1 AND f.status = 'pending';

-- Get requests I SENT
SELECT u.* FROM users u
JOIN friendships f ON f.friend_id = u.id
WHERE f.user_id = 1 AND f.status = 'pending';
```

## Complete Friend Request Flow

### 1. Search for Users

**Frontend:**
```javascript
// Friends.jsx
const searchUsers = async (query) => {
    const response = await axios.get(
        `/api/friends/search?query=${query}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    setSearchResults(response.data.users);
};
```

**Backend:**
```javascript
// friendController.js
const searchUsers = async (req, res) => {
    const { query } = req.query;
    const currentUserId = req.user.id;
    
    const users = await db.query(`
        SELECT id, username, email, avatar_url 
        FROM users 
        WHERE (username ILIKE $1 OR email ILIKE $1)
        AND id != $2
        AND id NOT IN (
            -- Exclude users I already have a friendship with
            SELECT friend_id FROM friendships 
            WHERE user_id = $2
        )
        AND id NOT IN (
            -- Exclude users who blocked me
            SELECT blocker_id FROM blocked_users 
            WHERE blocked_id = $2
        )
        AND id NOT IN (
            -- Exclude users I blocked
            SELECT blocked_id FROM blocked_users 
            WHERE blocker_id = $2
        )
        LIMIT 20
    `, [`%${query}%`, currentUserId]);
    
    res.json({ users: users.rows });
};
```

**Why ILIKE?** Case-insensitive search (LIKE is case-sensitive in PostgreSQL)

**Why exclude blocked users?** Privacy - you shouldn't be able to find people you blocked or who blocked you.

### 2. Send Friend Request

**Frontend:**
```javascript
const sendRequest = async (userId) => {
    await axios.post(
        `/api/friends/request`,
        { receiverId: userId },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    alert('Friend request sent!');
};
```

**Backend:**
```javascript
const sendFriendRequest = async (req, res) => {
    const senderId = req.user.id;
    const { receiverId } = req.body;
    
    // Validation
    if (senderId === receiverId) {
        return res.status(400).json({ message: 'Cannot add yourself' });
    }
    
    // Check if already friends
    const existing = await db.query(`
        SELECT * FROM friendships 
        WHERE user_id = $1 AND friend_id = $2
    `, [senderId, receiverId]);
    
    if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Request already exists' });
    }
    
    // Create friend request
    await db.query(`
        INSERT INTO friendships (user_id, friend_id, status) 
        VALUES ($1, $2, 'pending')
    `, [senderId, receiverId]);
    
    res.json({ message: 'Request sent' });
};
```

### 3. View Pending Requests

**User B's dashboard shows:**
```javascript
// Frontend
const fetchPendingRequests = async () => {
    const response = await axios.get('/api/friends/pending', {
        headers: { Authorization: `Bearer ${token}` }
    });
    setPendingRequests(response.data.requests);
};

// Backend
const getPendingRequests = async (req, res) => {
    const userId = req.user.id;
    
    const requests = await db.query(`
        SELECT 
            f.id as friendship_id,
            u.id, u.username, u.avatar_url,
            f.created_at
        FROM friendships f
        JOIN users u ON u.id = f.user_id
        WHERE f.friend_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC
    `, [userId]);
    
    res.json({ requests: requests.rows });
};
```

### 4. Accept Friend Request

**Frontend:**
```javascript
const acceptRequest = async (friendshipId) => {
    await axios.put(`/api/friends/accept/${friendshipId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
    // Refresh pending requests
    fetchPendingRequests();
    // Refresh friends list
    fetchFriends();
};
```

**Backend:**
```javascript
const acceptFriendRequest = async (req, res) => {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    // Get the request
    const request = await db.query(`
        SELECT * FROM friendships 
        WHERE id = $1 AND friend_id = $2 AND status = 'pending'
    `, [requestId, userId]);
    
    if (request.rows.length === 0) {
        return res.status(404).json({ message: 'Request not found' });
    }
    
    const senderId = request.rows[0].user_id;
    
    // Update existing row to accepted
    await db.query(`
        UPDATE friendships 
        SET status = 'accepted' 
        WHERE id = $1
    `, [requestId]);
    
    // Create reverse friendship
    await db.query(`
        INSERT INTO friendships (user_id, friend_id, status) 
        VALUES ($1, $2, 'accepted')
    `, [userId, senderId]);
    
    res.json({ message: 'Friend request accepted' });
};
```

### 5. Reject Friend Request

**Simple - just delete the row:**
```javascript
const rejectFriendRequest = async (req, res) => {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    await db.query(`
        DELETE FROM friendships 
        WHERE id = $1 AND friend_id = $2 AND status = 'pending'
    `, [requestId, userId]);
    
    res.json({ message: 'Request rejected' });
};
```

### 6. Remove Friend (Unfriend)

**Delete both rows:**
```javascript
const removeFriend = async (req, res) => {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    // Delete both directions
    await db.query(`
        DELETE FROM friendships 
        WHERE (user_id = $1 AND friend_id = $2)
           OR (user_id = $2 AND friend_id = $1)
    `, [userId, friendId]);
    
    res.json({ message: 'Friend removed' });
};
```

## Critical Bug We Fixed: Type Casting

**The Problem:**

When we check friendship status, we use LEAST/GREATEST functions:
```javascript
const status = await db.query(`
    SELECT * FROM friendships 
    WHERE user_id = LEAST($1, $2) 
    AND friend_id = GREATEST($1, $2)
`, [userId, friendId]);
```

**Error we got:**
```
operator does not exist: integer = text
```

**Why?**
URL parameters arrive as strings:
```javascript
router.get('/api/friends/status/:userId', ...)
req.params.userId // This is "2" (string), not 2 (number)
```

PostgreSQL's LEAST/GREATEST functions need integers, but we passed strings!

**Solution:**
```javascript
const userId = parseInt(req.params.userId);
const friendId = parseInt(req.user.id);

// Now they're numbers: userId = 2 (not "2")
```

**Lesson learned:** Always validate and convert URL parameters to correct types!

---

# User Profile Management

## Profile Features

Users can:
1. Upload/change avatar (profile picture)
2. Update display name
3. Change bio (about me)
4. Set status (Available, Busy, Away, Do Not Disturb)
5. View other users' profiles

## File Upload with Multer

**What is Multer?**

Multer is middleware for handling `multipart/form-data`, which is used for file uploads.

**Why special handling?**

Normal JSON data:
```javascript
{ "username": "john", "email": "john@example.com" }
```

File upload data (multipart/form-data):
```
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
Content-Type: image/jpeg

[binary image data here]
------WebKitFormBoundary7MA4YWxkTrZu0gW
```

**Regular JSON parsers can't handle binary files!**

## Multer Configuration

```javascript
// profileController.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Where to store files
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // What to name the file
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname); // .jpg
        const fileName = `${uniqueSuffix}${ext}`; // 1234567890_987654321.jpg
        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {
    // Only allow images
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Accept file
    } else {
        cb(new Error('Only images are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: fileFilter
});
```

**How it works:**

1. User selects file in browser
2. Frontend sends FormData:
```javascript
const formData = new FormData();
formData.append('avatar', selectedFile);

await axios.post('/api/profile/avatar', formData, {
    headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
    }
});
```

3. Multer receives file on backend
4. Runs through fileFilter (checks if image)
5. Saves to `/uploads/avatars/1234567890_987654321.jpg`
6. Makes file available in `req.file`:
```javascript
{
    fieldname: 'avatar',
    originalname: 'my-photo.jpg',
    mimetype: 'image/jpeg',
    size: 45234,
    filename: '1234567890_987654321.jpg',
    path: '/uploads/avatars/1234567890_987654321.jpg'
}
```

## Avatar Upload Flow

**Complete process:**

**1. Frontend - User selects image**
```javascript
// Profile.jsx
const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
        setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    setSelectedAvatar(file);
};
```

**2. Frontend - Upload to server**
```javascript
const handleAvatarUpload = async () => {
    const formData = new FormData();
    formData.append('avatar', selectedAvatar);
    
    const response = await axios.post('/api/profile/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });
    
    // Update user context
    setUser({ ...user, avatar_url: response.data.avatar_url });
};
```

**3. Backend - Receive and save**
```javascript
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar);

const uploadAvatar = async (req, res) => {
    const userId = req.user.id;
    const file = req.file; // Multer adds this
    
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Get user's old avatar
    const user = await db.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
    const oldAvatar = user.rows[0].avatar_url;
    
    // Delete old avatar file (if exists)
    if (oldAvatar) {
        const oldPath = path.join(__dirname, '..', oldAvatar);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath); // Delete file
        }
    }
    
    // Save new avatar URL to database
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await db.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2',
        [avatarUrl, userId]
    );
    
    res.json({ 
        message: 'Avatar uploaded',
        avatar_url: avatarUrl 
    });
};
```

**4. Serve uploaded files**

In `server.js`:
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

Now files are accessible at:
```
http://localhost:5000/uploads/avatars/1234567890_987654321.jpg
```

## Profile Update

**Update display name, bio, status:**

```javascript
// Frontend
const updateProfile = async () => {
    await axios.put('/api/profile/me', {
        display_name: displayName,
        bio: bio,
        status: status
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
};

// Backend
const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { display_name, bio, status } = req.body;
    
    // Validate status
    const validStatuses = ['Available', 'Busy', 'Away', 'Do Not Disturb'];
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    
    await db.query(`
        UPDATE users 
        SET display_name = $1, bio = $2, status = $3 
        WHERE id = $4
    `, [display_name, bio, status, userId]);
    
    res.json({ message: 'Profile updated' });
};
```

## View Other User's Profile

**Frontend route:**
```javascript
// App.jsx
<Route path="/profile/:userId" element={<Profile />} />

// Profile.jsx
const { userId } = useParams();
const isOwnProfile = !userId || userId === user.id.toString();

if (isOwnProfile) {
    // Show edit controls
} else {
    // Show view-only profile
    fetchUserProfile(userId);
}
```

**Backend:**
```javascript
const getUserProfile = async (req, res) => {
    const { userId } = req.params;
    
    const user = await db.query(`
        SELECT 
            id, username, email, display_name, 
            bio, status, avatar_url, created_at
        FROM users 
        WHERE id = $1
    `, [userId]);
    
    if (user.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }
    
    // Don't send password or sensitive data!
    res.json({ user: user.rows[0] });
};
```

---

# Block Users Feature

## Why Blocking is Important

**Privacy & Safety:**
- Users can prevent harassment
- Blocked users can't see you're online
- Can't send messages or call you
- Don't appear in search results

## How Blocking Works (One-Way)

**Design Decision:** Blocking is one-way and invisible

User A blocks User B:
- User A: Can't see User B anywhere
- User B: Doesn't know they're blocked (appears like User A is offline)

**Why one-way?**
Mutual blocking is unnecessary - if A blocks B, A already doesn't want contact.

**Why invisible?**
If User B knew they were blocked, they could create new account to circumvent block.

## Block User Flow

**1. Block a user**
```javascript
// Frontend
const handleBlock = async (userId) => {
    if (!confirm('Are you sure you want to block this user?')) return;
    
    await axios.post('/api/block/block', 
        { blockedId: userId },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    
    alert('User blocked');
    // Refresh friends list (blocked user disappears)
    fetchFriends();
};

// Backend
const blockUser = async (req, res) => {
    const blockerId = req.user.id;
    const { blockedId } = req.body;
    
    // Can't block yourself
    if (blockerId === blockedId) {
        return res.status(400).json({ message: 'Cannot block yourself' });
    }
    
    // Add to blocked_users table
    await db.query(`
        INSERT INTO blocked_users (blocker_id, blocked_id) 
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `, [blockerId, blockedId]);
    
    // Remove friendship (if exists)
    await db.query(`
        DELETE FROM friendships 
        WHERE (user_id = $1 AND friend_id = $2)
           OR (user_id = $2 AND friend_id = $1)
    `, [blockerId, blockedId]);
    
    // Delete any pending friend requests (both directions)
    // (same DELETE query)
    
    res.json({ message: 'User blocked' });
};
```

**Why ON CONFLICT DO NOTHING?**
Prevents error if user tries to block same person twice.

**2. Check if blocked before actions**

**Before sending message:**
```javascript
socket.on('send_message', async (data) => {
    // Check if blocked
    const blockCheck = await db.query(`
        SELECT * FROM blocked_users 
        WHERE (blocker_id = $1 AND blocked_id = $2) 
           OR (blocker_id = $2 AND blocked_id = $1)
    `, [senderId, receiverId]);
    
    if (blockCheck.rows.length > 0) {
        return socket.emit('message_blocked', { 
            message: 'Cannot send message to this user' 
        });
    }
    
    // Continue with sending message...
});
```

**Before initiating call:**
```javascript
socket.on('call_request', async (data) => {
    // Same block check
    const blockCheck = await db.query(...);
    
    if (blockCheck.rows.length > 0) {
        return socket.emit('call_blocked', { 
            message: 'Cannot call this user' 
        });
    }
    
    // Continue with call...
});
```

**In user search:**
```javascript
const searchUsers = async (req, res) => {
    const users = await db.query(`
        SELECT * FROM users 
        WHERE username ILIKE $1
        AND id NOT IN (
            SELECT blocked_id FROM blocked_users WHERE blocker_id = $2
        )
        AND id NOT IN (
            SELECT blocker_id FROM blocked_users WHERE blocked_id = $2
        )
    `, [query, currentUserId]);
    
    // Users who blocked me OR who I blocked won't appear
};
```

**3. View blocked users list**
```javascript
// Frontend - Separate page at /blocked
const BlockedUsers = () => {
    const [blockedUsers, setBlockedUsers] = useState([]);
    
    useEffect(() => {
        const fetchBlocked = async () => {
            const response = await axios.get('/api/block/list', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedUsers(response.data.blockedUsers);
        };
        fetchBlocked();
    }, []);
    
    return (
        <div>
            <h2>Blocked Users</h2>
            {blockedUsers.map(user => (
                <div key={user.id}>
                    {user.username}
                    <button onClick={() => handleUnblock(user.id)}>
                        Unblock
                    </button>
                </div>
            ))}
        </div>
    );
};

// Backend
const getBlockedUsers = async (req, res) => {
    const userId = req.user.id;
    
    const blocked = await db.query(`
        SELECT 
            u.id, u.username, u.avatar_url,
            b.created_at as blocked_at
        FROM blocked_users b
        JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC
    `, [userId]);
    
    res.json({ blockedUsers: blocked.rows });
};
```

**4. Unblock user**
```javascript
// Frontend
const handleUnblock = async (userId) => {
    await axios.delete(`/api/block/unblock/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    // Refresh blocked list
    fetchBlocked();
};

// Backend
const unblockUser = async (req, res) => {
    const blockerId = req.user.id;
    const { blockedId } = req.params;
    
    await db.query(`
        DELETE FROM blocked_users 
        WHERE blocker_id = $1 AND blocked_id = $2
    `, [blockerId, blockedId]);
    
    res.json({ message: 'User unblocked' });
};
```

## Block Check in getAllUsers

**Critical:** When showing contact list, hide blocked users

```javascript
const getAllUsers = async (req, res) => {
    const userId = req.user.id;
    
    const users = await db.query(`
        SELECT id, username, email, avatar_url, is_online 
        FROM users 
        WHERE id != $1
        AND NOT EXISTS (
            -- Exclude users I blocked
            SELECT 1 FROM blocked_users 
            WHERE blocker_id = $1 AND blocked_id = users.id
        )
        AND NOT EXISTS (
            -- Exclude users who blocked me
            SELECT 1 FROM blocked_users 
            WHERE blocker_id = users.id AND blocked_id = $1
        )
        ORDER BY username
    `, [userId]);
    
    res.json({ users: users.rows });
};
```

**Why NOT EXISTS instead of NOT IN?**

`NOT EXISTS` is more efficient for PostgreSQL when checking related tables.

---

# File Sharing in Chat

## Supported File Types

**Images:**
- JPEG, PNG, GIF, WebP, SVG

**Documents:**
- PDF, Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx)

**Text:**
- TXT, CSV

**Archives:**
- ZIP, RAR

**Why limit file types?**
- Security: Prevent executable files (.exe, .sh)
- Storage: Large video files would fill up server
- User experience: Keep it relevant to chat

## File Upload in Messages

### Database Schema

```sql
ALTER TABLE messages ADD COLUMN file_url VARCHAR(500);
ALTER TABLE messages ADD COLUMN file_name VARCHAR(255);
ALTER TABLE messages ADD COLUMN file_type VARCHAR(50);
ALTER TABLE messages ADD COLUMN file_size INTEGER;
```

**Why separate columns?**
- `file_url`: Server path for downloading
- `file_name`: Original filename (user-friendly)
- `file_type`: MIME type for icons
- `file_size`: Display "2.3 MB" to user

### Multer Configuration for Messages

```javascript
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/messages');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename to prevent conflicts
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        // Remove special characters
        const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${uniqueSuffix}_${safeName}${ext}`;
        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain', 'text/csv',
        'application/zip'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});
```

### Send Message with File

**Frontend:**
```javascript
// Chat.jsx
const [selectedFile, setSelectedFile] = useState(null);
const [filePreview, setFilePreview] = useState(null);

const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check size
    if (file.size > 10 * 1024 * 1024) {
        alert('File must be less than 10MB');
        return;
    }
    
    setSelectedFile(file);
    
    // Show preview for images
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
    }
};

const handleSendFile = async () => {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('senderId', user.id);
    formData.append('receiverId', selectedUser.id);
    formData.append('message', inputText.trim()); // Optional text with file
    
    const response = await axios.post('/api/messages/send', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });
    
    // Add to messages
    setMessages([...messages, response.data.messageData]);
    
    // Clear file
    setSelectedFile(null);
    setFilePreview(null);
    setInputText('');
};
```

**Backend:**
```javascript
router.post('/send', verifyToken, upload.single('file'), sendMessageWithFile);

const sendMessageWithFile = async (req, res) => {
    const { senderId, receiverId, message } = req.body;
    const file = req.file;
    
    // Must have either message or file
    if (!message && !file) {
        return res.status(400).json({ message: 'Message or file required' });
    }
    
    // Check if blocked
    const blockCheck = await db.query(`...`);
    if (blockCheck.rows.length > 0) {
        // Delete uploaded file
        if (file) {
            fs.unlinkSync(file.path);
        }
        return res.status(403).json({ message: 'Cannot send to this user' });
    }
    
    // Prepare file data
    let fileUrl = null, fileName = null, fileType = null, fileSize = null;
    if (file) {
        fileUrl = `/uploads/messages/${file.filename}`;
        fileName = file.originalname;
        fileType = file.mimetype;
        fileSize = file.size;
    }
    
    // Save to database
    const result = await db.query(`
        INSERT INTO messages 
        (sender_id, receiver_id, message, file_url, file_name, file_type, file_size) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
    `, [senderId, receiverId, message || '', fileUrl, fileName, fileType, fileSize]);
    
    const savedMessage = result.rows[0];
    
    // Emit to receiver via Socket.io
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const receiverSocketId = onlineUsers.get(parseInt(receiverId));
    
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', savedMessage);
    }
    
    res.status(201).json({ messageData: savedMessage });
};
```

### Display Files in Chat

**Image display (inline):**
```javascript
// Chat.jsx
{message.file_url && message.file_type.startsWith('image/') && (
    <img 
        src={`http://localhost:5000${message.file_url}`}
        alt={message.file_name}
        className="message-image"
        onClick={() => window.open(`http://localhost:5000${message.file_url}`)}
    />
)}
```

**Document display (download button):**
```javascript
{message.file_url && !message.file_type.startsWith('image/') && (
    <a 
        href={`http://localhost:5000${message.file_url}`}
        download={message.file_name}
        className="file-download"
    >
        <span className="file-icon">{getFileIcon(message.file_type)}</span>
        <div>
            <div>{message.file_name}</div>
            <div>{formatFileSize(message.file_size)}</div>
        </div>
        <span>↓</span>
    </a>
)}

// Helper functions
const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('word')) return '📘';
    if (fileType.includes('excel')) return '📗';
    if (fileType.includes('zip')) return '🗜️';
    return '📄';
};

const formatFileSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};
```

## File Security Considerations

**1. File size limit:** Prevents server storage overflow
**2. File type validation:** Prevents malicious executables
**3. Unique filenames:** Prevents overwriting other users' files
**4. Access control:** Only sender and receiver can access file

**Enhancement idea (not implemented):**
Add middleware to check if user is authorized to access file:
```javascript
app.get('/uploads/messages/:filename', verifyToken, async (req, res) => {
    const filename = req.params.filename;
    const userId = req.user.id;
    
    // Check if this message belongs to user
    const message = await db.query(`
        SELECT * FROM messages 
        WHERE file_url = $1 
        AND (sender_id = $2 OR receiver_id = $2)
    `, [`/uploads/messages/${filename}`, userId]);
    
    if (message.rows.length === 0) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Send file
    res.sendFile(path.join(__dirname, 'uploads', 'messages', filename));
});
```

---

# Video & Audio Calling (WebRTC)

## What is WebRTC?

**WebRTC = Web Real-Time Communication**

**Simple explanation:**
Traditional video calls (Zoom, Skype) work like this:
```
User A → Video → Server → Video → User B
```
Server receives, processes, and forwards video. **Expensive and slow.**

WebRTC works like this:
```
User A ←──────────→ User B
    (Direct P2P connection)
```
**Peer-to-Peer (P2P):** Video goes directly from User A to User B. **Fast and free.**

**But there's a problem:** 
How do User A and User B find each other on the internet? They need help!

**Solution:** Signaling Server (our backend)
```
User A → "I want to call User B" → Backend → "User A is calling" → User B
User B → "Here's how to reach me" → Backend → "User B can be reached" → User A
[Now they connect directly]
```

## WebRTC Components

### 1. Signaling (Our Backend)

**Purpose:** Exchange connection information

**NOT WebRTC itself** - we use Socket.io for this:
- Who wants to call whom?
- What are their network addresses?
- What media capabilities do they have?

### 2. STUN Servers

**STUN = Session Traversal Utilities for NAT**

**Problem:**
Your computer at home has a local IP: `192.168.1.5`
But on the internet, your IP is: `202.14.56.89` (router's IP)

**How does the other person know to connect to `202.14.56.89`?**

**Solution:** STUN server
```
You → "What's my public IP?" → STUN server
STUN server → "Your public IP is 202.14.56.89"
```

**We use Google's free STUN servers:**
```javascript
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};
```

### 3. RTCPeerConnection

**The main WebRTC object**

```javascript
const pc = new RTCPeerConnection(config);
```

Handles:
- Getting your video/audio stream
- Encoding/decoding video
- Managing network connection
- Sending/receiving data

### 4. MediaStream

**Your camera and microphone access:**

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
});
```

**Returns:** MediaStream object containing:
- Video track (your camera)
- Audio track (your microphone)

### 5. ICE Candidates

**ICE = Interactive Connectivity Establishment**

**Think of it as:** Different ways to reach you

```
ICE Candidate 1: 192.168.1.5:54321 (local network)
ICE Candidate 2: 202.14.56.89:54321 (public IP)
ICE Candidate 3: [relay server]:54321 (last resort)
```

Both users exchange ALL their ICE candidates and try to connect using the best one.

## Complete Call Flow (Step-by-Step)

### Phase 1: Initiating the Call

**User A clicks "Video Call" button**

**Step 1: Get media stream**
```javascript
// Frontend (SocketContext.jsx)
const initiateCall = async (receiver, callType) => {
    console.log('📞 Initiating call');
    
    // Ask browser for camera and microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
    });
    
    // Save stream locally
    setLocalStream(stream);
    
    // Show "Calling..." UI
    setActiveCall({ ...receiver, callType });
    setCallStatus('calling');
```

**What happens here?**
- Browser shows "Allow camera/microphone" popup
- If user clicks "Allow": Returns MediaStream
- If user clicks "Block": Throws error

**Step 2: Send call request**
```javascript
    // Notify User B via Socket.io
    socketRef.current.emit('call_request', {
        callerId: user.id,
        receiverId: receiver.id,
        callType: callType
    });
```

**Backend receives:**
```javascript
// socketHandler.js
socket.on('call_request', async (data) => {
    const { callerId, receiverId, callType } = data;
    
    // Find User B's socket connection
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
        // User B is online - send notification
        io.to(receiverSocketId).emit('incoming_call', {
            callerId: callerId,
            callType: callType
        });
    } else {
        // User B is offline - save as missed call
        await db.query(`
            INSERT INTO calls (caller_id, receiver_id, call_type, status) 
            VALUES ($1, $2, $3, 'missed')
        `, [callerId, receiverId, callType]);
        
        // Tell User A
        socket.emit('call_failed', { message: 'User is offline' });
    }
});
```

**Step 3: Create peer connection (User A)**
```javascript
    // Create WebRTC peer connection
    const pc = createPeerConnection(receiver.id);
    
    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind);
        pc.addTrack(track, stream);
    });
    
    // DON'T send offer yet - wait for User B to accept
};
```

### Phase 2: Receiving the Call

**User B's frontend receives incoming_call event:**

```javascript
// SocketContext.jsx
socketRef.current.on('incoming_call', (data) => {
    console.log('📞 Incoming call from:', data.callerId);
    
    // Show incoming call popup
    setIncomingCall({
        callerId: data.callerId,
        callType: data.callType
    });
});
```

**UI shows IncomingCall component:**
```jsx
<IncomingCall
    caller={callerUser}
    callType="video"
    onAccept={acceptCall}
    onReject={rejectCall}
/>
```

### Phase 3: Call Acceptance

**User B clicks "Accept"**

```javascript
const acceptCall = async () => {
    console.log('✅ Accepting call');
    const { callerId, callType } = incomingCall;
    
    // Get User B's media stream
    const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
    });
    setLocalStream(stream);
    
    // Update UI
    setActiveCall({ ...caller, callType });
    setIncomingCall(null);
    setCallStatus('connected');
    
    // Notify User A that call was accepted
    socketRef.current.emit('call_accepted', {
        callerId: callerId,
        receiverId: user.id
    });
    
    // Create peer connection
    const pc = createPeerConnection(callerId);
    
    // Add tracks
    stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
    });
    
    // Wait for offer from User A...
};
```

**Backend forwards to User A:**
```javascript
socket.on('call_accepted', (data) => {
    const { callerId, receiverId } = data;
    const callerSocketId = onlineUsers.get(callerId);
    
    if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', {
            receiverId: receiverId
        });
    }
});
```

### Phase 4: WebRTC Signaling (The Critical Part)

**User A receives call_accepted:**

```javascript
const handleCallAccepted = async (data) => {
    console.log('✅ Call accepted, sending offer');
    setCallStatus('connecting');
    
    const pc = peerConnectionRef.current;
    
    // Create SDP Offer
    const offer = await pc.createOffer();
    
    // Set as local description
    await pc.setLocalDescription(offer);
    
    // Send offer to User B
    socketRef.current.emit('webrtc_offer', {
        senderId: user.id,
        receiverId: data.receiverId,
        offer: offer
    });
};
```

**What is SDP Offer?**

SDP = Session Description Protocol

It's a text description of:
- What media formats you support (H.264 video, Opus audio)
- What resolutions you support (1920x1080, 1280x720)
- Your network information

**Example SDP (simplified):**
```
v=0
o=- 123456789 2 IN IP4 127.0.0.1
s=-
t=0 0
m=video 9 UDP/TLS/RTP/SAVPF 96
a=rtpmap:96 H264/90000
m=audio 9 UDP/TLS/RTP/SAVPF 111
a=rtpmap:111 opus/48000/2
```

**User B receives offer:**

```javascript
const handleWebRTCOffer = async (data) => {
    console.log('📨 Received offer');
    
    const pc = peerConnectionRef.current;
    
    // If peer connection doesn't exist, create it
    if (!pc) {
        const newPc = createPeerConnection(data.senderId);
        // Add local tracks
        if (localStream) {
            localStream.getTracks().forEach(track => 
                newPc.addTrack(track, localStream)
            );
        }
    }
    
    // Set remote description (User A's offer)
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    // Process any pending ICE candidates
    for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];
    
    // Create SDP Answer
    const answer = await pc.createAnswer();
    
    // Set as local description
    await pc.setLocalDescription(answer);
    
    // Send answer to User A
    socketRef.current.emit('webrtc_answer', {
        senderId: user.id,
        receiverId: data.senderId,
        answer: answer
    });
};
```

**User A receives answer:**

```javascript
const handleWebRTCAnswer = async (data) => {
    console.log('📨 Received answer');
    
    const pc = peerConnectionRef.current;
    
    // Set remote description (User B's answer)
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    
    // Process pending ICE candidates
    for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];
    
    console.log('✅ Connection established!');
};
```

### Phase 5: ICE Candidate Exchange

**While the above is happening, ICE candidates are being discovered:**

```javascript
// This fires multiple times as candidates are found
pc.onicecandidate = (event) => {
    if (event.candidate) {
        console.log('🧊 Found ICE candidate');
        
        // Send to other peer
        socketRef.current.emit('webrtc_ice_candidate', {
            senderId: user.id,
            receiverId: remotePeerId,
            candidate: event.candidate
        });
    }
};
```

**Receiving ICE candidates:**

```javascript
const handleICECandidate = async (data) => {
    const pc = peerConnectionRef.current;
    
    // If remote description isn't set yet, queue candidate
    if (!pc || !pc.remoteDescription) {
        pendingCandidates.current.push(data.candidate);
        return;
    }
    
    // Add ICE candidate
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    console.log('✅ ICE candidate added');
};
```

**Why queue candidates?**

ICE candidates can arrive BEFORE the remote description is set. We must wait for remote description before adding candidates.

### Phase 6: Media Streaming

**Once connection is established:**

```javascript
pc.ontrack = (event) => {
    console.log('📹 Received remote stream!');
    
    // This is User B's video/audio stream
    setRemoteStream(event.streams[0]);
};
```

**Displaying streams in UI:**

```jsx
// VideoCall.jsx
<video 
    ref={remoteVideoRef} 
    autoPlay 
    playsInline 
    className="remote-video" 
/>

<video 
    ref={localVideoRef} 
    autoPlay 
    playsInline 
    muted 
    className="local-video" 
/>

// Attach streams
useEffect(() => {
    if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
    }
}, [localStream]);

useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
    }
}, [remoteStream]);
```

**Why is local video muted?**
To prevent echo - you don't want to hear your own voice through speakers!

### Phase 7: Ending the Call

**Either user clicks "End Call":**

```javascript
const endCall = () => {
    console.log('📞 Ending call');
    
    // Notify other user
    if (activeCall && socketRef.current) {
        socketRef.current.emit('call_ended', {
            senderId: user.id,
            receiverId: activeCall.id
        });
    }
    
    // Clean up locally
    cleanupCall();
};

const cleanupCall = () => {
    // Stop all tracks (camera and microphone)
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Stopped:', track.kind);
        });
        setLocalStream(null);
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
    }
    
    // Reset state
    setPeerConnection(null);
    setRemoteStream(null);
    setActiveCall(null);
    setCallStatus(null);
    setIsSharing(false);
};
```

**Backend forwards to other user:**

```javascript
socket.on('call_ended', async (data) => {
    const { senderId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('call_ended', {
            senderId: senderId
        });
    }
    
    // Save call record to database
    // (with duration if it's a completed call)
});
```

## Critical Bug We Fixed: Timing Issues

**Problem:**

Original flow:
1. User A initiates call
2. User A creates peer connection
3. User A immediately creates and sends offer
4. User A sends call request
5. User B accepts (but offer already sent!)
6. User B creates peer connection
7. User B receives offer but wasn't ready

**Result:** Offer arrives before User B's peer connection exists → ERROR

**Solution:**

New flow:
1. User A initiates call
2. User A creates peer connection
3. User A sends call request (NO OFFER YET)
4. User B accepts
5. User B creates peer connection
6. User B sends "call_accepted"
7. User A receives "call_accepted"
8. NOW User A creates and sends offer
9. User B is ready to receive it

**Key change:**
```javascript
// OLD (wrong):
initiateCall() {
    createPeerConnection();
    const offer = await pc.createOffer();
    socket.emit('webrtc_offer', { offer });
    socket.emit('call_request', { ... });
}

// NEW (correct):
initiateCall() {
    createPeerConnection();
    socket.emit('call_request', { ... });
    // Wait for call_accepted event
}

handleCallAccepted() {
    const offer = await pc.createOffer();
    socket.emit('webrtc_offer', { offer });
}
```

## ICE Candidate Queuing Bug Fix

**Problem:**

ICE candidates arrive BEFORE remote description is set:
```
1. Offer received
2. ICE candidate arrives ← ERROR: No remote description yet!
3. Set remote description
```

**Solution:** Queue candidates

```javascript
const pendingCandidates = useRef([]);

const handleICECandidate = async (data) => {
    const pc = peerConnectionRef.current;
    
    // Check if remote description is set
    if (!pc || !pc.remoteDescription) {
        // Queue for later
        pendingCandidates.current.push(data.candidate);
        console.log('📦 Queued ICE candidate');
        return;
    }
    
    // Remote description exists - add immediately
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
};

const handleWebRTCOffer = async (data) => {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    // Now process queued candidates
    for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];
    
    const answer = await pc.createAnswer();
    // ... rest of logic
};
```

## Auto-Create Peer Connection on Offer

**Problem:**

Sometimes offer arrives before peer connection is created (race condition).

**Solution:**

```javascript
const handleWebRTCOffer = async (data) => {
    // Check if peer connection exists
    if (!peerConnectionRef.current) {
        console.log('🔧 Auto-creating peer connection');
        
        // Create it now
        createPeerConnection(data.senderId);
        
        // Add local tracks if stream exists
        if (localStream) {
            localStream.getTracks().forEach(track =>
                peerConnectionRef.current.addTrack(track, localStream)
            );
        }
    }
    
    // Now proceed with offer handling
    await peerConnectionRef.current.setRemoteDescription(...);
};
```

This handles edge cases where:
- Network is slow
- Events arrive out of order
- User refreshes page during call

---

# Call History Tracking

## Why Track Call History?

**User benefits:**
- See missed calls
- Review call duration
- Contact history

**System benefits:**
- Analytics (average call duration, peak times)
- Debugging (why calls failed)

## Calls Table Schema

```sql
CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    call_type VARCHAR(10) CHECK (call_type IN ('audio', 'video')),
    status VARCHAR(20) CHECK (status IN ('completed', 'missed', 'rejected')),
    duration INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Status meanings:**
- `completed`: Both users were on call, call ended normally
- `missed`: Receiver didn't answer (offline or didn't accept)
- `rejected`: Receiver explicitly declined

## When We Save Calls

### 1. Missed Call

**User offline when called:**
```javascript
socket.on('call_request', async (data) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (!receiverSocketId) {
        // User offline - save as missed
        await db.query(`
            INSERT INTO calls 
            (caller_id, receiver_id, call_type, status, created_at)
            VALUES ($1, $2, $3, 'missed', NOW())
        `, [callerId, receiverId, callType]);
    }
});
```

### 2. Rejected Call

**User explicitly rejects:**
```javascript
socket.on('call_rejected', async (data) => {
    await db.query(`
        INSERT INTO calls 
        (caller_id, receiver_id, call_type, status, created_at)
        VALUES ($1, $2, $3, 'rejected', NOW())
    `, [callerId, receiverId, callType]);
});
```

### 3. Completed Call

**When call is accepted, we track start time:**
```javascript
socket.on('call_accepted', async (data) => {
    const callKey = `${callerId}-${receiverId}`;
    activeCalls.set(callKey, {
        callerId: callerId,
        receiverId: receiverId,
        startTime: new Date(),
        callType: callType
    });
});
```

**When call ends, calculate duration:**
```javascript
socket.on('call_ended', async (data) => {
    const { senderId, receiverId } = data;
    
    // Find call record (could be either direction)
    let callKey = `${senderId}-${receiverId}`;
    let callData = activeCalls.get(callKey);
    
    if (!callData) {
        callKey = `${receiverId}-${senderId}`;
        callData = activeCalls.get(callKey);
    }
    
    if (callData) {
        // Calculate duration in seconds
        const duration = Math.round(
            (new Date() - callData.startTime) / 1000
        );
        
        // Save completed call
        await db.query(`
            INSERT INTO calls 
            (caller_id, receiver_id, call_type, status, 
             duration, started_at, ended_at, created_at)
            VALUES ($1, $2, $3, 'completed', $4, $5, NOW(), NOW())
        `, [
            callData.callerId, 
            callData.receiverId, 
            callData.callType, 
            duration, 
            callData.startTime
        ]);
        
        // Remove from active calls
        activeCalls.delete(callKey);
    }
});
```

## Viewing Call History

**Frontend:**
```javascript
// CallHistory.jsx
const [calls, setCalls] = useState([]);

useEffect(() => {
    const fetchCalls = async () => {
        const response = await axios.get('/api/calls/history', {
            headers: { Authorization: `Bearer ${token}` }
        });
        setCalls(response.data.calls);
    };
    fetchCalls();
}, []);

// Display
{calls.map(call => (
    <div key={call.id} className="call-item">
        <div className="call-avatar">
            {call.caller_id === user.id 
                ? call.receiver_username 
                : call.caller_username}
        </div>
        <div className="call-info">
            <div className="call-type">
                {call.call_type === 'video' ? '📹' : '📞'}
                {call.caller_id === user.id ? 'Outgoing' : 'Incoming'}
            </div>
            <div className="call-status">
                {call.status === 'completed' 
                    ? `${formatDuration(call.duration)}` 
                    : call.status}
            </div>
            <div className="call-time">
                {formatRelativeTime(call.created_at)}
            </div>
        </div>
    </div>
))}
```

**Backend:**
```javascript
const getCallHistory = async (req, res) => {
    const userId = req.user.id;
    
    const calls = await db.query(`
        SELECT 
            c.id,
            c.caller_id,
            c.receiver_id,
            c.call_type,
            c.status,
            c.duration,
            c.started_at,
            c.ended_at,
            c.created_at,
            caller.username as caller_username,
            caller.avatar_url as caller_avatar,
            receiver.username as receiver_username,
            receiver.avatar_url as receiver_avatar
        FROM calls c
        JOIN users caller ON caller.id = c.caller_id
        JOIN users receiver ON receiver.id = c.receiver_id
        WHERE c.caller_id = $1 OR c.receiver_id = $1
        ORDER BY c.created_at DESC
        LIMIT 50
    `, [userId]);
    
    res.json({ calls: calls.rows });
};
```

**Helper functions:**
```javascript
// Format duration in seconds to "mm:ss"
const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format relative time
const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
};
```

---

# Issues We Faced & Solutions

## 1. PostgreSQL Type Casting Error

**Problem:**
```
operator does not exist: integer = text
```

**Code that caused it:**
```javascript
const userId = req.params.userId; // "2" (string)
const friendId = req.user.id;     // 2 (number)

const status = await db.query(`
    SELECT * FROM friendships 
    WHERE user_id = LEAST($1, $2) 
    AND friend_id = GREATEST($1, $2)
`, [userId, friendId]);
```

**Why it failed:**
- URL params are always strings: `"2"`
- User ID from JWT is number: `2`
- PostgreSQL LEAST/GREATEST functions require same type

**Solution:**
```javascript
const userId = parseInt(req.params.userId);
const friendId = parseInt(req.user.id);
```

**Lesson learned:** Always validate and convert URL parameters!

---

## 2. Socket Disconnection During Calls

**Problem:**
Call would start, permission granted, then immediately disconnect:
```
✅ Got local stream
🔌 Disconnecting socket and cleaning up
🧹 Cleaning up call
```

**Root cause:**
```javascript
useEffect(() => {
    // Setup socket and handlers
    return () => cleanup();
}, [user, handleWebRTCOffer, handleWebRTCAnswer, ...]); // ❌ WRONG!
```

Every time handler functions changed, useEffect re-ran, causing cleanup!

**Solution:**
```javascript
useEffect(() => {
    // Define handlers INSIDE useEffect
    const handleWebRTCOffer = async (data) => { ... };
    const handleWebRTCAnswer = async (data) => { ... };
    
    // Register handlers
    socket.on('webrtc_offer', handleWebRTCOffer);
    
    return () => cleanup();
}, [user]); // ✅ Only depend on user
```

**Lesson learned:** Be careful with useEffect dependencies!

---

## 3. WebRTC Offer/Answer Timing

**Problem:** 
Offer sent before receiver was ready:
```
User A: Send call request + offer
User B: Call request received (but offer already sent!)
User B: Create peer connection
User B: Receive offer (peer connection now exists, but too late)
```

**Solution:**
Wait for call acceptance before sending offer:
```javascript
// Step 1: Send call request only
initiateCall() {
    createPeerConnection();
    socket.emit('call_request'); // NO OFFER
}

// Step 2: Wait for acceptance
handleCallAccepted() {
    const offer = await pc.createOffer();
    socket.emit('webrtc_offer', { offer }); // NOW send offer
}
```

**Lesson learned:** In distributed systems, timing and ordering matter!

---

## 4. ICE Candidates Arriving Before Remote Description

**Problem:**
```
1. ICE candidate arrives
2. Try to add: pc.addIceCandidate(...)
3. Error: Remote description not set yet
```

**Solution:** Queue candidates
```javascript
const pendingCandidates = useRef([]);

handleICECandidate(data) {
    if (!pc.remoteDescription) {
        pendingCandidates.current.push(data.candidate);
        return;
    }
    await pc.addIceCandidate(data.candidate);
}

handleWebRTCOffer(data) {
    await pc.setRemoteDescription(data.offer);
    
    // Process queued candidates
    for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(c);
    }
    pendingCandidates.current = [];
}
```

**Lesson learned:** Handle async events that can arrive out of order!

---

## 5. Profile Layout Issues

**Problem:**
Profile page content not centered, spacing inconsistent.

**Root cause:**
```css
.profile-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center; /* ❌ This stretched children */
}
```

**Solution:**
```css
.profile-card {
    max-width: 600px;
    align-items: flex-start; /* ✅ Natural width */
    padding: 40px;
}

.avatar-section {
    padding: 40px 40px 30px; /* Distinct spacing */
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.info-section {
    padding: 32px 40px 40px; /* Different spacing */
}
```

**Lesson learned:** Flexbox alignment can behave unexpectedly. Test on different screen sizes!

---

## 6. File Upload Not Working in Production (Render)

**Problem:**
Uploaded files disappear after server restart.

**Cause:**
Render's free tier has **ephemeral storage** - files are deleted on restart.

**Solutions:**
1. **Use Cloudinary** (cloud storage for images)
2. **Use AWS S3** (cloud storage for all files)
3. **Accept limitation** (document it for users)

**For now:** We accepted the limitation and documented it.

**For production:** Would use Cloudinary:
```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

// Upload
const result = await cloudinary.uploader.upload(file.path);
const avatar_url = result.secure_url;
```

---

## 7. CORS Errors in Production

**Problem:**
Frontend can't access backend in production:
```
Access to XMLHttpRequest blocked by CORS policy
```

**Cause:**
Development CORS config only allowed localhost:
```javascript
app.use(cors({
    origin: 'http://localhost:5173' // ❌ Only works locally
}));
```

**Solution:**
```javascript
const allowedOrigins = [
    'http://localhost:5173',
    'https://your-app.vercel.app', // Production frontend
    process.env.FRONTEND_URL // Environment variable
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

**Lesson learned:** Always test production environment separately!

---

# Interview Questions & Answers

## General Questions

### Q: Why did you choose MERN stack?

**Answer:**
"I chose MERN stack because:
1. **JavaScript everywhere** - Same language for frontend and backend makes development faster
2. **Real-time capabilities** - Node.js event-driven architecture is perfect for chat applications
3. **JSON** - React state, Node.js, and MongoDB all use JavaScript objects natively
4. **PostgreSQL over MongoDB** - I needed relational data (friends, messages between users). SQL joins made queries easier.
5. **Large community** - Easy to find solutions and libraries"

### Q: How does real-time messaging work?

**Answer:**
"I use Socket.io which creates a persistent WebSocket connection between client and server. Unlike HTTP where the client has to ask for updates, WebSocket allows the server to push messages instantly.

When User A sends a message:
1. Message goes to backend via socket
2. Backend saves it to database
3. Backend finds User B's socket ID
4. Backend emits message directly to User B's connection
5. User B sees it instantly

The key is maintaining a Map of userId → socketId so we know where to send messages."

### Q: Explain your WebRTC implementation

**Answer:**
"WebRTC allows peer-to-peer video calls without routing video through the server.

The flow is:
1. **Media access:** Get camera/mic using getUserMedia
2. **Signaling:** Use Socket.io to exchange SDP offers/answers and ICE candidates
3. **STUN servers:** Help discover public IP addresses behind NATs
4. **RTCPeerConnection:** Manages the actual peer-to-peer connection
5. **Direct streaming:** Video flows directly between browsers

The tricky part was timing - I had to ensure the receiver accepted the call and created their peer connection BEFORE the caller sent the WebRTC offer. Initially, offers were arriving too early and failing."

### Q: How did you handle file uploads?

**Answer:**
"I used Multer middleware for handling multipart/form-data. 

The process:
1. Frontend sends FormData with the file
2. Multer intercepts and validates (type, size)
3. Multer saves with unique filename to prevent conflicts
4. I store the file path in database along with metadata
5. Express.static serves the files

Security measures:
- File type whitelist (no executables)
- 10MB size limit
- Unique filenames prevent overwriting
- In production, I'd use Cloudinary instead of local storage"

### Q: How do you handle authentication?

**Answer:**
"I use JWT (JSON Web Tokens) for stateless authentication.

When user logs in:
1. Backend verifies credentials
2. Backend creates JWT containing userId
3. JWT is signed with secret key
4. Frontend stores token in localStorage
5. Every request includes token in Authorization header
6. Middleware verifies token signature and extracts userId

Passwords are hashed with bcrypt (10 salt rounds) before storing. I never store plain passwords.

JWT is better than sessions because it's stateless - I can scale to multiple backend servers easily."

### Q: What was the hardest bug to fix?

**Answer:**
"The WebRTC timing issue. 

The problem: I was sending the WebRTC offer immediately after sending the call request. But the offer was arriving before the receiver created their peer connection.

The fix: I changed the flow so:
1. Caller sends call request (no offer yet)
2. Receiver accepts and creates peer connection
3. Receiver sends 'call_accepted' event
4. NOW caller creates and sends offer
5. Receiver is ready to process it

This taught me that in distributed systems, you can't assume messages arrive in order or that the other party is ready."

### Q: How do you prevent blocked users from contacting each other?

**Answer:**
"I check the blocked_users table before every communication action:

For messages:
```sql
SELECT * FROM blocked_users 
WHERE (blocker_id = userA AND blocked_id = userB)
   OR (blocker_id = userB AND blocked_id = userA)
```

If any row exists, I reject the message/call.

The blocking is one-way and invisible:
- User A blocks User B
- User B doesn't know they're blocked
- User B sees User A as offline
- Prevents User B from creating new account to circumvent block"

### Q: How would you scale this app to 1 million users?

**Answer:**
"Current bottlenecks:
1. **Single server** - All Socket.io connections on one server
2. **Local file storage** - Would fill up quickly
3. **Database** - All queries on one PostgreSQL instance

Solutions:
1. **Load balancer** with multiple backend servers
2. **Redis** for Socket.io adapter (syncs sockets across servers)
3. **Cloudinary/S3** for file storage
4. **Database replication** (read replicas)
5. **CDN** for static files
6. **Message queue** (RabbitMQ) for async tasks
7. **Microservices** (separate auth, chat, calls)

For WebRTC:
- Use TURN servers for users behind strict firewalls
- Possibly add SFU (Selective Forwarding Unit) for group calls"

### Q: What would you add next?

**Answer:**
"Priority features:
1. **Group chats** - Modify messages table to have optional group_id
2. **Message reactions** - Emoji reactions table
3. **Read receipts** - Track which messages are seen
4. **Push notifications** - Firebase Cloud Messaging
5. **Message search** - Full-text search in PostgreSQL
6. **Voice messages** - Record and upload audio
7. **Status updates** - Like WhatsApp stories
8. **End-to-end encryption** - Use Web Crypto API

For production:
- Unit tests (Jest)
- Integration tests (Cypress)
- CI/CD pipeline
- Monitoring (Sentry)
- Analytics (Mixpanel)"

---

# Summary for Interview

**Elevator pitch:**

"ConnectHub is a full-stack real-time communication platform I built using MERN stack, Socket.io, and WebRTC. 

It supports:
- Instant messaging with file sharing
- Video and audio calling (peer-to-peer using WebRTC)
- Friend system with requests and blocking
- Profile management with avatars
- Call history tracking

Technical highlights:
- JWT authentication with bcrypt password hashing
- Socket.io for real-time bidirectional communication
- WebRTC with STUN servers for peer-to-peer video calls
- PostgreSQL with proper foreign key relationships
- Multer for file upload handling
- Deployed on Vercel (frontend) and Render (backend)

I faced challenges with:
- WebRTC timing issues (offer/answer signaling)
- ICE candidate queuing
- Socket.io cleanup in React
- CORS in production
- Type casting errors in PostgreSQL

I learned about:
- Real-time system architecture
- Peer-to-peer networking
- State management in complex apps
- Database schema design
- Production deployment"

**Practice saying this!**

---

**End of Documentation**

This document contains everything you need to explain ConnectHub in an interview. Read it thoroughly, understand the concepts, and practice explaining the flows in your own words.

Good luck with your interviews! 🚀
