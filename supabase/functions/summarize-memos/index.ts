import { createClient } from "jsr:@supabase/supabase-js@2";

const MEMO_LIMIT         = 50;
const CHAR_LIMIT         = 10000;
const RATE_LIMIT_SECONDS = 60;
const PROMPT_VERSION     = 'v1';
const GEMINI_TIMEOUT_MS  = 25000;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function errorResponse(status: number, code: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
}

// ==================== 言語検出 ====================

function detectLanguage(notes: { content: string }[]): string {
  const sample = notes.slice(0, 5).map(m => m.content).join(' ');
  const kanaCount = (sample.match(/[\u3040-\u309F\u30A0-\u30FF]/g) ?? []).length;
  const zhCount   = (sample.match(/[\u4E00-\u9FAF]/g) ?? []).length;
  const koCount   = (sample.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const total     = sample.length || 1;

  if (kanaCount / total > 0.05) return 'ja';
  if (koCount   / total > 0.1)  return 'ko';
  if (zhCount   / total > 0.1)  return 'zh';
  return 'en';
}

const LANG_NAMES: Record<string, string> = {
  ja: '日本語', en: 'English', zh: '中文', ko: '한국어',
};

// ==================== プロンプト構築 ====================

function buildSystemPrompt(lang: string): string {
  const langName = LANG_NAMES[lang] ?? 'the same language as the notes';
  return `
You are an AI assistant that helps organize reading notes.
Based on the user's reading notes, summarize the following 3 points.
Output MUST be in ${langName}.

【Output format】Return ONLY the following JSON. No explanation before or after.
{
  "summary": "2-3 sentence summary of the book (from the learner perspective)",
  "learnings": ["Key learning 1", "Key learning 2", ...],
  "quotes": ["Memorable quote 1", ...]
}

【Constraints】
- Do NOT alter the content of the notes
- quotes must be direct citations from the user's notes
- learnings must be insights extractable from the notes
- If information is scarce, fewer items are acceptable
`;
}

function buildUserPrompt(
  book: { title: string; author?: string | null },
  notes: { content: string; is_bookmarked: boolean }[]
): string {
  const noteText = notes
    .map(n => `${n.is_bookmarked ? '★' : '・'} ${n.content}`)
    .join('\n');

  return `
Book: ${book.title}
Author: ${book.author ?? 'Unknown'}

Reading notes below (★ = bookmarked / favorite):
${noteText}
`;
}

// ==================== メモの上限制御 ====================

function trimNotes(
  notes: { content: string; is_bookmarked: boolean }[],
  charLimit: number
) {
  const sorted = [...notes].sort((a, b) =>
    Number(b.is_bookmarked) - Number(a.is_bookmarked)
  );

  let total = 0;
  const result = [];
  for (const note of sorted) {
    if (total + note.content.length > charLimit) break;
    total += note.content.length;
    result.push(note);
  }
  return result;
}

// ==================== Geminiレスポンス検証 ====================

function validateGeminiResult(
  parsed: unknown
): { summary: string; learnings: string[]; quotes: string[] } {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid response: not an object');
  }
  const p = parsed as Record<string, unknown>;
  if (typeof p.summary !== 'string') {
    throw new Error('Invalid response: summary must be string');
  }
  if (!Array.isArray(p.learnings)) {
    throw new Error('Invalid response: learnings must be array');
  }
  if (!Array.isArray(p.quotes)) {
    throw new Error('Invalid response: quotes must be array');
  }
  return {
    summary:   p.summary,
    learnings: p.learnings.filter((l): l is string => typeof l === 'string'),
    quotes:    p.quotes.filter((q): q is string => typeof q === 'string'),
  };
}

function safeParseGeminiResponse(text: string) {
  try { return JSON.parse(text); } catch (_) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch (_) {}
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) {}
  }

  return null;
}

// ==================== Gemini呼び出し ====================

async function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('[summarize-memos] GEMINI_API_KEY is not set');
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error('[summarize-memos] Gemini API error:', res.status, await res.text());
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawText    = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokenCount = data.usageMetadata?.totalTokenCount ?? 0;

    const parsed = safeParseGeminiResponse(rawText);
    if (!parsed) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawText));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.error('[summarize-memos] Parse failed.', {
        length: rawText.length,
        tokenCount,
        hash: hashHex,
      });
      throw new Error('Failed to parse Gemini response');
    }

    const validated = validateGeminiResult(parsed);
    return { ...validated, tokenCount };

  } finally {
    clearTimeout(timer);
  }
}

