import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL, API_URL } from '../config';

const SocketContext = createContext();

// Fallback ICE config in case the backend API is unreachable
const FALLBACK_ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const socketRef = useRef(null);
    const peerConnectionRef = useRef(null);   // The WebRTC peer connection
    const localStreamRef = useRef(null);      // Our camera/mic stream (ref so it persists)

    // ── Chat state ──
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState({});
    const [selectedUser, setSelectedUser] = useState(null);

    // ── Call state ──
    const [incomingCall, setIncomingCall] = useState(null);   // { callerId, callType }
    const [activeCall, setActiveCall] = useState(null);       // { userId, callType, username }
    const [localStream, setLocalStream] = useState(null);     // Our video/audio stream
    const [remoteStream, setRemoteStream] = useState(null);   // Other person's stream
    const [callStatus, setCallStatus] = useState(null);       // 'calling', 'connected', null
    const [isSharing, setIsSharing] = useState(false);        // Is screen sharing active?
    const [callQuality, setCallQuality] = useState(null);     // { packetLoss, jitter, rtt, bitrate }
    const cameraTrackRef = useRef(null);                      // Stores original camera track to swap back
    const iceConfigRef = useRef(FALLBACK_ICE_CONFIG);         // ICE config from backend (with TURN)
    const statsIntervalRef = useRef(null);                    // Interval ID for stats polling
    const callMetricsRef = useRef(null);                      // Aggregated metrics to send on call end
    const callIdRef = useRef(null);                           // Database call ID for metrics submission
    const prevStatsRef = useRef(null);                        // Previous stats snapshot for delta calculations
    const pendingCandidatesRef = useRef([]);                  // Queue for ICE candidates that arrive before remote description

    // ── Contacts map (id → username) for looking up names ──
    const contactsRef = useRef({});
    const setContacts = useCallback((contacts) => {
        const map = {};
        contacts.forEach((c) => { map[c.id] = c.username; });
        contactsRef.current = map;
    }, []);

    // ───────────────────────────────────────────
    // FETCH ICE CONFIG from backend (includes TURN credentials)
    // ───────────────────────────────────────────
    const fetchIceConfig = async () => {
        try {
            const storedToken = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/webrtc/turn`, {
                credentials: 'include',
                headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
            });
            if (res.ok) {
                const config = await res.json();
                iceConfigRef.current = config;
                return config;
            }
        } catch (err) {
            console.warn('Failed to fetch ICE config, using fallback STUN-only:', err.message);
        }
        return FALLBACK_ICE_CONFIG;
    };

    // ───────────────────────────────────────────
    // WEBRTC STATS: Poll connection quality every 3 seconds
    // ───────────────────────────────────────────
    const startStatsPolling = (pc) => {
        // Clear any existing interval
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        prevStatsRef.current = null;
        callMetricsRef.current = { packetLoss: 0, jitter: 0, roundTripTime: 0, bitrate: 0, sampleCount: 0 };

        statsIntervalRef.current = setInterval(async () => {
            if (!pc || pc.connectionState === 'closed') {
                clearInterval(statsIntervalRef.current);
                return;
            }

            try {
                const stats = await pc.getStats();
                let currentPacketLoss = 0;
                let currentJitter = 0;
                let currentRtt = 0;
                let currentBitrate = 0;

                stats.forEach((report) => {
                    // Inbound RTP — packet loss and jitter from our perspective
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        if (prevStatsRef.current) {
                            const prev = prevStatsRef.current.get(report.id);
                            if (prev) {
                                const packetsLost = report.packetsLost - (prev.packetsLost || 0);
                                const packetsReceived = report.packetsReceived - (prev.packetsReceived || 0);
                                const totalPackets = packetsLost + packetsReceived;
                                currentPacketLoss = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

                                const bytesReceived = report.bytesReceived - (prev.bytesReceived || 0);
                                const timeDelta = (report.timestamp - prev.timestamp) / 1000; // seconds
                                currentBitrate = timeDelta > 0 ? (bytesReceived * 8) / timeDelta / 1000 : 0; // kbps
                            }
                        }
                        currentJitter = (report.jitter || 0) * 1000; // convert to ms
                    }

                    // Candidate pair — round trip time
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        currentRtt = (report.currentRoundTripTime || 0) * 1000; // convert to ms
                    }
                });

                // Save current stats for next delta calculation
                prevStatsRef.current = new Map();
                stats.forEach((report) => {
                    prevStatsRef.current.set(report.id, report);
                });

                // Update the live quality indicator
                const quality = {
                    packetLoss: Math.round(currentPacketLoss * 100) / 100,
                    jitter: Math.round(currentJitter * 100) / 100,
                    rtt: Math.round(currentRtt * 100) / 100,
                    bitrate: Math.round(currentBitrate * 100) / 100
                };
                setCallQuality(quality);

                // Accumulate running averages for final submission
                if (callMetricsRef.current) {
                    const m = callMetricsRef.current;
                    m.sampleCount++;
                    m.packetLoss += (currentPacketLoss - m.packetLoss) / m.sampleCount;
                    m.jitter += (currentJitter - m.jitter) / m.sampleCount;
                    m.roundTripTime += (currentRtt - m.roundTripTime) / m.sampleCount;
                    m.bitrate += (currentBitrate - m.bitrate) / m.sampleCount;
                }
            } catch (err) {
                // Stats API can throw if connection is closing
            }
        }, 3000);
    };

    const stopStatsPolling = () => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
    };

    // ───────────────────────────────────────────
    // SEND METRICS to backend after call ends
    // ───────────────────────────────────────────
    const sendCallMetrics = async () => {
        const callId = callIdRef.current;
        const metrics = callMetricsRef.current;

        if (!callId || !metrics || metrics.sampleCount === 0) return;

        try {
            const storedToken = localStorage.getItem('token');
            const metricsHeaders = { 'Content-Type': 'application/json' };
            if (storedToken) metricsHeaders['Authorization'] = `Bearer ${storedToken}`;
            await fetch(`${API_URL}/calls/${callId}/metrics`, {
                method: 'POST',
                credentials: 'include',
                headers: metricsHeaders,
                body: JSON.stringify({
                    packetLoss: Math.round(metrics.packetLoss * 100) / 100,
                    jitter: Math.round(metrics.jitter * 100) / 100,
                    roundTripTime: Math.round(metrics.roundTripTime * 100) / 100,
                    bitrate: Math.round(metrics.bitrate * 100) / 100
                })
            });
        } catch (err) {
            console.warn('Failed to submit call metrics:', err.message);
        }
    };

    // ───────────────────────────────────────────
    // CLEANUP: Stop all tracks and close connection
    // ───────────────────────────────────────────
    const cleanupCall = useCallback(() => {
        // Stop stats polling and send aggregated metrics
        stopStatsPolling();
        sendCallMetrics();

        // Stop all media tracks (turn off camera and mic)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        // Close the peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Reset all call state
        setLocalStream(null);
        setRemoteStream(null);
        setActiveCall(null);
        setIncomingCall(null);
        setCallStatus(null);
        setCallQuality(null);
        setIsSharing(false);
        cameraTrackRef.current = null;
        callMetricsRef.current = null;
        callIdRef.current = null;
        prevStatsRef.current = null;
    }, []);

    // ───────────────────────────────────────────
    // GET MEDIA: Ask browser for camera and/or mic
    // ───────────────────────────────────────────
    const getMediaStream = async (callType) => {
        try {
            const constraints = {
                audio: true,
                video: callType === 'video' ? true : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Failed to get media stream:', error);
            alert('Could not access camera/microphone. Please check permissions.');
            return null;
        }
    };

    // ───────────────────────────────────────────
    // CREATE PEER CONNECTION
    // Sets up the WebRTC connection and all event handlers
    // ───────────────────────────────────────────
    const createPeerConnection = (otherUserId) => {
        const pc = new RTCPeerConnection(iceConfigRef.current);

        // When we have an ICE candidate, send it to the other user
        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('webrtc_ice_candidate', {
                    receiverId: otherUserId,
                    candidate: event.candidate
                });
            }
        };

        // When we receive the other person's video/audio stream
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
                setCallStatus('connected');
            }
        };

        // If connection fails or disconnects
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                console.log('ICE connection lost');
                cleanupCall();
            }
            // Start stats polling once connected
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                startStatsPolling(pc);
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    };

    // ───────────────────────────────────────────
    // INITIATE A CALL (User A clicks "Call")
    // ───────────────────────────────────────────
    const initiateCall = async (otherUser, callType) => {
        if (!socketRef.current) return;

        // Step 1: Fetch ICE config with TURN credentials from backend
        await fetchIceConfig();

        // Step 2: Get our camera/mic
        const stream = await getMediaStream(callType);
        if (!stream) return;

        // Step 3: Tell the other user we want to call them
        socketRef.current.emit('call_request', {
            receiverId: otherUser.id,
            callType: callType
        });

        // Step 4: Update our state to show "Calling..."
        setActiveCall({ userId: otherUser.id, callType, username: otherUser.username });
        setCallStatus('calling');
    };

    // ───────────────────────────────────────────
    // ACCEPT AN INCOMING CALL (User B clicks "Accept")
    // ───────────────────────────────────────────
    const acceptCall = async () => {
        if (!incomingCall || !socketRef.current) return;

        const { callerId, callType } = incomingCall;

        // Step 1: Fetch ICE config with TURN credentials from backend
        await fetchIceConfig();

        // Step 2: Get our camera/mic
        const stream = await getMediaStream(callType);
        if (!stream) return;

        // Step 3: Tell the caller we accepted
        socketRef.current.emit('call_accepted', {
            callerId: callerId
        });

        // Step 4: Create peer connection and add our stream tracks to it
        const pc = createPeerConnection(callerId);
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Step 5: Update state
        setActiveCall({
            userId: callerId,
            callType,
            username: contactsRef.current[callerId] || 'User'
        });
        setIncomingCall(null);
    };

    // ───────────────────────────────────────────
    // REJECT AN INCOMING CALL (User B clicks "Reject")
    // ───────────────────────────────────────────
    const rejectCall = () => {
        if (!incomingCall || !socketRef.current) return;

        socketRef.current.emit('call_rejected', {
            callerId: incomingCall.callerId
        });

        setIncomingCall(null);
    };

    // ───────────────────────────────────────────
    // END CALL (Either user clicks "End Call")
    // ───────────────────────────────────────────
    const endCall = () => {
        if (socketRef.current && activeCall) {
            socketRef.current.emit('call_ended', {
                receiverId: activeCall.userId
            });
        }
        cleanupCall();
    };

    // ───────────────────────────────────────────
    // SHARE SCREEN
    // Asks browser for screen, then swaps the video track
    // ───────────────────────────────────────────
    const shareScreen = async () => {
        try {
            // Step 1: Ask the browser to let us capture the screen
            // The browser will show a picker (Entire Screen / Window / Tab)
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false  // We don't capture screen audio (keeps mic audio)
            });

            const screenTrack = screenStream.getVideoTracks()[0];

            // Step 2: Save our current camera track so we can go back to it later
            if (localStreamRef.current) {
                const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
                cameraTrackRef.current = currentVideoTrack;
            }

            // Step 3: Find the video sender in our peer connection and replace the track
            // getSenders() returns all the tracks we are sending to the other person
            // We find the one that is a video track and replace it with the screen track
            if (peerConnectionRef.current) {
                const videoSender = peerConnectionRef.current.getSenders().find(
                    (sender) => sender.track && sender.track.kind === 'video'
                );

                if (videoSender) {
                    await videoSender.replaceTrack(screenTrack);
                }
            }

            // Step 4: Update the local stream so our own preview updates too
            // We create a new stream with the screen track + our original audio track
            const audioTrack = localStreamRef.current?.getAudioTracks()[0];
            const newStream = new MediaStream();
            newStream.addTrack(screenTrack);
            if (audioTrack) newStream.addTrack(audioTrack);

            localStreamRef.current = newStream;
            setLocalStream(newStream);
            setIsSharing(true);

            // Step 5: Listen for when the user clicks "Stop sharing" in the browser's
            // own sharing bar (the bar that appears at the top/bottom of screen)
            screenTrack.onended = () => {
                stopSharing();
            };

        } catch (error) {
            // User cancelled the screen picker or permission was denied
            console.error('Screen sharing error:', error);
            setIsSharing(false);
        }
    };

    // ───────────────────────────────────────────
    // STOP SHARING SCREEN
    // Swaps back to the camera track
    // ───────────────────────────────────────────
    const stopSharing = () => {
        if (!peerConnectionRef.current || !cameraTrackRef.current) {
            setIsSharing(false);
            return;
        }

        // Step 1: Stop the screen track (turns off the screen capture indicator)
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
        }

        // Step 2: Put the camera track back into the peer connection
        const videoSender = peerConnectionRef.current.getSenders().find(
            (sender) => sender.track && sender.track.kind === 'video'
        );

        if (videoSender) {
            videoSender.replaceTrack(cameraTrackRef.current);
        }

        // Step 3: Rebuild the local stream with camera + audio
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        const restoredStream = new MediaStream();
        restoredStream.addTrack(cameraTrackRef.current);
        if (audioTrack) restoredStream.addTrack(audioTrack);

        localStreamRef.current = restoredStream;
        setLocalStream(restoredStream);
        setIsSharing(false);
        cameraTrackRef.current = null;
    };

    // ───────────────────────────────────────────
    // SOCKET.IO EVENT LISTENERS
    // ───────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        // Request Notification permission if possible
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Pass token in handshake auth for cross-origin scenarios where cookies are blocked.
        // withCredentials: true keeps cookie support for browsers that allow it.
        const storedToken = localStorage.getItem('token');
        socketRef.current = io(SOCKET_URL, {
            withCredentials: true,
            auth: storedToken ? { token: storedToken } : {}
        });

        // Handle authentication failure on socket connection
        socketRef.current.on('connect_error', (err) => {
            console.error('Socket connection failed:', err.message);
        });

        // ── CHAT EVENTS ──
        socketRef.current.on('user_online', (data) => {
            setOnlineUsers((prev) => (!prev.includes(data.userId) ? [...prev, data.userId] : prev));
        });

        socketRef.current.on('user_offline', (data) => {
            setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
        });

        socketRef.current.on('online_users', (data) => {
            setOnlineUsers(data.users);
        });

        socketRef.current.on('receive_message', (data) => {
            setMessages((prev) => [...prev, {
                id: data.id,
                senderId: data.senderId,
                receiverId: data.receiverId,
                message: data.message,
                fileUrl: data.fileUrl,
                fileType: data.fileType,
                fileName: data.fileName,
                createdAt: data.createdAt
            }]);

            // Native Browser Push Notification
            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                const senderName = contactsRef.current[data.senderId] || 'Someone';
                const bodyMsg = data.message || (data.fileType ? 'Sent an attachment' : 'New message');
                new Notification(`New message from ${senderName}`, {
                    body: bodyMsg,
                    icon: '/vite.svg',
                    vibrate: [200, 100, 200]
                });
            }
        });

        socketRef.current.on('message_sent', (data) => {
            setMessages((prev) => [...prev, {
                id: data.id,
                senderId: data.senderId,
                receiverId: data.receiverId,
                message: data.message,
                fileUrl: data.fileUrl,
                fileType: data.fileType,
                fileName: data.fileName,
                createdAt: data.createdAt
            }]);
        });

        socketRef.current.on('user_typing', (data) => {
            setTypingUsers((prev) => ({ ...prev, [data.userId]: data.isTyping }));
        });

        // ── CALL EVENTS ──

        // Someone is calling us
        socketRef.current.on('incoming_call', (data) => {
            setIncomingCall({
                callerId: data.callerId,
                callType: data.callType
            });

            // Native Browser Push Notification
            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                const callerName = contactsRef.current[data.callerId] || 'Someone';
                new Notification(`Incoming ${data.callType} call from ${callerName}`, {
                    body: 'Click to open ConnectHub and answer',
                    icon: '/vite.svg',
                    vibrate: [500, 200, 500, 200, 500]
                });
            }
        });

        // The person we called accepted
        socketRef.current.on('call_accepted', async (data) => {
            if (!socketRef.current) return;
            try {
                // Create peer connection
                const pc = createPeerConnection(data.receiverId);

                // Add our stream tracks
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((track) => {
                        pc.addTrack(track, localStreamRef.current);
                    });
                }

                // Create and send the Offer (SDP)
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socketRef.current.emit('webrtc_offer', {
                    receiverId: data.receiverId,
                    offer: offer
                });
            } catch (error) {
                console.error('Error handling call_accepted:', error);
                cleanupCall();
            }
        });

        // The person we called rejected
        socketRef.current.on('call_rejected', () => {
            setCallStatus('rejected');
            setTimeout(() => cleanupCall(), 3000);
        });

        // Call failed (user offline)
        socketRef.current.on('call_failed', (data) => {
            setCallStatus('failed');
            setTimeout(() => cleanupCall(), 3000);
        });

        // We received a WebRTC Offer (we are the receiver / User B)
        socketRef.current.on('webrtc_offer', async (data) => {
            if (!socketRef.current || !peerConnectionRef.current) return;
            try {
                const pc = peerConnectionRef.current;

                // Set the remote description (the offer from User A)
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

                // Process any candidates that arrived locally early for User B
                if (pendingCandidatesRef.current && pendingCandidatesRef.current.length > 0) {
                    for (const candidate of pendingCandidatesRef.current) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } 
                        catch (e) { console.warn('Failed to add queued candidate:', e); }
                    }
                    pendingCandidatesRef.current = [];
                }

                // Create and send our Answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socketRef.current.emit('webrtc_answer', {
                    receiverId: data.senderId,
                    answer: answer
                });
            } catch (error) {
                console.error('Error handling webrtc_offer:', error);
                cleanupCall();
            }
        });

        // We received a WebRTC Answer (we are the caller / User A)
        socketRef.current.on('webrtc_answer', async (data) => {
            if (!peerConnectionRef.current) return;
            try {
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
                // Process any candidates that arrived early
                if (pendingCandidatesRef.current) {
                    for (const candidate of pendingCandidatesRef.current) {
                        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } 
                        catch (e) { console.warn('Failed to add queued candidate:', e); }
                    }
                    pendingCandidatesRef.current = [];
                }
            } catch (error) {
                console.error('Error handling webrtc_answer:', error);
                cleanupCall();
            }
        });

        // We received an ICE candidate from the other user
        socketRef.current.on('webrtc_ice_candidate', async (data) => {
            if (!peerConnectionRef.current) return;

            try {
                if (!peerConnectionRef.current.remoteDescription) {
                    // Queue candidate if remote description isn't set yet (race condition fix)
                    if (!pendingCandidatesRef.current) pendingCandidatesRef.current = [];
                    pendingCandidatesRef.current.push(data.candidate);
                } else {
                    await peerConnectionRef.current.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    );
                }
            } catch (error) {
                console.error('Failed to add ICE candidate:', error);
            }
        });

        // Backend saved the call to the database — we need the ID to submit metrics
        socketRef.current.on('call_recorded', (data) => {
            callIdRef.current = data.callId;
        });

        // The other person ended the call
        socketRef.current.on('call_ended', () => {
            cleanupCall();
        });

        // Cleanup on logout or unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            cleanupCall();
        };
    }, [user, cleanupCall]);

    // ── CHAT FUNCTIONS ──
    const sendMessage = (receiverId, message, fileData) => {
        if (socketRef.current && user) {
            socketRef.current.emit('send_message', {
                receiverId,
                message: message || null,
                fileUrl: fileData?.fileUrl || null,
                fileType: fileData?.fileType || null,
                fileName: fileData?.fileName || null
            });
            socketRef.current.emit('typing_stop', { receiverId });
        }
    };

    const startTyping = (receiverId) => {
        if (socketRef.current && user) {
            socketRef.current.emit('typing_start', { receiverId });
        }
    };

    const stopTyping = (receiverId) => {
        if (socketRef.current && user) {
            socketRef.current.emit('typing_stop', { receiverId });
        }
    };

    const selectUser = (contactUser) => {
        setSelectedUser(contactUser);
        // Don't clear messages here — Chat.jsx clears them when it fetches new history
        // so there's no flash of empty content before the fetch completes
    };

    return (
        <SocketContext.Provider value={{
            // Chat
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
            // Calls
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
            // Screen sharing
            isSharing,
            shareScreen,
            stopSharing
        }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used inside SocketProvider');
    }
    return context;
};