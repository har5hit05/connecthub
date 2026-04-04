// ContactList.jsx
// Responsibility: renders the sidebar showing all contacts with their
// online status, unread badges, and call buttons.

function ContactList({ contacts, selectedUser, onlineUsers, unreadCounts, onUserClick, onInitiateCall }) {

    const isUserOnline = (userId) => onlineUsers.includes(userId);

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3>Contacts</h3>
                <span className="online-count">{onlineUsers.length} online</span>
            </div>

            <div className="contact-list">
                {contacts.map((contact) => (
                    <div
                        key={contact.id}
                        className={`contact-item ${selectedUser?.id === contact.id ? 'active' : ''}`}
                        onClick={() => onUserClick(contact)}
                    >
                        <div className={`avatar ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                            {contact.username.charAt(0).toUpperCase()}
                        </div>

                        <div className="contact-info">
                            <div className="contact-name-row">
                                <span className="contact-name">{contact.username}</span>
                                {unreadCounts[contact.id] > 0 && (
                                    <span className="unread-badge">{unreadCounts[contact.id]}</span>
                                )}
                            </div>
                            <span className={`contact-status ${isUserOnline(contact.id) ? 'online' : 'offline'}`}>
                                {isUserOnline(contact.id) ? 'Online' : 'Offline'}
                            </span>
                        </div>

                        {isUserOnline(contact.id) && (
                            <div className="contact-call-buttons">
                                <button
                                    className="call-icon-btn audio-call"
                                    onClick={(e) => { e.stopPropagation(); onInitiateCall(contact, 'audio'); }}
                                    title="Audio Call"
                                >📞</button>
                                <button
                                    className="call-icon-btn video-call"
                                    onClick={(e) => { e.stopPropagation(); onInitiateCall(contact, 'video'); }}
                                    title="Video Call"
                                >📹</button>
                            </div>
                        )}
                    </div>
                ))}

                {contacts.length === 0 && (
                    <p className="no-contacts">No other users yet.</p>
                )}
            </div>
        </div>
    );
}

export default ContactList;
