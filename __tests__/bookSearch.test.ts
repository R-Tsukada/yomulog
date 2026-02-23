import { searchByISBN } from '../services/bookSearch';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('searchByISBN', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns book data from OpenBD for Japanese books', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{
        summary: {
          title: 'リーダブルコード',
          author: 'Dustin/Boswell',
          cover: 'https://cover.openbd.jp/1234.jpg',
        },
      }]),
    });

    const result = await searchByISBN('9784873115658');

    expect(result).toEqual({
      title: 'リーダブルコード',
      author: 'Dustin Boswell',
      totalPages: 0,
      coverUrl: 'https://cover.openbd.jp/1234.jpg',
    });
  });

  it('falls back to Open Library when OpenBD has no result', async () => {
    // OpenBD returns null
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [null],
    });
    // Open Library book data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        title: 'Clean Code',
        authors: [{ key: '/authors/OL123A' }],
        number_of_pages: 464,
        covers: [12345],
      }),
    });
    // Open Library author data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Robert C. Martin' }),
    });

    const result = await searchByISBN('9780132350884');

    expect(result).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
    });
  });

  it('returns null when both APIs have no result', async () => {
    // OpenBD returns null
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [null],
    });
    // Open Library returns not found
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await searchByISBN('0000000000');

    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await searchByISBN('9780132350884');

    expect(result).toBeNull();
  });

  it('strips hyphens from ISBN', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{
        summary: {
          title: 'テスト本',
          author: 'テスト著者',
          cover: '',
        },
      }]),
    });

    await searchByISBN('978-4-87311-565-8');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('9784873115658')
    );
  });
});
