# ConnectHub

A full-stack real-time communication platform built with **React**, **Node.js**, **WebRTC**, **Socket.io**, and **PostgreSQL**.

## Features

- 🔐 User authentication with JWT
- 💬 Real-time chat with typing indicators
- 📹 1-on-1 video calling (WebRTC)
- 📞 1-on-1 audio calling
- 🖥️ Screen sharing during video calls
- 👥 Online/Offline presence system
- 📋 Call history with duration tracking
- 📊 Dashboard with stats and quick actions
- 🧑‍🤝‍🧑 Friend Request System
- 👤 User Profile Management
- 🫸 Block user to resrict any kind of communication

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router, Socket.io-client, Axios |
| Backend | Node.js, Express, Socket.io |
| Database | PostgreSQL |
| Real-time | WebRTC, Socket.io (signaling) |
| Auth | JWT, bcryptjs |

## Project Structure

```
ConnectHub/
├── backend/
│   ├── config/          # Database connection
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   ├── socket/          # Socket.io & WebRTC signaling
│   └── server.js        # Main server entry
├── frontend/
│   ├── src/
│   │   ├── components/  # IncomingCall, VideoCall
│   │   ├── context/     # AuthContext, SocketContext
│   │   ├── pages/       # Dashboard, Chat, CallHistory, Login, Register, Friends
│   │   ├── App.jsx      # Routes
│   │   └── App.css      # All styles
│   └── ...
└── README.md
```

## Setup & Run

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 2. Database Setup
```sql
CREATE DATABASE connecthub;
\c connecthub

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) NOT NULL,
    receiver_id INTEGER REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER REFERENCES users(id) NOT NULL,
    receiver_id INTEGER REFERENCES users(id) NOT NULL,
    call_type VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    duration INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Backend
```bash
cd backend
cp .env.example .env   # Edit with your PostgreSQL password & JWT secret
npm install
npm run dev
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Open
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Environment Variables

Create `backend/.env`:
```
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/connecthub
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

## How WebRTC Works in This Project

1. User A clicks "Call" → browser gets camera/mic permission
2. A `call_request` event is sent via Socket.io to User B
3. User B sees "Incoming Call" and clicks Accept
4. A `call_accepted` event goes back to User A
5. User A creates an RTCPeerConnection and sends an SDP **Offer**
6. User B receives the Offer, creates an **Answer**, sends it back
7. Both sides exchange **ICE candidates** to find the best network path
8. A direct peer-to-peer connection is established — video/audio flows without the server
9. Screen sharing works by swapping the video track using `replaceTrack()`

## License
Built as a personal project (for learning) for portfolio purposes.
