import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import BookList from '../components/BookList';

const mockBooks = [
  {
    id: '1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    total_pages: 464,
    current_page: 120,
    status: 'reading',
  },
  {
    id: '2',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas',
    total_pages: 352,
    current_page: 352,
    status: 'finished',
  },
  {
    id: '3',
    title: 'Refactoring',
    author: 'Martin Fowler',
    total_pages: 448,
    current_page: 0,
    status: 'unread',
  },
];

describe('BookList', () => {
  // --- Test 1: Renders book list ---
  it('renders book titles and authors', () => {
    render(<BookList books={mockBooks} onBookPress={() => {}} />);

    expect(screen.getByText('Clean Code')).toBeTruthy();
    expect(screen.getByText('Robert C. Martin')).toBeTruthy();
    expect(screen.getByText('The Pragmatic Programmer')).toBeTruthy();
    expect(screen.getByText('Refactoring')).toBeTruthy();
  });

  // --- Test 2: Empty state ---
  it('shows empty message when no books', () => {
    render(<BookList books={[]} onBookPress={() => {}} />);

    expect(screen.getByText(/no books yet/i)).toBeTruthy();
  });

  // --- Test 3: Status tabs ---
  it('renders status filter tabs', () => {
    render(<BookList books={mockBooks} onBookPress={() => {}} />);

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Reading')).toBeTruthy();
    expect(screen.getByText('Finished')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  // --- Test 4: Filter by status ---
  it('filters books when Reading tab is pressed', () => {
    render(<BookList books={mockBooks} onBookPress={() => {}} />);

    fireEvent.press(screen.getByText('Reading'));

    expect(screen.getByText('Clean Code')).toBeTruthy();
    expect(screen.queryByText('The Pragmatic Programmer')).toBeNull();
    expect(screen.queryByText('Refactoring')).toBeNull();
  });

  // --- Test 5: Progress display ---
  it('displays reading progress', () => {
    render(<BookList books={mockBooks} onBookPress={() => {}} />);

    expect(screen.getByText('120 / 464')).toBeTruthy();
    expect(screen.getByText('352 / 352')).toBeTruthy();
  });

  // --- Test 6: Book press callback ---
  it('calls onBookPress with book id when tapped', () => {
    const mockOnBookPress = jest.fn();
    render(<BookList books={mockBooks} onBookPress={mockOnBookPress} />);

    fireEvent.press(screen.getByText('Clean Code'));

    expect(mockOnBookPress).toHaveBeenCalledWith('1');
  });
});
