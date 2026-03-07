import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: jest.fn(),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/supabase');

// react-native-purchases のモック（_layout.tsx 経由で参照されるケースに備えて）
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { mockFrom } from '../lib/supabase';
import StatsScreen from '../app/(tabs)/stats';

const mockUseSubscription = useSubscription as jest.Mock;
const mockUseAuth         = useAuth as jest.Mock;

const mockSession = { user: { id: 'user-123' } };

/** Supabase books クエリチェーンのモック */
function setupBooksQueryMock(books: object[]) {
  const mockResolve = jest.fn().mockResolvedValue({ data: books, error: null });
  const mockNot     = jest.fn().mockReturnValue(mockResolve());
  const mockEq2     = jest.fn().mockReturnValue({ not: mockNot });
  const mockEq1     = jest.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect  = jest.fn().mockReturnValue({ eq: mockEq1 });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// 現在年のデータ（StatsScreen の CURRENT_YEAR と合わせる）
const CURRENT_YEAR = new Date().getFullYear();
const finishedBooks = [
  { id: '1', total_pages: 300, finished_at: `${CURRENT_YEAR}-03-10T00:00:00Z` },
  { id: '2', total_pages: 200, finished_at: `${CURRENT_YEAR}-07-05T00:00:00Z` },
];

describe('StatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: mockSession });
  });

  // --- ローディング状態 ---
  it('shows loading indicator while subscription status is loading', () => {
    mockUseSubscription.mockReturnValue({ isLoading: true, isSubscribed: false });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    expect(screen.getByTestId('stats-loading')).toBeTruthy();
  });

  // --- Paywall ---
  it('shows paywall when not subscribed', () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: false });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    expect(screen.getByTestId('stats-paywall')).toBeTruthy();
  });

  it('shows subscribe button in paywall', () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: false });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeTruthy();
  });

  it('shows restore purchases button in paywall', () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: false });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    expect(screen.getByRole('button', { name: /restore/i })).toBeTruthy();
  });

  // --- Stats コンテンツ ---
  it('shows stats content when subscribed', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock(finishedBooks);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('stats-content')).toBeTruthy();
    });
  });

  it('shows total book count for the year', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock(finishedBooks);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeTruthy();
    });
  });

  it('shows total pages for the year', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock(finishedBooks);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('500p')).toBeTruthy();
    });
  });

  it('shows current year in navigation', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock(finishedBooks);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText(String(CURRENT_YEAR))).toBeTruthy();
    });
  });

  it('shows year navigation even when there are no finished books', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText(String(CURRENT_YEAR))).toBeTruthy();
    });
  });

  it('shows 0冊 when there are no finished books', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  it('shows 0p when there are no finished books', async () => {
    mockUseSubscription.mockReturnValue({ isLoading: false, isSubscribed: true });
    setupBooksQueryMock([]);

    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('0p')).toBeTruthy();
    });
  });
});
