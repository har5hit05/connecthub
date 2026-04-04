/**
 * MessageList.test.jsx
 * Tests for the MessageList component.
 *
 * MessageList renders: a "load older messages" button (when hasMoreMessages),
 * message bubbles (text + file attachments), a typing indicator,
 * and a scroll anchor at the bottom.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageList from './MessageList';

// Default props — gives a clean baseline for each test to override
const defaultProps = {
    messages:        [],
    currentUserId:   1,
    isTyping:        false,
    hasMoreMessages: false,
    isLoadingMore:   false,
    onLoadMore:      vi.fn(),
    messagesEndRef:  { current: null },
    messagesListRef: { current: null }
};

const makeMsg = (overrides = {}) => ({
    id:              1,
    sender_id:       1,
    receiver_id:     2,
    message:         'Hello!',
    file_url:        null,
    file_type:       null,
    file_name:       null,
    created_at:      '2024-01-01T12:00:00.000Z',
    sender_username: 'alice',
    ...overrides
});

describe('MessageList', () => {

    describe('load-more button', () => {
        it('is hidden when hasMoreMessages is false', () => {
            render(<MessageList {...defaultProps} hasMoreMessages={false} />);
            expect(screen.queryByText('Load older messages')).not.toBeInTheDocument();
        });

        it('is visible when hasMoreMessages is true', () => {
            render(<MessageList {...defaultProps} hasMoreMessages={true} />);
            expect(screen.getByText('Load older messages')).toBeInTheDocument();
        });

        it('shows "Loading..." and is disabled while isLoadingMore is true', () => {
            render(<MessageList {...defaultProps} hasMoreMessages={true} isLoadingMore={true} />);
            const btn = screen.getByRole('button', { name: 'Loading...' });
            expect(btn).toBeDisabled();
        });

        it('calls onLoadMore when the button is clicked', () => {
            const onLoadMore = vi.fn();
            render(<MessageList {...defaultProps} hasMoreMessages={true} onLoadMore={onLoadMore} />);

            fireEvent.click(screen.getByText('Load older messages'));

            expect(onLoadMore).toHaveBeenCalledTimes(1);
        });
    });

    describe('message bubbles', () => {
        it('renders a text message', () => {
            const messages = [makeMsg({ message: 'Hello world!' })];
            render(<MessageList {...defaultProps} messages={messages} />);
            expect(screen.getByText('Hello world!')).toBeInTheDocument();
        });

        it('applies "mine" class when sender_id matches currentUserId', () => {
            const messages = [makeMsg({ sender_id: 1, message: 'my msg' })];
            const { container } = render(<MessageList {...defaultProps} messages={messages} currentUserId={1} />);
            expect(container.querySelector('.message.mine')).toBeInTheDocument();
        });

        it('applies "theirs" class when sender_id does not match currentUserId', () => {
            const messages = [makeMsg({ sender_id: 2, message: 'their msg' })];
            const { container } = render(<MessageList {...defaultProps} messages={messages} currentUserId={1} />);
            expect(container.querySelector('.message.theirs')).toBeInTheDocument();
        });

        it('renders multiple messages', () => {
            const messages = [
                makeMsg({ id: 1, message: 'First' }),
                makeMsg({ id: 2, message: 'Second' }),
                makeMsg({ id: 3, message: 'Third' })
            ];
            render(<MessageList {...defaultProps} messages={messages} />);
            expect(screen.getByText('First')).toBeInTheDocument();
            expect(screen.getByText('Second')).toBeInTheDocument();
            expect(screen.getByText('Third')).toBeInTheDocument();
        });

        it('renders an image attachment', () => {
            const messages = [makeMsg({
                id:       2,
                message:  null,
                file_url: '/uploads/chat/test.jpg',
                file_type:'image/jpeg',
                file_name:'test.jpg'
            })];
            render(<MessageList {...defaultProps} messages={messages} />);
            const img = screen.getByRole('img', { name: 'test.jpg' });
            expect(img).toBeInTheDocument();
            expect(img.src).toContain('/uploads/chat/test.jpg');
        });

        it('renders a generic file attachment link', () => {
            const messages = [makeMsg({
                id:        3,
                message:   null,
                file_url:  '/uploads/chat/report.pdf',
                file_type: 'application/pdf',
                file_name: 'report.pdf'
            })];
            render(<MessageList {...defaultProps} messages={messages} />);
            expect(screen.getByText('report.pdf')).toBeInTheDocument();
        });

        it('formats the timestamp', () => {
            // 2024-01-01T12:00:00Z → "12:00 PM" (local time — just check it renders)
            const messages = [makeMsg({ created_at: '2024-01-01T12:00:00.000Z' })];
            render(<MessageList {...defaultProps} messages={messages} />);
            // The formatted time should include AM or PM
            expect(screen.getByText(/\d+:\d+ (AM|PM)/)).toBeInTheDocument();
        });
    });

    describe('typing indicator', () => {
        it('is not shown when isTyping is false', () => {
            render(<MessageList {...defaultProps} isTyping={false} />);
            expect(document.querySelector('.typing-bubble')).toBeNull();
        });

        it('is shown when isTyping is true', () => {
            render(<MessageList {...defaultProps} isTyping={true} />);
            expect(document.querySelector('.typing-bubble')).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('renders nothing in the list when messages array is empty', () => {
            const { container } = render(<MessageList {...defaultProps} messages={[]} />);
            expect(container.querySelectorAll('.message')).toHaveLength(0);
        });
    });
});
