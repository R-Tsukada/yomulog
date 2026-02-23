import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { ActivityIndicator, View, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import BookDetail from "../../components/BookDetail";
import NoteSection from "../../components/NoteSection";
import ScreenWrapper from "../../components/ScreenWrapper";
import ScreenHeader from "../../components/ScreenHeader";

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
    <ScreenWrapper>
      <ScreenHeader
        title="Book Detail"
        onBack={() => router.back()}
      />
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
      </ScrollView>
    </ScreenWrapper>
  );
}
