import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type BookSummary = {
  summary: string;
  learnings: string[];
  quotes: string[];
  detectedLang: string;
  promptVersion: string;
  tokenCount: number;
  createdAt: string;
};

type SummaryState =
  | { status: 'idle' }
  | { status: 'loading_existing' }
  | { status: 'loading' }
  | { status: 'success'; data: BookSummary }
  | { status: 'error'; message: string }
  | { status: 'rate_limited'; retryAfter: number }
  | { status: 'conflict' };

type Props = {
  bookId: string;
  userId: string;
  notesCount: number;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FETCH_TIMEOUT_MS = 30000;

async function fetchExistingSummary(bookId: string, userId: string): Promise<BookSummary | null> {
  const { data } = await supabase
    .from('book_summaries')
    .select('summary, learnings, quotes, detected_lang, prompt_version, token_count, updated_at, is_processing')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.is_processing) return null;

  return {
    summary: data.summary,
    learnings: data.learnings,
    quotes: data.quotes,
    detectedLang: data.detected_lang,
    promptVersion: data.prompt_version,
    tokenCount: data.token_count ?? 0,
    createdAt: data.updated_at,
  };
}

async function callSummarizeMemos(bookId: string): Promise<BookSummary> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('unauthorized');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/summarize-memos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bookId }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const body = await res.json();
      throw Object.assign(new Error('rate_limited'), { retryAfter: body.retryAfter });
    }
    if (res.status === 409) throw new Error('conflict');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export default function AISummarySection({ bookId, userId, notesCount }: Props) {
  const [state, setState] = useState<SummaryState>({ status: 'loading_existing' });

  useEffect(() => {
    fetchExistingSummary(bookId, userId).then((data) => {
      if (data) {
        setState({ status: 'success', data });
      } else {
        setState({ status: 'idle' });
      }
    });
  }, [bookId, userId]);

  const handleGenerate = async () => {
    setState({ status: 'loading' });
    try {
      const data = await callSummarizeMemos(bookId);
      setState({ status: 'success', data });
    } catch (err: any) {
      if (err.message === 'rate_limited') {
        setState({ status: 'rate_limited', retryAfter: err.retryAfter });
      } else if (err.message === 'conflict') {
        setState({ status: 'conflict' });
      } else {
        setState({ status: 'error', message: err.message });
      }
    }
  };

  const hasSummary = state.status === 'success';
  const isGenerating = state.status === 'loading';
  const isDisabled = notesCount === 0 || isGenerating || state.status === 'conflict';

  return (
    <View className="mt-6">
      <Text className="text-base font-semibold text-text-primary mb-3">AI要約</Text>

      {notesCount === 0 && (
        <Text className="text-sm text-text-secondary mb-3">
          メモを追加してからAI整理できます
        </Text>
      )}

      {state.status === 'error' && (
        <Text className="text-sm text-danger mb-3 bg-red-50 p-3 rounded-lg text-center">
          しばらく後に再試行してください
        </Text>
      )}

      {state.status === 'rate_limited' && (
        <Text className="text-sm text-text-secondary mb-3 bg-bg-sub p-3 rounded-lg text-center">
          あと{state.retryAfter}秒後に再試行できます
        </Text>
      )}

      {state.status === 'conflict' && (
        <Text className="text-sm text-text-secondary mb-3">
          処理中です...
        </Text>
      )}

      {state.status === 'loading_existing' ? (
        <ActivityIndicator color="#3ea8ff" size="small" className="mb-4" />
      ) : (
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={hasSummary ? '再生成する' : 'AIで整理する'}
          className={`rounded-xl py-3 items-center mb-4 ${
            isDisabled ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {isGenerating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">
              {hasSummary ? '再生成する' : 'AIで整理する'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {state.status === 'success' && (
        <View className="bg-bg-sub rounded-xl p-4">
          <Text className="text-sm font-medium text-text-secondary mb-1">まとめ</Text>
          <Text className="text-sm text-text-primary mb-4">{state.data.summary}</Text>

          {state.data.learnings.length > 0 && (
            <>
              <Text className="text-sm font-medium text-text-secondary mb-2">学び</Text>
              {state.data.learnings.map((learning, i) => (
                <Text key={i} className="text-sm text-text-primary mb-1">・{learning}</Text>
              ))}
            </>
          )}

          {state.data.quotes.length > 0 && (
            <View className="mt-3">
              <Text className="text-sm font-medium text-text-secondary mb-2">印象的な言葉</Text>
              {state.data.quotes.map((quote, i) => (
                <Text key={i} className="text-sm text-text-primary italic mb-1">「{quote}」</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
