// ChatHeader.jsx
// Responsibility: renders the top bar of the chat area showing the
// selected contact's name, online status, and call buttons.

function ChatHeader({ selectedUser, isOnline, onInitiateCall }) {
    return (
        <div className="chat-header">
            <div className={`chat-header-avatar ${isOnline ? 'online' : 'offline'}`}>
                {selectedUser.username.charAt(0).toUpperCase()}
            </div>

            <div className="chat-header-info">
                <span className="chat-header-name">{selectedUser.username}</span>
                <span className={`chat-header-status ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            </div>

            {isOnline && (
                <div className="chat-header-call-buttons">
                    <button
                        className="call-icon-btn audio-call"
                        onClick={() => onInitiateCall(selectedUser, 'audio')}
                        title="Audio Call"
                    >📞</button>
                    <button
                        className="call-icon-btn video-call"
                        onClick={() => onInitiateCall(selectedUser, 'video')}
                        title="Video Call"
                    >📹</button>
                </div>
            )}
        </div>
    );
}

export default ChatHeader;
