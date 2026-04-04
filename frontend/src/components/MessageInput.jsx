// MessageInput.jsx
// Responsibility: manages all input-related state and actions:
// - Text input with typing indicators
// - File selection and preview
// - File upload + message send (text only or text + file)

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from '../config';

function MessageInput({ selectedUser, sendMessage, startTyping, stopTyping }) {
    const [inputText, setInputText]     = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview]   = useState(null);
    const [isUploading, setIsUploading]   = useState(false);

    const typingTimeoutRef = useRef(null);
    const fileInputRef     = useRef(null);

    // Cleanup typing timeout on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    // ── Typing indicator ──
    const handleInputChange = (e) => {
        setInputText(e.target.value);
        startTyping(selectedUser.id);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => stopTyping(selectedUser.id), 2000);
    };

    // ── File selection ──
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);

        // Generate image preview
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setFilePreview(reader.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }

        // Reset so the same file can be selected again
        e.target.value = '';
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
    };

    // ── Send message (text and/or file) ──
    const handleSend = async () => {
        if (!inputText.trim() && !selectedFile) return;

        if (selectedFile) {
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const response = await axios.post(`${API_URL}/chat/upload`, formData);

                const { fileUrl, fileType, originalName } = response.data;

                sendMessage(
                    selectedUser.id,
                    inputText.trim() || null,
                    { fileUrl, fileType, fileName: originalName }
                );

                setSelectedFile(null);
                setFilePreview(null);
                setInputText('');
            } catch (error) {
                console.error('File upload failed:', error);
                alert('Failed to upload file. Please try again.');
            } finally {
                setIsUploading(false);
            }
        } else {
            sendMessage(selectedUser.id, inputText.trim());
            setInputText('');
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        stopTyping(selectedUser.id);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) handleSend();
    };

    return (
        <>
            {/* File preview bar — shown when a file is selected */}
            {selectedFile && (
                <div className="file-preview-bar">
                    <div className="file-preview-content">
                        {filePreview ? (
                            <img src={filePreview} alt="preview" className="file-preview-img" />
                        ) : (
                            <span className="file-preview-icon">📎</span>
                        )}
                        <div className="file-preview-info">
                            <span className="file-preview-name">{selectedFile.name}</span>
                            <span className="file-preview-size">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                            </span>
                        </div>
                    </div>
                    <button className="file-preview-remove" onClick={handleRemoveFile} title="Remove file">
                        ✕
                    </button>
                </div>
            )}

            <div className="message-input-area">
                {/* Hidden file input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />

                {/* Attach file button */}
                <button
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                    disabled={isUploading}
                >
                    📎
                </button>

                {/* Text input */}
                <input
                    type="text"
                    className="message-input"
                    placeholder={selectedFile ? 'Add a caption...' : `Message ${selectedUser.username}...`}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={isUploading}
                />

                {/* Send button */}
                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={(!inputText.trim() && !selectedFile) || isUploading}
                >
                    {isUploading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </>
    );
}

export default MessageInput;
