import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Note = {
  id: string;
  page_number: number;
  content: string;
  created_at: string;
  is_bookmarked?: boolean;
};

type Props = {
  notes: Note[];
  bookId: string;
  userId: string;
  onNoteAdded: () => void;
};

export default function NoteSection({ notes, bookId, userId, onNoteAdded }: Props) {
  const [page, setPage] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isFormValid = content.trim().length > 0;
  const isEditFormValid = editContent.trim().length > 0;

  const handleAddNote = async () => {
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase.from('reading_notes').insert({
      book_id: bookId,
      user_id: userId,
      page_number: page ? Number(page) : 0,
      content: content.trim(),
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      setPage('');
      setContent('');
      onNoteAdded();
    }
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setEditPage(String(note.page_number));
    setEditContent(note.content);
    setDeletingId(null);
  };

  const handleSaveEdit = async () => {
    setError('');
    setLoading(true);

    const { error: updateError } = await supabase
      .from('reading_notes')
      .update({
        content: editContent.trim(),
        page_number: editPage ? Number(editPage) : 0,
      })
      .eq('id', editingId!);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setEditingId(null);
      setEditContent('');
      setEditPage('');
      onNoteAdded();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditPage('');
  };

  const handleToggleBookmark = async (noteId: string, current: boolean) => {
    const { error: toggleError } = await supabase
      .from('reading_notes')
      .update({ is_bookmarked: !current })
      .eq('id', noteId)
      .eq('user_id', userId);
    if (toggleError) {
      setError(toggleError.message);
    } else {
      onNoteAdded();
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    setError('');
    setLoading(true);

    const { error: deleteError } = await supabase
      .from('reading_notes')
      .delete()
      .eq('id', id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setDeletingId(null);
      onNoteAdded();
    }
  };

  return (
    <View className="mt-6">
      <Text className="text-base font-semibold text-text-primary mb-3">Notes</Text>

      {error ? (
        <Text className="text-sm text-danger text-center mb-3 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      {/* Add Note Form */}
      <View className="bg-bg-sub rounded-xl p-4 mb-4">
        <View className="flex-row gap-2 mb-2">
          <TextInput
            placeholder="Page"
            value={page}
            onChangeText={setPage}
            keyboardType="numeric"
            className="w-20 bg-bg-main rounded-lg p-2.5 text-sm"
          />
          <TextInput
            placeholder="Write a note..."
            value={content}
            onChangeText={setContent}
            multiline
            className="flex-1 bg-bg-main rounded-lg p-2.5 text-sm"
          />
        </View>
        <TouchableOpacity
          onPress={handleAddNote}
          disabled={!isFormValid || loading}
          accessibilityRole="button"
          accessibilityLabel="Add Note"
          className={`rounded-lg py-2.5 items-center ${
            isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-sm font-bold">Add Note</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Notes List */}
      {notes.length === 0 ? (
        <Text className="text-text-secondary text-sm text-center py-4">
          No notes yet
        </Text>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View className="bg-bg-sub rounded-xl p-4 mb-2">
              {editingId === item.id ? (
                /* Edit Mode */
                <View>
                  <View className="flex-row gap-2 mb-2">
                    <TextInput
                      value={editPage}
                      onChangeText={setEditPage}
                      keyboardType="numeric"
                      className="w-20 bg-bg-main rounded-lg p-2.5 text-sm"
                    />
                    <TextInput
                      value={editContent}
                      onChangeText={setEditContent}
                      multiline
                      className="flex-1 bg-bg-main rounded-lg p-2.5 text-sm"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      className="flex-1 rounded-lg py-2 items-center bg-bg-main"
                    >
                      <Text className="text-sm text-text-secondary">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEdit}
                      disabled={!isEditFormValid || loading}
                      accessibilityRole="button"
                      accessibilityLabel="Save Edit"
                      className={`flex-1 rounded-lg py-2 items-center ${
                        isEditFormValid ? 'bg-primary' : 'bg-primary/50'
                      }`}
                    >
                      <Text className="text-sm font-bold text-white">Save Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : deletingId === item.id ? (
                /* Delete Confirmation */
                <View>
                  <Text className="text-sm text-danger text-center mb-3">
                    Delete this note?
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setDeletingId(null)}
                      className="flex-1 rounded-lg py-2 items-center bg-bg-main"
                    >
                      <Text className="text-sm text-text-secondary">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteConfirm(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm"
                      className="flex-1 rounded-lg py-2 items-center bg-danger"
                    >
                      <Text className="text-sm font-bold text-white">Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Display Mode */
                <View>
                  <Text className="text-xs text-primary font-medium mb-1">
                    p.{item.page_number}
                  </Text>
                  <Text className="text-sm text-text-primary mb-2">{item.content}</Text>
                  <View className="flex-row gap-2 justify-end items-center">
                    <TouchableOpacity
                      onPress={() => handleToggleBookmark(item.id, item.is_bookmarked ?? false)}
                      accessibilityRole="button"
                      accessibilityLabel={item.is_bookmarked ? 'Remove bookmark' : 'Bookmark note'}
                    >
                      <Text className={`text-xs font-medium ${item.is_bookmarked ? 'text-primary' : 'text-text-secondary'}`}>
                        {item.is_bookmarked ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEdit(item)}>
                      <Text className="text-xs text-primary font-medium">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeletingId(item.id)}>
                      <Text className="text-xs text-danger font-medium">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
