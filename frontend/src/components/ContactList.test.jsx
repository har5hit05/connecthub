/**
 * ContactList.test.jsx
 * Tests for the ContactList sidebar component.
 *
 * ContactList renders: a list of contacts with online/offline status,
 * unread message badges, and call buttons for online contacts.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactList from './ContactList';

const contacts = [
    { id: 1, username: 'alice' },
    { id: 2, username: 'bob' },
    { id: 3, username: 'carol' }
];

const defaultProps = {
    contacts,
    selectedUser:  null,
    onlineUsers:   [1],           // alice is online
    unreadCounts:  { 2: 3 },      // 3 unread from bob
    onUserClick:   vi.fn(),
    onInitiateCall: vi.fn()
};

describe('ContactList', () => {

    it('renders all contacts', () => {
        render(<ContactList {...defaultProps} />);
        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(screen.getByText('bob')).toBeInTheDocument();
        expect(screen.getByText('carol')).toBeInTheDocument();
    });

    it('shows "Online" for contacts in onlineUsers', () => {
        render(<ContactList {...defaultProps} />);
        // alice (id 1) is in onlineUsers
        const statusLabels = screen.getAllByText('Online');
        expect(statusLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Offline" for contacts not in onlineUsers', () => {
        render(<ContactList {...defaultProps} />);
        // bob (id 2) and carol (id 3) are offline
        const offlineLabels = screen.getAllByText('Offline');
        expect(offlineLabels.length).toBe(2);
    });

    it('shows online count in the header', () => {
        render(<ContactList {...defaultProps} />);
        expect(screen.getByText('1 online')).toBeInTheDocument();
    });

    it('renders unread badge with correct count', () => {
        render(<ContactList {...defaultProps} />);
        expect(screen.getByText('3')).toBeInTheDocument(); // 3 unread from bob
    });

    it('does not render unread badge when count is zero', () => {
        render(<ContactList {...defaultProps} unreadCounts={{ 2: 0 }} />);
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('renders call buttons only for online contacts', () => {
        render(<ContactList {...defaultProps} />);
        // alice is online → should have call buttons
        const audioButtons = screen.getAllByTitle('Audio Call');
        const videoButtons = screen.getAllByTitle('Video Call');
        expect(audioButtons).toHaveLength(1); // only alice
        expect(videoButtons).toHaveLength(1);
    });

    it('calls onUserClick with the contact when a contact is clicked', () => {
        const onUserClick = vi.fn();
        render(<ContactList {...defaultProps} onUserClick={onUserClick} />);

        fireEvent.click(screen.getByText('bob'));

        expect(onUserClick).toHaveBeenCalledWith(contacts[1]); // bob
    });

    it('calls onInitiateCall with the correct contact and call type', () => {
        const onInitiateCall = vi.fn();
        render(<ContactList {...defaultProps} onInitiateCall={onInitiateCall} />);

        fireEvent.click(screen.getByTitle('Audio Call'));

        expect(onInitiateCall).toHaveBeenCalledWith(contacts[0], 'audio'); // alice
    });

    it('clicking a call button does not also trigger onUserClick (stopPropagation)', () => {
        const onUserClick    = vi.fn();
        const onInitiateCall = vi.fn();
        render(<ContactList {...defaultProps} onUserClick={onUserClick} onInitiateCall={onInitiateCall} />);

        fireEvent.click(screen.getByTitle('Audio Call'));

        expect(onInitiateCall).toHaveBeenCalledTimes(1);
        expect(onUserClick).not.toHaveBeenCalled(); // stopPropagation must be called
    });

    it('shows "No other users yet." when contacts array is empty', () => {
        render(<ContactList {...defaultProps} contacts={[]} />);
        expect(screen.getByText('No other users yet.')).toBeInTheDocument();
    });

    it('marks the selected contact as active', () => {
        const { container } = render(
            <ContactList {...defaultProps} selectedUser={contacts[0]} />
        );
        // The first contact item should have the 'active' class
        const items = container.querySelectorAll('.contact-item');
        expect(items[0].classList.contains('active')).toBe(true);
        expect(items[1].classList.contains('active')).toBe(false);
    });
});
