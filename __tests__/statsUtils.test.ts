import { aggregateByYear, getAvailableYears, FinishedBook } from '../utils/statsUtils';

const makeBook = (id: string, total_pages: number, finished_at: string): FinishedBook => ({
  id,
  total_pages,
  finished_at,
});

describe('aggregateByYear', () => {
  it('returns zero totals when no books exist', () => {
    const result = aggregateByYear([], 2025);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('returns 12 monthly entries', () => {
    const result = aggregateByYear([], 2025);
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0].month).toBe(1);
    expect(result.monthly[11].month).toBe(12);
  });

  it('counts books finished in the target year', () => {
    const books = [
      makeBook('1', 300, '2025-03-15T00:00:00Z'),
      makeBook('2', 200, '2025-07-01T00:00:00Z'),
    ];
    const result = aggregateByYear(books, 2025);
    expect(result.totalCount).toBe(2);
  });

  it('sums total_pages for finished books in the target year', () => {
    const books = [
      makeBook('1', 300, '2025-03-15T00:00:00Z'),
      makeBook('2', 200, '2025-07-01T00:00:00Z'),
    ];
    const result = aggregateByYear(books, 2025);
    expect(result.totalPages).toBe(500);
  });

  it('excludes books from other years', () => {
    const books = [
      makeBook('1', 300, '2024-12-31T00:00:00Z'),
      makeBook('2', 200, '2025-01-01T00:00:00Z'),
    ];
    const result = aggregateByYear(books, 2025);
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(200);
  });

  it('aggregates monthly count correctly', () => {
    const books = [
      makeBook('1', 100, '2025-01-10T00:00:00Z'),
      makeBook('2', 150, '2025-01-20T00:00:00Z'),
      makeBook('3', 200, '2025-03-05T00:00:00Z'),
    ];
    const result = aggregateByYear(books, 2025);
    expect(result.monthly[0].count).toBe(2);   // 1月
    expect(result.monthly[1].count).toBe(0);   // 2月
    expect(result.monthly[2].count).toBe(1);   // 3月
  });

  it('aggregates monthly pages correctly', () => {
    const books = [
      makeBook('1', 100, '2025-01-10T00:00:00Z'),
      makeBook('2', 150, '2025-01-20T00:00:00Z'),
    ];
    const result = aggregateByYear(books, 2025);
    expect(result.monthly[0].pages).toBe(250); // 1月
  });

  it('handles books with zero total_pages', () => {
    const books = [makeBook('1', 0, '2025-06-01T00:00:00Z')];
    const result = aggregateByYear(books, 2025);
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(0);
  });
});

describe('getAvailableYears', () => {
  it('returns only current year when no books exist', () => {
    const result = getAvailableYears([], 2025);
    expect(result).toEqual([2025]);
  });

  it('returns range from earliest finished year to current year', () => {
    const books = [
      makeBook('1', 100, '2022-06-01T00:00:00Z'),
      makeBook('2', 200, '2024-01-01T00:00:00Z'),
    ];
    const result = getAvailableYears(books, 2025);
    expect(result).toEqual([2022, 2023, 2024, 2025]);
  });

  it('returns only current year when all books are from current year', () => {
    const books = [makeBook('1', 100, '2025-03-01T00:00:00Z')];
    const result = getAvailableYears(books, 2025);
    expect(result).toEqual([2025]);
  });

  it('returns years in ascending order', () => {
    const books = [
      makeBook('1', 100, '2024-01-01T00:00:00Z'),
      makeBook('2', 100, '2023-01-01T00:00:00Z'),
    ];
    const result = getAvailableYears(books, 2025);
    expect(result).toEqual([2023, 2024, 2025]);
  });

  it('includes current year even if no books are finished in current year', () => {
    const books = [makeBook('1', 100, '2023-06-01T00:00:00Z')];
    const result = getAvailableYears(books, 2025);
    expect(result).toContain(2025);
  });
});
