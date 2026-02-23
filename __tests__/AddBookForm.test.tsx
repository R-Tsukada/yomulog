import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import AddBookForm from '../components/AddBookForm';

const mockInsert = jest.fn();
const mockFrom = supabase.from as jest.Mock;

describe('AddBookForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  // --- Test 1: Rendering ---
  it('renders title, author, total pages inputs and save button', () => {
    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    expect(screen.getByPlaceholderText('Title')).toBeTruthy();
    expect(screen.getByPlaceholderText('Author')).toBeTruthy();
    expect(screen.getByPlaceholderText('Total Pages')).toBeTruthy();
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });

  // --- Test 2: Empty form ---
  it('disables save button when title is empty', () => {
    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
  });

  // --- Test 3: Title required ---
  it('keeps save button disabled when only other fields are filled', () => {
    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Author'), 'Robert C. Martin');
    fireEvent.changeText(screen.getByPlaceholderText('Total Pages'), '200');

    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
  });

  // --- Test 4: Total Pages must be numeric ---
  it('shows error when total pages is not a number', async () => {
    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Clean Code');
    fireEvent.changeText(screen.getByPlaceholderText('Total Pages'), 'abc');
    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid number/i)).toBeTruthy();
    });
  });

  // --- Test 5: Successful save ---
  it('calls supabase insert with correct data', async () => {
    mockInsert.mockResolvedValueOnce({ data: {}, error: null });

    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Clean Code');
    fireEvent.changeText(screen.getByPlaceholderText('Author'), 'Robert C. Martin');
    fireEvent.changeText(screen.getByPlaceholderText('Total Pages'), '464');
    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        total_pages: 464,
        status: 'unread',
      });
    });
  });

  // --- Test 6: Failed save ---
  it('displays error message on failed save', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Insert failed' },
    });

    render(<AddBookForm userId="test-user-id" onSuccess={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Clean Code');
    fireEvent.changeText(screen.getByPlaceholderText('Total Pages'), '464');
    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/insert failed/i)).toBeTruthy();
    });
  });

  // --- Test 7: onSuccess callback ---
  it('calls onSuccess after successful save', async () => {
    mockInsert.mockResolvedValueOnce({ data: {}, error: null });
    const mockOnSuccess = jest.fn();

    render(<AddBookForm userId="test-user-id" onSuccess={mockOnSuccess} />);

    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Clean Code');
    fireEvent.changeText(screen.getByPlaceholderText('Total Pages'), '464');
    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
