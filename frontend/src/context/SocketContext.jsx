import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

const SOCKET_URL = 'http://localhost:5000';

// STUN servers help WebRTC find a path between two users
// even if they are behind firewalls or NAT
// These are free Google STUN servers
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
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
    const cameraTrackRef = useRef(null);                      // Stores original camera track to swap back

    // ── Contacts map (id → username) for looking up names ──
    const contactsRef = useRef({});
    const setContacts = (contacts) => {
        const map = {};
        contacts.forEach((c) => { map[c.id] = c.username; });
        contactsRef.current = map;
    };

    // ───────────────────────────────────────────
    // CLEANUP: Stop all tracks and close connection
    // ───────────────────────────────────────────
    const cleanupCall = useCallback(() => {
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
        setIsSharing(false);
        cameraTrackRef.current = null;
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
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // When we have an ICE candidate, send it to the other user
        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('webrtc_ice_candidate', {
                    senderId: user.id,
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
        };

        peerConnectionRef.current = pc;
        return pc;
    };

    // ───────────────────────────────────────────
    // INITIATE A CALL (User A clicks "Call")
    // ───────────────────────────────────────────
    const initiateCall = async (otherUser, callType) => {
        if (!socketRef.current) return;

        // Step 1: Get our camera/mic
        const stream = await getMediaStream(callType);
        if (!stream) return;

        // Step 2: Tell the other user we want to call them
        socketRef.current.emit('call_request', {
            callerId: user.id,
            receiverId: otherUser.id,
            callType: callType
        });

        // Step 3: Update our state to show "Calling..."
        setActiveCall({ userId: otherUser.id, callType, username: otherUser.username });
        setCallStatus('calling');
    };

    // ───────────────────────────────────────────
    // ACCEPT AN INCOMING CALL (User B clicks "Accept")
    // ───────────────────────────────────────────
    const acceptCall = async () => {
        if (!incomingCall || !socketRef.current) return;

        const { callerId, callType } = incomingCall;

        // Step 1: Get our camera/mic
        const stream = await getMediaStream(callType);
        if (!stream) return;

        // Step 2: Tell the caller we accepted
        socketRef.current.emit('call_accepted', {
            callerId: callerId,
            receiverId: user.id
        });

        // Step 3: Create peer connection and add our stream tracks to it
        const pc = createPeerConnection(callerId);
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Step 4: Update state
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
            callerId: incomingCall.callerId,
            receiverId: user.id
        });

        setIncomingCall(null);
    };

    // ───────────────────────────────────────────
    // END CALL (Either user clicks "End Call")
    // ───────────────────────────────────────────
    const endCall = () => {
        if (socketRef.current && activeCall) {
            socketRef.current.emit('call_ended', {
                senderId: user.id,
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

        socketRef.current = io(SOCKET_URL);
        socketRef.current.emit('authenticate', user.id);

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
                    senderId: user.id,
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
            alert('Call was rejected.');
            cleanupCall();
        });

        // Call failed (user offline)
        socketRef.current.on('call_failed', (data) => {
            alert(data.message);
            cleanupCall();
        });

        // We received a WebRTC Offer (we are the receiver / User B)
        socketRef.current.on('webrtc_offer', async (data) => {
            if (!socketRef.current || !peerConnectionRef.current) return;
            try {
                const pc = peerConnectionRef.current;

                // Set the remote description (the offer from User A)
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

                // Create and send our Answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socketRef.current.emit('webrtc_answer', {
                    senderId: user.id,
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
            } catch (error) {
                console.error('Error handling webrtc_answer:', error);
                cleanupCall();
            }
        });

        // We received an ICE candidate from the other user
        socketRef.current.on('webrtc_ice_candidate', async (data) => {
            if (!peerConnectionRef.current) return;

            try {
                await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                );
            } catch (error) {
                console.error('Failed to add ICE candidate:', error);
            }
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
                senderId: user.id,
                receiverId,
                message: message || null,
                fileUrl: fileData?.fileUrl || null,
                fileType: fileData?.fileType || null,
                fileName: fileData?.fileName || null
            });
            socketRef.current.emit('typing_stop', { senderId: user.id, receiverId });
        }
    };

    const startTyping = (receiverId) => {
        if (socketRef.current && user) {
            socketRef.current.emit('typing_start', { senderId: user.id, receiverId });
        }
    };

    const stopTyping = (receiverId) => {
        if (socketRef.current && user) {
            socketRef.current.emit('typing_stop', { senderId: user.id, receiverId });
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