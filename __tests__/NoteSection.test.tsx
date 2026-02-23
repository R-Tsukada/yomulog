import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import NoteSection from '../components/NoteSection';

const mockFrom = supabase.from as jest.Mock;
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();

const mockNotes = [
  { id: '1', page_number: 42, content: 'Great insight on refactoring', created_at: '2025-01-01T00:00:00Z' },
  { id: '2', page_number: 108, content: 'Interesting pattern here', created_at: '2025-01-02T00:00:00Z' },
];

describe('NoteSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ data: {}, error: null });
    mockInsert.mockResolvedValue({ data: {}, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
  });

  // --- Existing Tests ---

  it('renders note content and page numbers', () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    expect(screen.getByText('Great insight on refactoring')).toBeTruthy();
    expect(screen.getByText('Interesting pattern here')).toBeTruthy();
    expect(screen.getByText(/p\.42/i)).toBeTruthy();
    expect(screen.getByText(/p\.108/i)).toBeTruthy();
  });

  it('shows empty message when no notes', () => {
    render(
      <NoteSection notes={[]} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    expect(screen.getByText(/no notes yet/i)).toBeTruthy();
  });

  it('renders page and note inputs and add note button', () => {
    render(
      <NoteSection notes={[]} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    expect(screen.getByPlaceholderText('Page')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a note...')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add note/i })).toBeTruthy();
  });

  it('disables add note button when note is empty', () => {
    render(
      <NoteSection notes={[]} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    const button = screen.getByRole('button', { name: /add note/i });
    expect(button).toBeDisabled();
  });

  it('calls supabase insert with correct data', async () => {
    render(
      <NoteSection notes={[]} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Page'), '55');
    fireEvent.changeText(screen.getByPlaceholderText('Write a note...'), 'Key takeaway');
    fireEvent.press(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('reading_notes');
      expect(mockInsert).toHaveBeenCalledWith({
        book_id: 'book-1',
        user_id: 'user-1',
        page_number: 55,
        content: 'Key takeaway',
      });
    });
  });

  it('calls onNoteAdded after successful insert', async () => {
    const mockOnNoteAdded = jest.fn();

    render(
      <NoteSection notes={[]} bookId="book-1" userId="user-1" onNoteAdded={mockOnNoteAdded} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Page'), '55');
    fireEvent.changeText(screen.getByPlaceholderText('Write a note...'), 'Key takeaway');
    fireEvent.press(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => {
      expect(mockOnNoteAdded).toHaveBeenCalled();
    });
  });

  // --- New Tests: Edit & Delete ---

  it('renders edit and delete buttons for each note', () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    expect(screen.getAllByText('Edit')).toHaveLength(2);
    expect(screen.getAllByText('Delete')).toHaveLength(2);
  });

  it('switches to edit mode with note content pre-filled', () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    fireEvent.press(screen.getAllByText('Edit')[0]);

    expect(screen.getByDisplayValue('Great insight on refactoring')).toBeTruthy();
    expect(screen.getByDisplayValue('42')).toBeTruthy();
    expect(screen.getByRole('button', { name: /save edit/i })).toBeTruthy();
  });

  it('calls supabase update when saving edit', async () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    fireEvent.press(screen.getAllByText('Edit')[0]);
    fireEvent.changeText(screen.getByDisplayValue('Great insight on refactoring'), 'Updated note');
    fireEvent.press(screen.getByRole('button', { name: /save edit/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('reading_notes');
      expect(mockUpdate).toHaveBeenCalledWith({
        content: 'Updated note',
        page_number: 42,
      });
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });

  it('calls onNoteAdded after successful edit', async () => {
    const mockOnNoteAdded = jest.fn();

    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={mockOnNoteAdded} />
    );

    fireEvent.press(screen.getAllByText('Edit')[0]);
    fireEvent.press(screen.getByRole('button', { name: /save edit/i }));

    await waitFor(() => {
      expect(mockOnNoteAdded).toHaveBeenCalled();
    });
  });

  it('shows confirmation when delete is pressed', () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    fireEvent.press(screen.getAllByText('Delete')[0]);

    expect(screen.getByText(/delete this note/i)).toBeTruthy();
  });

  it('calls supabase delete after confirmation', async () => {
    render(
      <NoteSection notes={mockNotes} bookId="book-1" userId="user-1" onNoteAdded={() => {}} />
    );

    fireEvent.press(screen.getAllByText('Delete')[0]);
    fireEvent.press(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('reading_notes');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });
});
