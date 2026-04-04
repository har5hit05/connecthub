# Design & Architecture Decisions

This document details the architectural decisions, API mapping, and scalability considerations for ConnectHub.

## 1. Core Architectural Choices

### Relational Database over NoSQL
**Decision:** We chose **PostgreSQL** over MongoDB or other NoSQL variants.
**Reasoning:** 
- Connectivity between resources (Users -> Messages, Users -> Friends, Users -> Blocked) is inherently graph-like and highly relational.  
- PostgreSQL allows efficient joining of tables when hydrating chat lists, friends lists, and ensuring ACID compliance for critical paths like friend-request acceptances.
- We leverage `JOIN` clauses to prevent complex and slow nested application-layer queries.

### WebSocket Framework
**Decision:** **Socket.io** was chosen over native `WebSocket` API.
**Reasoning:**
- Automatic reconnections with exponential back-off out-of-the-box.
- Fallback to HTTP Long-Polling if WebSocket connections fail (crucial for restrictive corporate firewalls).
- Rooms and Namespaces: Socket.io's `to(socketId)` and `broadcast` primitives significantly reduce the boilerplate for managing 1-to-1 WebRTC signaling.

### Native WebRTC vs SFU/MCU 
**Decision:** Used direct **Peer-to-Peer (P2P) WebRTC** instead of an SFU (Selective Forwarding Unit) or MCU (Multipoint Control Unit).
**Reasoning:**
- ConnectHub is designed for 1-on-1 audio/video calls. In 1-on-1 setups, an SFU introduces unnecessary proxying latency and server costs.
- End-to-end encryption is natively maintained in P2P WebRTC.

---

## 2. API Endpoint Map

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/register` | POST | Register a new account | No |
| `/api/auth/login` | POST | Login and receive a JWT | No |
| `/api/auth/me` | GET | Fetch the current logged-in user profile | Yes |
| `/api/users/search` | GET | Search a user by email/username | Yes |
| `/api/friends/request` | POST | Send a friend request | Yes |
| `/api/friends/accept` | POST | Accept a pending request | Yes |
| `/api/friends/reject` | POST | Reject a pending request | Yes |
| `/api/friends/pending`| GET | List incoming pending requests | Yes |
| `/api/friends/` | GET | List accepted friends | Yes |
| `/api/chat/history/:id` | GET | Retrieve message history with user | Yes |
| `/api/video/token` | GET | Retrieve ICE turn server configurations | Yes |

---

## 3. Scalability Roadmap

Currently, ConnectHub runs as a monolith (single Express server process). To handle millions of concurrent connections, the following scaling roadmap is planned:

### Phase 1: Database Connections & Caching
- **Connection Pooling:** Introduce `pg-pool` to manage concurrent DB connections without exceeding PostgreSQL's max_connections limits.
- **Redis Caching:** Cache frequently accessed, slow-changing data (like User Profiles) in a Redis cluster to reduce database I/O.

### Phase 2: Horizontal Scaling for Socket.io
- **Redis Adapter:** Since WebSockets are stateful, if User A connects to `Server 1` and User B connects to `Server 2`, they cannot directly signal each other via memory. 
- Implementing `@socket.io/redis-adapter` will publish messages from Server 1 to a Redis Pub/Sub channel that Server 2 listens to, allowing cross-server WebRTC signaling and messaging.
- **Load Balancer:** Use Nginx or AWS ALB with sticky sessions (if falling back to polling) or pure WebSockets to round-robin incoming connections efficiently.

### Phase 3: Media Server for Group Calls (Future Proofing)
- If the roadmap demands group calls (3+ participants), the P2P mesh network will break down due to exponential outgoing streams per client.
- In this case, we will introduce a **mediasoup** or **Janus** SFU component that users stream to once, and it forwards the tracks to all other participants.
