// This component shows when someone is calling you
// Props:
//   caller      — the user object of the person calling { id, username }
//   callType    — 'video' or 'audio'
//   onAccept    — function to call when you click Accept
//   onReject    — function to call when you click Reject
function IncomingCall({ caller, callType, onAccept, onReject }) {
    if (!caller) return null; // Don't render if no incoming call

    return (
        <div className="incoming-call-overlay">
            <div className="incoming-call-box">
                {/* Caller avatar */}
                <div className="incoming-call-avatar">
                    {caller.username.charAt(0).toUpperCase()}
                </div>

                {/* Caller name */}
                <h2 className="incoming-call-name">{caller.username}</h2>

                {/* Call type */}
                <p className="incoming-call-type">
                    Incoming {callType === 'video' ? '📹 Video' : '📞 Audio'} Call...
                </p>

                {/* Animated ring */}
                <div className="incoming-call-ring">
                    <div className="ring ring-1"></div>
                    <div className="ring ring-2"></div>
                    <div className="ring ring-3"></div>
                </div>

                {/* Accept and Reject buttons */}
                <div className="incoming-call-buttons">
                    <button className="call-accept-btn" onClick={onAccept}>
                        ✓ Accept
                    </button>
                    <button className="call-reject-btn" onClick={onReject}>
                        ✕ Reject
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IncomingCall;