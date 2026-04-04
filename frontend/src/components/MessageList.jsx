// MessageList.jsx
// Responsibility: renders the scrollable message list including:
// - "Load older messages" button at the top (cursor-based pagination)
// - Individual message bubbles (text + file attachments)
// - Typing indicator
// - Scroll anchor at the bottom

import { BASE_URL } from '../config';

// Format a UTC timestamp to "h:mm AM/PM"
const formatTime = (dateString) => {
    const date = new Date(dateString);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
};

// Render image / video / audio / generic file attachment inside a message
const renderFileAttachment = (msg) => {
    const fileUrl  = msg.file_url  || msg.fileUrl;
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

function MessageList({
    messages,
    currentUserId,
    isTyping,
    hasMoreMessages,
    isLoadingMore,
    onLoadMore,
    messagesEndRef,
    messagesListRef
}) {
    return (
        <div className="messages-list" ref={messagesListRef}>

            {/* "Load older messages" button — only shown when more exist */}
            {hasMoreMessages && (
                <div className="load-more-container">
                    <button
                        className="load-more-btn"
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? 'Loading...' : 'Load older messages'}
                    </button>
                </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, index) => {
                const isMine = (msg.sender_id === currentUserId) || (msg.senderId === currentUserId);
                const fileUrl = msg.file_url || msg.fileUrl;

                return (
                    <div key={msg.id || index} className={`message ${isMine ? 'mine' : 'theirs'}`}>
                        <div className={`message-bubble ${fileUrl ? 'has-file' : ''}`}>
                            {renderFileAttachment(msg)}
                            {msg.message && (
                                <span className="message-text">{msg.message}</span>
                            )}
                            <span className="message-time">
                                {formatTime(msg.created_at || msg.createdAt)}
                            </span>
                        </div>
                    </div>
                );
            })}

            {/* Typing indicator */}
            {isTyping && (
                <div className="message theirs">
                    <div className="message-bubble typing-bubble">
                        <span className="typing-indicator">
                            <span></span><span></span><span></span>
                        </span>
                    </div>
                </div>
            )}

            {/* Scroll anchor — Chat.jsx scrolls here on new messages */}
            <div ref={messagesEndRef} />
        </div>
    );
}

export default MessageList;
