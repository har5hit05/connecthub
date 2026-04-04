import { useState, useEffect, useRef } from 'react';

// Props:
//   localStream   — your own camera/mic stream (or screen stream if sharing)
//   remoteStream  — the other person's stream
//   otherUser     — { id, username }
//   callType      — 'video' or 'audio'
//   onEndCall     — function when End Call is clicked
//   isSharing     — boolean, true if YOU are currently sharing screen
//   onShareScreen — function to start sharing screen
//   onStopSharing — function to stop sharing screen
//   callQuality   — { packetLoss, jitter, rtt, bitrate } or null
function VideoCall({ localStream, remoteStream, otherUser, callType, onEndCall, isSharing, onShareScreen, onStopSharing, callQuality }) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [showStats, setShowStats] = useState(false);

    // Attach streams to video elements
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // ─── TOGGLE MIC ───
    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
        }
    };

    // ─── TOGGLE CAMERA ───
    // Disable this button while screen sharing (camera is swapped out)
    const toggleCamera = () => {
        if (localStream && !isSharing) {
            localStream.getVideoTracks().forEach((track) => {
                track.enabled = isCameraOff;
            });
            setIsCameraOff(!isCameraOff);
        }
    };

    // ─── QUALITY LEVEL (green/yellow/red) ───
    const getQualityLevel = () => {
        if (!callQuality) return 'unknown';
        const { packetLoss, rtt } = callQuality;
        if (packetLoss > 5 || rtt > 300) return 'poor';
        if (packetLoss > 2 || rtt > 150) return 'fair';
        return 'good';
    };

    const getQualityColor = () => {
        const level = getQualityLevel();
        switch (level) {
            case 'good': return '#22c55e';
            case 'fair': return '#eab308';
            case 'poor': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getQualityLabel = () => {
        const level = getQualityLevel();
        switch (level) {
            case 'good': return 'Good';
            case 'fair': return 'Fair';
            case 'poor': return 'Poor';
            default: return '...';
        }
    };

    // ─── QUALITY INDICATOR COMPONENT ───
    const QualityIndicator = () => {
        if (!callQuality) return null;

        return (
            <div
                className="call-quality-indicator"
                onClick={() => setShowStats(!showStats)}
                title="Click to toggle connection stats"
            >
                <div className="quality-bars">
                    <span className="quality-bar" style={{ height: '6px', backgroundColor: getQualityColor() }} />
                    <span className="quality-bar" style={{ height: '10px', backgroundColor: getQualityLevel() !== 'poor' ? getQualityColor() : '#4b5563' }} />
                    <span className="quality-bar" style={{ height: '14px', backgroundColor: getQualityLevel() === 'good' ? getQualityColor() : '#4b5563' }} />
                </div>
                <span className="quality-label" style={{ color: getQualityColor() }}>{getQualityLabel()}</span>

                {showStats && (
                    <div className="quality-stats-panel">
                        <div className="stat-row">
                            <span className="stat-name">Packet Loss</span>
                            <span className="stat-value" style={{ color: callQuality.packetLoss > 5 ? '#ef4444' : '#22c55e' }}>
                                {callQuality.packetLoss.toFixed(1)}%
                            </span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-name">Jitter</span>
                            <span className="stat-value">{callQuality.jitter.toFixed(1)} ms</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-name">Latency</span>
                            <span className="stat-value" style={{ color: callQuality.rtt > 300 ? '#ef4444' : callQuality.rtt > 150 ? '#eab308' : '#22c55e' }}>
                                {callQuality.rtt.toFixed(0)} ms
                            </span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-name">Bitrate</span>
                            <span className="stat-value">{callQuality.bitrate.toFixed(0)} kbps</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ─── AUDIO CALL SCREEN ───
    if (callType === 'audio') {
        return (
            <div className="audio-call-screen">
                <QualityIndicator />
                <div className="audio-call-content">
                    <div className="audio-call-avatar">
                        {otherUser?.username?.charAt(0).toUpperCase()}
                    </div>

                    <h2 className="audio-call-name">{otherUser?.username}</h2>
                    <p className="audio-call-status">📞 Call in progress...</p>

                    <div className="call-controls">
                        <button
                            className={`control-btn ${isMuted ? 'active' : ''}`}
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? '🔇' : '🎤'}
                        </button>

                        <button className="control-btn end-call" onClick={onEndCall} title="End Call">
                            📞
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── VIDEO CALL SCREEN ───
    return (
        <div className="video-call-screen">
            <QualityIndicator />

            {/* Remote video — full screen */}
            <div className="remote-video-container">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="remote-video"
                />
                <div className="remote-video-label">
                    <span>{otherUser?.username}</span>
                </div>
            </div>

            {/* Local video — small window bottom right */}
            <div className="local-video-container">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="local-video"
                />
                {/* Show a label when YOU are sharing your screen */}
                {isSharing && (
                    <div className="sharing-label">🖥️ Sharing</div>
                )}
                {/* Show label when camera is off (only when not sharing) */}
                {isCameraOff && !isSharing && (
                    <div className="camera-off-label">Camera Off</div>
                )}
            </div>

            {/* Controls bar at bottom */}
            <div className="call-controls-bar">
                {/* Mute button */}
                <button
                    className={`control-btn ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                    <span className="control-icon">{isMuted ? '🔇' : '🎤'}</span>
                    <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* Camera button — disabled while sharing */}
                <button
                    className={`control-btn ${isCameraOff ? 'active' : ''} ${isSharing ? 'disabled' : ''}`}
                    onClick={toggleCamera}
                    disabled={isSharing}
                    title={isSharing ? 'Camera unavailable while sharing' : (isCameraOff ? 'Turn Camera On' : 'Turn Camera Off')}
                >
                    <span className="control-icon">{isCameraOff ? '📵' : '📹'}</span>
                    <span className="control-label">{isCameraOff ? 'Camera On' : 'Camera Off'}</span>
                </button>

                {/* Screen Share button */}
                {isSharing ? (
                    /* Currently sharing — show Stop button */
                    <button
                        className="control-btn sharing-active"
                        onClick={onStopSharing}
                        title="Stop Sharing Screen"
                    >
                        <span className="control-icon">🖥️</span>
                        <span className="control-label">Stop</span>
                    </button>
                ) : (
                    /* Not sharing — show Share button */
                    <button
                        className="control-btn"
                        onClick={onShareScreen}
                        title="Share Your Screen"
                    >
                        <span className="control-icon">🖥️</span>
                        <span className="control-label">Share</span>
                    </button>
                )}

                {/* End Call button */}
                <button className="control-btn end-call" onClick={onEndCall} title="End Call">
                    <span className="control-icon">📞</span>
                    <span className="control-label">End</span>
                </button>
            </div>
        </div>
    );
}

export default VideoCall;