/**
 * MessageInput.test.jsx
 * Tests for the MessageInput component.
 *
 * MessageInput handles: text input with typing events, file selection/preview,
 * and message sending (text-only and text+file) via the sendMessage callback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageInput from './MessageInput';

const defaultProps = {
    selectedUser: { id: 2, username: 'bob' },
    sendMessage:  vi.fn(),
    startTyping:  vi.fn(),
    stopTyping:   vi.fn()
};

describe('MessageInput', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('text input', () => {
        it('renders the text input with correct placeholder', () => {
            render(<MessageInput {...defaultProps} />);
            expect(screen.getByPlaceholderText('Message bob...')).toBeInTheDocument();
        });

        it('updates the input value as the user types', async () => {
            render(<MessageInput {...defaultProps} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'Hello');

            expect(input.value).toBe('Hello');
        });

        it('calls startTyping when the user types', async () => {
            const startTyping = vi.fn();
            render(<MessageInput {...defaultProps} startTyping={startTyping} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'H');

            expect(startTyping).toHaveBeenCalledWith(2); // selectedUser.id
        });

        it('calls sendMessage and clears input when Send button is clicked', async () => {
            const sendMessage = vi.fn();
            render(<MessageInput {...defaultProps} sendMessage={sendMessage} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'Hello');
            fireEvent.click(screen.getByText('Send'));

            expect(sendMessage).toHaveBeenCalledWith(2, 'Hello');
            expect(input.value).toBe('');
        });

        it('calls sendMessage when Enter is pressed', async () => {
            const sendMessage = vi.fn();
            render(<MessageInput {...defaultProps} sendMessage={sendMessage} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'Hello{Enter}');

            expect(sendMessage).toHaveBeenCalledWith(2, 'Hello');
        });

        it('does not call sendMessage when Shift+Enter is pressed', async () => {
            const sendMessage = vi.fn();
            render(<MessageInput {...defaultProps} sendMessage={sendMessage} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'Hello');
            fireEvent.keyPress(input, { key: 'Enter', shiftKey: true, charCode: 13 });

            expect(sendMessage).not.toHaveBeenCalled();
        });

        it('does not call sendMessage when input is empty', () => {
            const sendMessage = vi.fn();
            render(<MessageInput {...defaultProps} sendMessage={sendMessage} />);

            fireEvent.click(screen.getByText('Send'));

            expect(sendMessage).not.toHaveBeenCalled();
        });

        it('does not call sendMessage when input is only whitespace', async () => {
            const sendMessage = vi.fn();
            render(<MessageInput {...defaultProps} sendMessage={sendMessage} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, '   ');
            fireEvent.click(screen.getByText('Send'));

            expect(sendMessage).not.toHaveBeenCalled();
        });

        it('Send button is disabled when input is empty', () => {
            render(<MessageInput {...defaultProps} />);
            expect(screen.getByText('Send')).toBeDisabled();
        });

        it('Send button is enabled when input has text', async () => {
            render(<MessageInput {...defaultProps} />);
            const input = screen.getByPlaceholderText('Message bob...');

            await userEvent.type(input, 'Hi');

            expect(screen.getByText('Send')).not.toBeDisabled();
        });
    });

    describe('file attachment', () => {
        it('renders the attach button', () => {
            render(<MessageInput {...defaultProps} />);
            expect(screen.getByTitle('Attach file')).toBeInTheDocument();
        });

        it('shows file preview bar when a non-image file is selected', async () => {
            render(<MessageInput {...defaultProps} />);
            const fileInput = document.querySelector('input[type="file"]');

            const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
            await userEvent.upload(fileInput, file);

            expect(screen.getByText('report.pdf')).toBeInTheDocument();
        });

        it('shows an image preview for image files', async () => {
            render(<MessageInput {...defaultProps} />);
            const fileInput = document.querySelector('input[type="file"]');

            const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
            await userEvent.upload(fileInput, file);

            expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        });

        it('removes the file preview when the remove button is clicked', async () => {
            render(<MessageInput {...defaultProps} />);
            const fileInput = document.querySelector('input[type="file"]');

            const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
            await userEvent.upload(fileInput, file);

            expect(screen.getByText('doc.pdf')).toBeInTheDocument();

            fireEvent.click(screen.getByTitle('Remove file'));

            expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
        });

        it('changes placeholder text when a file is selected', async () => {
            render(<MessageInput {...defaultProps} />);
            const fileInput = document.querySelector('input[type="file"]');

            const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
            await userEvent.upload(fileInput, file);

            expect(screen.getByPlaceholderText('Add a caption...')).toBeInTheDocument();
        });
    });
});
