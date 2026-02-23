type BookSearchResult = {
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
};

// Japanese books: NDL thumbnail
function getNDLCover(isbn: string): string {
  return `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`;
}

// International books: Open Library cover
function getOpenLibraryCover(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
}

// Japanese books (OpenBD)
async function searchOpenBD(isbn: string): Promise<BookSearchResult | null> {
  try {
    const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    const data = await response.json();

    if (!data || !data[0]) return null;

    const summary = data[0].summary;
    if (!summary) return null;

    return {
      title: summary.title ?? '',
      author: (summary.author ?? '').replace(/\//g, ' ').trim(),
      totalPages: 0,
      coverUrl: summary.cover || getNDLCover(isbn),
    };
  } catch {
    return null;
  }
}

// International books (Open Library)
async function searchOpenLibrary(isbn: string): Promise<BookSearchResult | null> {
  try {
    const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);

    if (!response.ok) return null;

    const data = await response.json();

    let author = '';
    if (data.authors && data.authors.length > 0) {
      try {
        const authorRes = await fetch(
          `https://openlibrary.org${data.authors[0].key}.json`
        );
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          author = authorData.name ?? '';
        }
      } catch {
        // continue without author
      }
    }

    return {
      title: data.title ?? '',
      author,
      totalPages: data.number_of_pages ?? 0,
      coverUrl: data.covers
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
        : getOpenLibraryCover(isbn),
    };
  } catch {
    return null;
  }
}

export async function searchByISBN(isbn: string): Promise<BookSearchResult | null> {
  const cleanISBN = isbn.replace(/[-\s]/g, '');

  const openBDResult = await searchOpenBD(cleanISBN);
  if (openBDResult) return openBDResult;

  const openLibResult = await searchOpenLibrary(cleanISBN);
  if (openLibResult) return openLibResult;

  return null;
}
