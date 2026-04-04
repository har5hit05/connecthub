import React from 'react';
import './Skeletons.css';

export const ListSkeleton = ({ count = 5 }) => {
  return (
    <div className="skeleton-wrapper">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-item-row">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-details">
            <div className="skeleton-text skeleton-title"></div>
            <div className="skeleton-text skeleton-subtitle"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatSkeleton = () => {
  return (
    <div className="skeleton-chat">
      <div className="skeleton-header">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-text skeleton-title"></div>
      </div>
      <div className="skeleton-messages">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`skeleton-message ${i % 2 === 0 ? 'skeleton-message-left' : 'skeleton-message-right'}`}>
            <div className="skeleton-bubble"></div>
          </div>
        ))}
      </div>
      <div className="skeleton-input"></div>
    </div>
  );
};

export const PageSkeleton = () => {
    return (
        <div className="skeleton-page">
            <div className="skeleton-header-large"></div>
            <div className="skeleton-grid">
                <div className="skeleton-card"></div>
                <div className="skeleton-card"></div>
                <div className="skeleton-card"></div>
            </div>
            <ListSkeleton count={3} />
        </div>
    );
};

export const FullScreenLoader = () => {
  return (
    <div className="fullscreen-loader">
      <div className="spinner"></div>
      Loading ConnectHub...
    </div>
  )
}
