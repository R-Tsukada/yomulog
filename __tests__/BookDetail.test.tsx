import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import BookDetail from '../components/BookDetail';

const mockFrom = supabase.from as jest.Mock;
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();

const mockBook = {
  id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  total_pages: 464,
  current_page: 120,
  status: 'reading',
};

describe('BookDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ data: {}, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ data: {}, error: null });
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
    });
  });

  // --- Test 1: Book info ---
  it('renders book title, author and progress', () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    expect(screen.getByText('Clean Code')).toBeTruthy();
    expect(screen.getByText('Robert C. Martin')).toBeTruthy();
    expect(screen.getByText('120 / 464')).toBeTruthy();
  });

  // --- Test 2: Update bookmark button ---
  it('renders update bookmark button', () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    expect(screen.getByRole('button', { name: /update bookmark/i })).toBeTruthy();
  });

  // --- Test 3: Update with page input ---
  it('upserts bookmark with entered page number', async () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Page number'), '200');
    fireEvent.press(screen.getByRole('button', { name: /update bookmark/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('bookmarks');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: '1',
          user_id: 'user-1',
          page_number: 200,
        }),
        expect.objectContaining({
          onConflict: 'book_id,user_id,recorded_at',
        }),
      );
    });
  });

  // --- Test 4: Quick buttons ---
  it('adds pages with quick button +5', async () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: '1',
          user_id: 'user-1',
          page_number: 125,
        }),
        expect.objectContaining({
          onConflict: 'book_id,user_id,recorded_at',
        }),
      );
    });
  });

  it('adds pages with quick button +10', async () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+10'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: '1',
          user_id: 'user-1',
          page_number: 130,
        }),
        expect.objectContaining({
          onConflict: 'book_id,user_id,recorded_at',
        }),
      );
    });
  });

  it('adds pages with quick button +20', async () => {
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+20'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: '1',
          user_id: 'user-1',
          page_number: 140,
        }),
        expect.objectContaining({
          onConflict: 'book_id,user_id,recorded_at',
        }),
      );
    });
  });

  // --- Test 5: Callback after update ---
  it('calls onBookmarkUpdate after successful bookmark update', async () => {
    const mockOnUpdate = jest.fn();
    render(<BookDetail book={mockBook} userId="user-1" onBookmarkUpdate={mockOnUpdate} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

// --- Test: Auto status update to reading ---
  it('updates book status to reading when page > 0', async () => {
    const unreadBook = { ...mockBook, current_page: 0, status: 'unread' };
    render(<BookDetail book={unreadBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockUpdate).toHaveBeenCalledWith({
        current_page: 5,
        status: 'reading',
      });
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });

  // --- Test: Auto status update to finished ---
  it('updates book status to finished when reaching total pages', async () => {
    const almostDoneBook = { ...mockBook, current_page: 460, total_pages: 464 };
    render(<BookDetail book={almostDoneBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_page: 464,
          status: 'finished',
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });

  // --- Test: sets finished_at when status becomes finished ---
  it('sets finished_at when status becomes finished', async () => {
    const almostDoneBook = { ...mockBook, current_page: 460, total_pages: 464 };
    render(<BookDetail book={almostDoneBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          finished_at: expect.any(String),
        })
      );
    });
  });

  // --- Test: does not overwrite finished_at if already set ---
  it('does not overwrite finished_at if already set', async () => {
    const alreadyFinishedBook = {
      ...mockBook,
      current_page: 460,
      total_pages: 464,
      finished_at: '2025-01-01T00:00:00Z',
    };
    render(<BookDetail book={alreadyFinishedBook} userId="user-1" onBookmarkUpdate={() => {}} />);

    fireEvent.press(screen.getByText('+5'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          finished_at: expect.any(String),
        })
      );
    });
  });
});
