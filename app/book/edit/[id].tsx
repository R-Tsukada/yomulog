import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";
import EditBookForm from "../../../components/EditBookForm";
import ScreenWrapper from "../../../components/ScreenWrapper";
import ScreenHeader from "../../../components/ScreenHeader";

export default function EditBookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState(null);

  useFocusEffect(
    useCallback(() => {
      const fetchBook = async () => {
        const { data } = await supabase
          .from("books")
          .select("*")
          .eq("id", id)
          .single();
        if (data) setBook(data);
      };
      fetchBook();
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
      <ScreenHeader title="Edit Book" onBack={() => router.back()} />
      <EditBookForm
        book={book}
        onSuccess={() => router.back()}
        onDelete={() => router.replace("/(tabs)")}
      />
    </ScreenWrapper>
  );
}
