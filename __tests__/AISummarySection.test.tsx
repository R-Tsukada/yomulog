import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import AISummarySection from '../components/AISummarySection';

const mockFrom = supabase.from as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;

function setupFetchSummaryMock(data: object | null) {
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  const mockEqBookId = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqBookId });
  mockFrom.mockReturnValue({ select: mockSelect });
  return { mockMaybeSingle, mockEqBookId, mockSelect };
}

const mockSummaryData = {
  summary: 'A great book about clean coding',
  learnings: ['Write small functions', 'Use good names'],
  quotes: ['Clean code reads like prose'],
  detected_lang: 'en',
  prompt_version: 'v1',
  token_count: 1000,
  updated_at: '2026-02-23T00:00:00Z',
  is_processing: false,
};

describe('AISummarySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFetchSummaryMock(null);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        summary: 'Test summary',
        learnings: ['Learning 1'],
        quotes: ['Quote 1'],
        detectedLang: 'en',
        promptVersion: 'v1',
        tokenCount: 500,
        createdAt: '2026-02-23T00:00:00Z',
      }),
    });
  });

  // 1. ボタン表示
  it('renders "AIで整理する" button after initial load', async () => {
    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /AIで整理する/i })).toBeTruthy();
    });
  });

  // 2. メモ0件でボタンが disabled
  it('disables button when there are no notes', async () => {
    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={0} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /AIで整理する/i })).toBeDisabled();
    });
  });

  // 3. メモ0件でヒントテキスト表示
  it('shows hint text when notesCount is 0', async () => {
    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={0} />);

    await waitFor(() => {
      expect(screen.getByText(/メモを追加してからAI整理できます/i)).toBeTruthy();
    });
  });

  // 4. マウント時に既存サマリーを表示
  it('shows existing summary on mount when available', async () => {
    setupFetchSummaryMock(mockSummaryData);

    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);

    await waitFor(() => {
      expect(screen.getByText('A great book about clean coding')).toBeTruthy();
      expect(screen.getByText(/Write small functions/)).toBeTruthy();
      expect(screen.getByText(/Clean code reads like prose/)).toBeTruthy();
    });
  });

  // 5. 既存サマリーありのとき「再生成する」ボタンを表示
  it('shows "再生成する" button when summary already exists', async () => {
    setupFetchSummaryMock(mockSummaryData);

    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /再生成する/i })).toBeTruthy();
    });
  });

  // 6. Edge Function を正しいパラメータで呼ぶ
  it('calls Edge Function with bookId when button is pressed', async () => {
    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);
    await waitFor(() => screen.getByRole('button', { name: /AIで整理する/i }));

    fireEvent.press(screen.getByRole('button', { name: /AIで整理する/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/summarize-memos'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ bookId: 'book-1' }),
        })
      );
    });
  });

  // 7. 生成成功後にサマリーを表示
  it('displays summary after successful generation', async () => {
    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);
    await waitFor(() => screen.getByRole('button', { name: /AIで整理する/i }));

    fireEvent.press(screen.getByRole('button', { name: /AIで整理する/i }));

    await waitFor(() => {
      expect(screen.getByText('Test summary')).toBeTruthy();
      expect(screen.getByText(/Learning 1/)).toBeTruthy();
      expect(screen.getByText(/Quote 1/)).toBeTruthy();
    });
  });

  // 8. エラー時にメッセージ表示
  it('shows error message when Edge Function returns 500', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'internal_error' }),
    });

    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);
    await waitFor(() => screen.getByRole('button', { name: /AIで整理する/i }));

    fireEvent.press(screen.getByRole('button', { name: /AIで整理する/i }));

    await waitFor(() => {
      expect(screen.getByText(/しばらく後に再試行/i)).toBeTruthy();
    });
  });

  // 9. レート制限 (429) 時にカウントダウン表示
  it('shows rate limit message with retryAfter seconds when 429 is returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ error: 'rate_limited', retryAfter: 45 }),
    });

    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);
    await waitFor(() => screen.getByRole('button', { name: /AIで整理する/i }));

    fireEvent.press(screen.getByRole('button', { name: /AIで整理する/i }));

    await waitFor(() => {
      expect(screen.getByText(/45秒後/i)).toBeTruthy();
    });
  });

  // 10. 生成中はボタンが disabled
  it('disables button while generating', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<AISummarySection bookId="book-1" userId="user-1" notesCount={5} />);
    await waitFor(() => screen.getByRole('button', { name: /AIで整理する/i }));

    fireEvent.press(screen.getByRole('button', { name: /AIで整理する/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /AIで整理する/i })).toBeDisabled();
    });
  });
});
