import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { ActivityIndicator, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import BookDetail from "../../components/BookDetail";
import NoteSection from "../../components/NoteSection";
import AISummarySection from "../../components/AISummarySection";
import ExportNotesButton from "../../components/ExportNotesButton";

export default function BookDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [book, setBook] = useState(null);
  const [notes, setNotes] = useState([]);

  const fetchBook = async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setBook(data);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("reading_notes")
      .select("*")
      .eq("book_id", id)
      .order("page_number", { ascending: true });
    if (data) setNotes(data);
  };

  const refreshAll = () => {
    fetchBook();
    fetchNotes();
  };

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [id])
  );

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-main">
        <ActivityIndicator size="large" color="#3ea8ff" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-main px-6">
      <Stack.Screen options={{
        title: 'Book Detail',
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#3ea8ff',
        headerTitleStyle: { fontWeight: '600', color: '#1a1a2e' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <BookDetail
            book={book}
            userId={session?.user?.id ?? ""}
            onBookmarkUpdate={refreshAll}
            onEdit={() => router.push(`/book/edit/${id}`)}
          />
          <NoteSection
            notes={notes}
            bookId={id}
            userId={session?.user?.id ?? ""}
            onNoteAdded={refreshAll}
          />
          {/* AISummarySection is hidden until Supabase Pro Plan is available.
              Edge Functions on the free plan have a 2s timeout, which is too short
              for the Gemini API call. Re-enable when upgrading to Pro Plan.
          <AISummarySection
            bookId={id}
            userId={session?.user?.id ?? ""}
            notesCount={notes.length}
          /> */}
          <ExportNotesButton book={book} notes={notes} />
          <View className="h-32" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
