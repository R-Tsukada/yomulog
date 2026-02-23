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
  onScanPress?: () => void;
};

export default function AddBookForm({ userId, onSuccess, onScanPress }: Props) {
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
      {/* Scan Barcode Button */}
      {onScanPress && (
        <>
          <TouchableOpacity
            onPress={onScanPress}
            className="bg-primary rounded-xl p-4 flex-row items-center justify-center gap-2 mb-6"
            style={{ shadowColor: '#3ea8ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 }}
          >
            <Text className="text-xl">📷</Text>
            <Text className="text-white text-base font-bold">Scan Barcode</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center gap-3 mb-6">
            <View className="flex-1 h-px bg-border-light" />
            <Text className="text-xs text-text-secondary font-semibold">or enter manually</Text>
            <View className="flex-1 h-px bg-border-light" />
          </View>
        </>
      )}

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      <View className="mb-5">
        <Text className="text-sm font-bold text-text-primary mb-1.5">
          Title <Text className="text-danger">*</Text>
        </Text>
        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          className="bg-bg-sub rounded-xl p-3.5 text-base"
        />
      </View>

      <View className="mb-5">
        <Text className="text-sm font-bold text-text-primary mb-1.5">Author</Text>
        <TextInput
          placeholder="Author"
          value={author}
          onChangeText={setAuthor}
          className="bg-bg-sub rounded-xl p-3.5 text-base"
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-bold text-text-primary mb-1.5">Total Pages</Text>
        <TextInput
          placeholder="Total Pages"
          value={totalPages}
          onChangeText={setTotalPages}
          keyboardType="numeric"
          className="bg-bg-sub rounded-xl p-3.5 text-base"
        />
      </View>

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
