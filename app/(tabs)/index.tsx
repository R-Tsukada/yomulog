import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import BookList from "../../components/BookList";
import ScreenWrapper from "../../components/ScreenWrapper";

export default function LibraryPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [books, setBooks] = useState([]);

  const fetchBooks = async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });

    if (data) setBooks(data);
  };

  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [session?.user?.id])
  );

  return (
    <ScreenWrapper>
      <BookList
        books={books}
        onBookPress={(id) => router.push(`/book/${id}`)}
      />
    </ScreenWrapper>
  );
}
