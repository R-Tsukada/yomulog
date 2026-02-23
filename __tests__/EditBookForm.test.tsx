import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import EditBookForm from '../components/EditBookForm';

const mockFrom = supabase.from as jest.Mock;
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();

const mockBook = {
  id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  total_pages: 464,
  current_page: 120,
  status: 'reading',
};

describe('EditBookForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ data: {}, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({
      update: mockUpdate,
      delete: mockDelete,
    });
  });

  // --- Test 1: Pre-filled form ---
  it('renders form with existing book data', () => {
    render(<EditBookForm book={mockBook} onSuccess={() => {}} onDelete={() => {}} />);

    expect(screen.getByDisplayValue('Clean Code')).toBeTruthy();
    expect(screen.getByDisplayValue('Robert C. Martin')).toBeTruthy();
    expect(screen.getByDisplayValue('464')).toBeTruthy();
  });

  // --- Test 2: Save update ---
  it('calls supabase update with modified data', async () => {
    render(<EditBookForm book={mockBook} onSuccess={() => {}} onDelete={() => {}} />);

    fireEvent.changeText(screen.getByDisplayValue('Clean Code'), 'Clean Code 2nd Edition');
    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockUpdate).toHaveBeenCalledWith({
        title: 'Clean Code 2nd Edition',
        author: 'Robert C. Martin',
        total_pages: 464,
      });
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });

  // --- Test 3: onSuccess callback ---
  it('calls onSuccess after successful save', async () => {
    const mockOnSuccess = jest.fn();
    render(<EditBookForm book={mockBook} onSuccess={mockOnSuccess} onDelete={() => {}} />);

    fireEvent.press(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  // --- Test 4: Delete button exists ---
  it('renders delete button', () => {
    render(<EditBookForm book={mockBook} onSuccess={() => {}} onDelete={() => {}} />);

    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  // --- Test 5: Delete confirmation ---
  it('shows confirmation message when delete is pressed', () => {
    render(<EditBookForm book={mockBook} onSuccess={() => {}} onDelete={() => {}} />);

    fireEvent.press(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText(/are you sure/i)).toBeTruthy();
  });

  // --- Test 6: Delete execution ---
  it('calls supabase delete after confirmation', async () => {
    render(<EditBookForm book={mockBook} onSuccess={() => {}} onDelete={() => {}} />);

    fireEvent.press(screen.getByRole('button', { name: /delete/i }));
    fireEvent.press(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });
});
