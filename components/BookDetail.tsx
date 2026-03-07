import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: string;
  cover_url?: string | null;
  finished_at?: string | null;
};

type Props = {
  book: Book;
  userId: string;
  onBookmarkUpdate: () => void;
  onEdit?: () => void;
};

const QUICK_BUTTONS = [5, 10, 20];

export default function BookDetail({ book, userId, onBookmarkUpdate, onEdit }: Props) {
  const [pageInput, setPageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const progressPercent =
    book.total_pages > 0
      ? Math.round((book.current_page / book.total_pages) * 100)
      : 0;

  const saveBookmark = async (pageNumber: number) => {
    setError('');
    setLoading(true);

    const clamped = Math.min(pageNumber, book.total_pages);

    const { error: insertError } = await supabase.from('bookmarks').upsert({
      book_id: book.id,
      user_id: userId,
      page_number: clamped,
      recorded_at: new Date().toISOString().split('T')[0],
    }, {
      onConflict: 'book_id,user_id,recorded_at',
    });

    if (insertError) {
      setLoading(false);
      setError(insertError.message);
      return;
    }

    // Auto update status
    const newStatus = clamped >= book.total_pages
      ? 'finished'
      : clamped > 0
        ? 'reading'
        : 'unread';

    const updatePayload: Record<string, unknown> = {
      current_page: clamped,
      status: newStatus,
    };
    if (newStatus === 'finished' && !book.finished_at) {
      updatePayload.finished_at = new Date().toISOString();
    }

    await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', book.id);

    setLoading(false);
    setPageInput('');
    onBookmarkUpdate();
  };

  const handleUpdate = () => {
    const page = Number(pageInput);
    if (!pageInput || isNaN(page) || page < 0) return;
    saveBookmark(page);
  };

  const handleQuickAdd = (amount: number) => {
    saveBookmark(book.current_page + amount);
  };

  return (
    <View className="flex-1">
    {/* Cover Image */}
      {book.cover_url ? (
        <Image
          source={{ uri: book.cover_url }}
          className="w-24 h-36 rounded-lg self-center mb-4"
          resizeMode="cover"
        />
      ) : null}

      {/* Book Info */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-text-primary">{book.title}</Text>
          {book.author ? (
            <Text className="text-lg text-text-secondary mt-1">{book.author}</Text>
          ) : null}
        </View>
        {onEdit ? (
          <TouchableOpacity onPress={onEdit} className="ml-3 px-3 py-1.5 bg-bg-sub rounded-lg">
            <Text className="text-sm font-medium text-primary">Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Progress */}
      <View className="mt-6 bg-bg-sub rounded-xl p-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-base text-text-secondary">
            {book.current_page} / {book.total_pages}
          </Text>
          <Text className="text-base font-medium text-primary">
            {progressPercent}%
          </Text>
        </View>
        <View className="h-3 bg-border-light rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
      </View>

      {/* Bookmark Update */}
      <View className="mt-6">
        <Text className="text-base font-semibold text-text-primary mb-3">
          Bookmark
        </Text>

        {error ? (
          <Text className="text-sm text-danger text-center mb-3 bg-red-50 p-3 rounded-lg">
            {error}
          </Text>
        ) : null}

        {/* Quick Buttons */}
        <View className="flex-row gap-2 mb-3">
          {QUICK_BUTTONS.map((amount) => (
            <TouchableOpacity
              key={amount}
              onPress={() => handleQuickAdd(amount)}
              disabled={loading}
              className="flex-1 bg-bg-sub rounded-lg py-3 items-center"
            >
              <Text className="text-base font-medium text-primary">+{amount}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Manual Input */}
        <View className="flex-row gap-2">
          <TextInput
            placeholder="Page number"
            value={pageInput}
            onChangeText={setPageInput}
            keyboardType="numeric"
            className="flex-1 bg-bg-sub rounded-xl p-3.5 text-base"
          />
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Update Bookmark"
            className="bg-primary rounded-xl px-5 justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white font-bold">Update Bookmark</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
