import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../services/bookSearch', () => ({
  searchByISBN: jest.fn(),
}));

jest.mock('../components/BarcodeScanner', () => {
  return function MockBarcodeScanner() {
    return null;
  };
});

import { searchByISBN } from '../services/bookSearch';
import ISBNSearch from '../components/ISBNSearch';

const mockSearchByISBN = searchByISBN as jest.Mock;

describe('ISBNSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ISBN input and search button', () => {
    render(<ISBNSearch onBookFound={() => {}} />);

    expect(screen.getByPlaceholderText('ISBN')).toBeTruthy();
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy();
  });

  it('renders scan barcode button', () => {
    render(<ISBNSearch onBookFound={() => {}} />);

    expect(screen.getByText(/scan barcode/i)).toBeTruthy();
  });

  it('disables search button when input is empty', () => {
    render(<ISBNSearch onBookFound={() => {}} />);

    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('shows book info when found', async () => {
    mockSearchByISBN.mockResolvedValueOnce({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      coverUrl: null,
    });

    render(<ISBNSearch onBookFound={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('ISBN'), '9780132350884');
    fireEvent.press(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Code')).toBeTruthy();
      expect(screen.getByText('Robert C. Martin')).toBeTruthy();
      expect(screen.getByText('464 pages')).toBeTruthy();
    });
  });

  it('shows not found message when ISBN has no results', async () => {
    mockSearchByISBN.mockResolvedValueOnce(null);

    render(<ISBNSearch onBookFound={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('ISBN'), '0000000000');
    fireEvent.press(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no book found/i)).toBeTruthy();
    });
  });

  it('renders add button when book is found', async () => {
    mockSearchByISBN.mockResolvedValueOnce({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      coverUrl: null,
    });

    render(<ISBNSearch onBookFound={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('ISBN'), '9780132350884');
    fireEvent.press(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to library/i })).toBeTruthy();
    });
  });

  it('calls onBookFound with book data when add is pressed', async () => {
    const bookData = {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      coverUrl: null,
    };
    mockSearchByISBN.mockResolvedValueOnce(bookData);
    const mockOnBookFound = jest.fn();

    render(<ISBNSearch onBookFound={mockOnBookFound} />);

    fireEvent.changeText(screen.getByPlaceholderText('ISBN'), '9780132350884');
    fireEvent.press(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      fireEvent.press(screen.getByRole('button', { name: /add to library/i }));
    });

    expect(mockOnBookFound).toHaveBeenCalledWith(bookData);
  });
});
