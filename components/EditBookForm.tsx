import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: string;
};

type Props = {
  book: Book;
  onSuccess: () => void;
  onDelete: () => void;
};

export default function EditBookForm({ book, onSuccess, onDelete }: Props) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? '');
  const [totalPages, setTotalPages] = useState(String(book.total_pages));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const isFormValid = title.trim().length > 0;

  const handleSave = async () => {
    setError('');
    setLoading(true);

    const { error: updateError } = await supabase
      .from('books')
      .update({
        title: title.trim(),
        author: author.trim() || null,
        total_pages: totalPages ? Number(totalPages) : 0,
      })
      .eq('id', book.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      onSuccess();
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', book.id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      onDelete();
    }
  };

  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-text-primary mb-6">Edit Book</Text>

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      <TextInput
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-3"
      />

      <TextInput
        placeholder="Author"
        value={author}
        onChangeText={setAuthor}
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-3"
      />

      <TextInput
        placeholder="Total Pages"
        value={totalPages}
        onChangeText={setTotalPages}
        keyboardType="numeric"
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-6"
      />

      <TouchableOpacity
        onPress={handleSave}
        disabled={!isFormValid || loading}
        accessibilityRole="button"
        accessibilityLabel="Save"
        className={`rounded-xl p-4 items-center mb-4 ${
          isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white text-base font-bold">Save</Text>
        )}
      </TouchableOpacity>

      {/* Delete */}
      {showConfirm ? (
        <View className="bg-red-50 rounded-xl p-4">
          <Text className="text-sm text-danger text-center mb-3">
            Are you sure you want to delete this book? This cannot be undone.
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowConfirm(false)}
              className="flex-1 rounded-lg py-3 items-center bg-bg-sub"
            >
              <Text className="text-sm font-medium text-text-secondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Confirm"
              className="flex-1 rounded-lg py-3 items-center bg-danger"
            >
              <Text className="text-sm font-bold text-white">Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setShowConfirm(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          className="rounded-xl p-4 items-center border border-danger"
        >
          <Text className="text-danger text-base font-bold">Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
