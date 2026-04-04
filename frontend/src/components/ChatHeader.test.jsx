/**
 * ChatHeader.test.jsx
 * Tests for the ChatHeader component.
 *
 * ChatHeader renders: avatar initial, username, online/offline status label,
 * and audio/video call buttons (only when the contact is online).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatHeader from './ChatHeader';

const ONLINE_USER  = { id: 2, username: 'bob' };
const OFFLINE_USER = { id: 3, username: 'carol' };

describe('ChatHeader', () => {

    it('renders the contact username', () => {
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={vi.fn()} />);
        expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('shows the first letter of the username as the avatar', () => {
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={vi.fn()} />);
        expect(screen.getByText('B')).toBeInTheDocument(); // charAt(0).toUpperCase()
    });

    it('shows "Online" status when isOnline is true', () => {
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={vi.fn()} />);
        expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('shows "Offline" status when isOnline is false', () => {
        render(<ChatHeader selectedUser={OFFLINE_USER} isOnline={false} onInitiateCall={vi.fn()} />);
        expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('renders audio and video call buttons when contact is online', () => {
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={vi.fn()} />);
        expect(screen.getByTitle('Audio Call')).toBeInTheDocument();
        expect(screen.getByTitle('Video Call')).toBeInTheDocument();
    });

    it('hides call buttons when contact is offline', () => {
        render(<ChatHeader selectedUser={OFFLINE_USER} isOnline={false} onInitiateCall={vi.fn()} />);
        expect(screen.queryByTitle('Audio Call')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Video Call')).not.toBeInTheDocument();
    });

    it('calls onInitiateCall with the user and "audio" when audio button is clicked', () => {
        const onInitiateCall = vi.fn();
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={onInitiateCall} />);

        fireEvent.click(screen.getByTitle('Audio Call'));

        expect(onInitiateCall).toHaveBeenCalledTimes(1);
        expect(onInitiateCall).toHaveBeenCalledWith(ONLINE_USER, 'audio');
    });

    it('calls onInitiateCall with the user and "video" when video button is clicked', () => {
        const onInitiateCall = vi.fn();
        render(<ChatHeader selectedUser={ONLINE_USER} isOnline={true} onInitiateCall={onInitiateCall} />);

        fireEvent.click(screen.getByTitle('Video Call'));

        expect(onInitiateCall).toHaveBeenCalledWith(ONLINE_USER, 'video');
    });
});
