import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Props = {
  userId: string;
  onSuccess: () => void;
};

export default function AddBookForm({ userId, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = title.trim().length > 0;

  const handleSave = async () => {
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (totalPages && (isNaN(Number(totalPages)) || Number(totalPages) < 0)) {
      setError('Please enter a valid number for total pages');
      return;
    }

    setLoading(true);

    const { error: insertError } = await supabase.from('books').insert({
      user_id: userId,
      title: title.trim(),
      author: author.trim() || null,
      total_pages: totalPages ? Number(totalPages) : 0,
      status: 'unread',
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      onSuccess();
    }
  };

  return (
    <View className="flex-1">
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
        accessibilityLabel={loading ? 'Saving...' : 'Save'}
        className={`rounded-xl p-4 items-center ${
          isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
        }`}
      >
        {loading ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white text-base font-bold">Saving...</Text>
          </View>
        ) : (
          <Text className="text-white text-base font-bold">Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
