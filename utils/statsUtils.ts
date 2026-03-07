export type FinishedBook = {
  id: string;
  total_pages: number;
  finished_at: string;
};

export type MonthlyStats = {
  month: number;
  count: number;
  pages: number;
};

export type YearlyStats = {
  totalCount: number;
  totalPages: number;
  monthly: MonthlyStats[];
};

export function aggregateByYear(books: FinishedBook[], year: number): YearlyStats {
  const monthly: MonthlyStats[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: 0,
    pages: 0,
  }));

  let totalCount = 0;
  let totalPages = 0;

  for (const book of books) {
    const date = new Date(book.finished_at);
    if (date.getUTCFullYear() !== year) continue;
    const monthIndex = date.getUTCMonth();
    monthly[monthIndex].count += 1;
    monthly[monthIndex].pages += book.total_pages;
    totalCount += 1;
    totalPages += book.total_pages;
  }

  return { totalCount, totalPages, monthly };
}

export function getAvailableYears(books: FinishedBook[], currentYear: number): number[] {
  if (books.length === 0) return [currentYear];

  const years = books
    .filter(b => b.finished_at)
    .map(b => new Date(b.finished_at).getUTCFullYear());

  const minYear = Math.min(...years);
  const result: number[] = [];
  for (let y = minYear; y <= currentYear; y++) {
    result.push(y);
  }
  return result;
}