// ==================== メインハンドラ ====================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  // 1. JWT検証
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return errorResponse(401, 'unauthorized');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse(401, 'unauthorized');

  // 2. リクエストボディ解析
  let body: { bookId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'invalid_json');
  }

  const { bookId } = body;
  if (!bookId) return errorResponse(400, 'bookId_required');
  if (!UUID_REGEX.test(bookId)) return errorResponse(400, 'invalid_bookId_format');

  // 3. 書籍取得（user_idフィルタ必須）
  const { data: book } = await supabase
    .from('books')
    .select('title, author, last_summarized_at')
    .eq('id', bookId)
    .eq('user_id', user.id)
    .single();

  if (!book) return errorResponse(403, 'not_found');

  // 4. レート制限チェック
  if (book.last_summarized_at) {
    const elapsed = (Date.now() - new Date(book.last_summarized_at).getTime()) / 1000;
    if (elapsed < RATE_LIMIT_SECONDS) {
      const retryAfter = Math.ceil(RATE_LIMIT_SECONDS - elapsed);
      return new Response(
        JSON.stringify({ error: 'rate_limited', retryAfter }),
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }
  }

  // 5. メモ取得（上限あり）
  const { data: notes } = await supabase
    .from('reading_notes')
    .select('content, is_bookmarked')
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MEMO_LIMIT);

  if (!notes?.length) return errorResponse(400, 'no_memos');

  // 6. 文字数上限の適用
  const trimmedNotes = trimNotes(notes, CHAR_LIMIT);

  // 7. アトミックなロック取得（is_processing フラグ）
  // ステップ1: is_processing が false/null の場合のみ UPDATE でロック取得
  const { data: locked } = await supabase
    .from('book_summaries')
    .update({ is_processing: true, is_error: false })
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .or('is_processing.is.null,is_processing.eq.false')
    .select()
    .maybeSingle();

  if (!locked) {
    // ステップ2: レコードが存在しない場合は INSERT を試みる
    const { error: insertError } = await supabase.from('book_summaries').insert({
      book_id:        bookId,
      user_id:        user.id,
      is_processing:  true,
      is_error:       false,
      summary:        '',
      learnings:      [],
      quotes:         [],
      detected_lang:  'ja',
      prompt_version: PROMPT_VERSION,
    });
    if (insertError?.code === '23505') {
      // ユニーク制約違反 = 別リクエストが先にロック取得済み
      return errorResponse(409, 'processing_in_progress');
    }
    if (insertError) {
      console.error('[summarize-memos] Failed to insert book_summary:', insertError);
      return errorResponse(500, 'db_error');
    }
  }

  try {
    // 9. 言語検出
    const detectedLang = detectLanguage(trimmedNotes);

    // 10. Gemini呼び出し
    const systemPrompt = buildSystemPrompt(detectedLang);
    const userPrompt   = buildUserPrompt(book, trimmedNotes);
    const geminiResult = await callGeminiFlash(systemPrompt, userPrompt);

    const result = {
      book_id:        bookId,
      user_id:        user.id,
      summary:        geminiResult.summary,
      learnings:      geminiResult.learnings,
      quotes:         geminiResult.quotes,
      detected_lang:  detectedLang,
      prompt_version: PROMPT_VERSION,
      token_count:    geminiResult.tokenCount,
      model_used:     'gemini-2.0-flash',
      is_processing:  false,
      is_error:       false,
    };

    // 11. DBに保存
    const { error: upsertError } = await supabase.from('book_summaries')
      .upsert(result, { onConflict: 'book_id,user_id' });

    if (upsertError) {
      console.error('[summarize-memos] Failed to upsert book_summary:', upsertError);
      throw new Error('DB upsert failed');
    }

    // 12. last_summarized_at 更新（レート制限用）
    await supabase.from('books')
      .update({ last_summarized_at: new Date().toISOString() })
      .eq('id', bookId)
      .eq('user_id', user.id);

    return new Response(JSON.stringify({
      summary:       result.summary,
      learnings:     result.learnings,
      quotes:        result.quotes,
      detectedLang:  result.detected_lang,
      promptVersion: result.prompt_version,
      tokenCount:    result.token_count,
      createdAt:     new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  } catch (err) {
    await supabase.from('book_summaries')
      .update({ is_processing: false, is_error: true })
      .eq('book_id', bookId)
      .eq('user_id', user.id);
    console.error('[summarize-memos] Error:', err);
    return errorResponse(500, 'internal_error');
  }
});
