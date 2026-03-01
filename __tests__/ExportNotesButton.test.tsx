import React from 'react';
import { Alert, Share } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-file-system/next', () => ({
  File: jest.fn(),
  Paths: { cache: { uri: 'file:///cache/' } },
}));

import { File, Paths } from 'expo-file-system/next';
import ExportNotesButton from '../components/ExportNotesButton';

const MockFile = File as jest.Mock;

const mockFileInstance = {
  uri: '',
  write: jest.fn(),
  delete: jest.fn(),
};

const mockBook = { title: 'Clean Code', author: 'Robert C. Martin' };
const mockNotes = [
  { id: '1', page_number: 10, content: 'Note on page 10', is_bookmarked: false },
  { id: '2', page_number: 42, content: 'Bookmarked note', is_bookmarked: true },
  { id: '3', page_number: 100, content: 'Another note', is_bookmarked: false },
];
const noBookmarkNotes = mockNotes.map(n => ({ ...n, is_bookmarked: false }));

describe('ExportNotesButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFileInstance.write.mockReset();
    mockFileInstance.delete.mockReset();
    MockFile.mockImplementation((dir: { uri: string }, filename: string) => {
      mockFileInstance.uri = `${dir.uri}${filename}`;
      return mockFileInstance;
    });
  });

  // 1. ボタン表示
  it('renders "Export Notes" button', () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    expect(screen.getByRole('button', { name: /Export Notes/i })).toBeTruthy();
  });

  // 2. メモ0件でボタンが disabled
  it('disables button when notes array is empty', () => {
    render(<ExportNotesButton book={mockBook} notes={[]} />);
    expect(screen.getByRole('button', { name: /Export Notes/i })).toBeDisabled();
  });

  // 3. メモあり → ボタンが enabled
  it('enables button when notes exist', () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    expect(screen.getByRole('button', { name: /Export Notes/i })).not.toBeDisabled();
  });

  // 4. エクスポート中はボタンが disabled
  it('disables button while exporting', async () => {
    jest.spyOn(Share, 'share').mockImplementation(() => new Promise(() => {}));

    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export Notes/i })).toBeDisabled();
    });
  });

  // 5. ブックマーク済みメモがある場合はそれのみエクスポート
  it('exports only bookmarked notes when bookmarks exist', async () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      const written = mockFileInstance.write.mock.calls[0][0] as string;
      expect(written).toContain('Bookmarked note');
      expect(written).not.toContain('Note on page 10');
      expect(written).not.toContain('Another note');
    });
  });

  // 6. ブックマークが0件なら全メモをエクスポート
  it('exports all notes when no bookmarked notes exist', async () => {
    render(<ExportNotesButton book={mockBook} notes={noBookmarkNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      const written = mockFileInstance.write.mock.calls[0][0] as string;
      expect(written).toContain('Note on page 10');
      expect(written).toContain('Bookmarked note');
      expect(written).toContain('Another note');
    });
  });

  // 7. Obsidian frontmatter が含まれる
  it('includes Obsidian frontmatter in generated markdown', async () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      const written = mockFileInstance.write.mock.calls[0][0] as string;
      expect(written).toContain('---');
      expect(written).toContain('aliases:');
      expect(written).toContain(`  - ${mockBook.title}`);
      expect(written).toContain(`author: ${mockBook.author}`);
      expect(written).toContain('created:');
    });
  });

  // 8. 著者未設定の場合は "Unknown" を使う
  it('uses "Unknown" when author is not set', async () => {
    render(<ExportNotesButton book={{ title: 'No Author Book', author: null }} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      const written = mockFileInstance.write.mock.calls[0][0] as string;
      expect(written).toContain('author: Unknown');
      expect(written).toContain('Author: Unknown');
    });
  });

  // 9. ファイル名の特殊文字がアンダースコアに置換される
  it('sanitizes special characters in filename', async () => {
    render(<ExportNotesButton book={{ title: 'Book: A/B', author: 'Author' }} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(MockFile).toHaveBeenCalledWith(
        Paths.cache,
        expect.stringContaining('Book_ A_B'),
      );
    });
  });

  // 10. File コンストラクタが Paths.cache と .md ファイル名で呼ばれる
  it('creates File with Paths.cache and a .md filename', async () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(MockFile).toHaveBeenCalledWith(
        Paths.cache,
        expect.stringMatching(/\.md$/),
      );
    });
  });

  // 11. Share.share が file.uri のみで呼ばれる
  it('calls Share.share with only the file uri', async () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith({
        url: mockFileInstance.uri,
      });
    });
  });

  // 12. 共有後に file.delete() が呼ばれる
  it('calls file.delete() after sharing to clean up temp file', async () => {
    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(mockFileInstance.delete).toHaveBeenCalled();
    });
  });

  // 13. Share.share が失敗したらアラートを表示
  it('shows Alert when Share.share throws an error', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('sharing not available'));

    render(<ExportNotesButton book={mockBook} notes={mockNotes} />);
    fireEvent.press(screen.getByRole('button', { name: /Export Notes/i }));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Export is not supported on this device.');
    });
  });
});
