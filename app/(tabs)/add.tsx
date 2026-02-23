import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import AddBookForm from "../../components/AddBookForm";
import ISBNSearch from "../../components/ISBNSearch";

export default function AddBookPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [mode, setMode] = useState<"manual" | "isbn">("manual");

  const handleISBNAdd = async (book: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl: string | null;
  }) => {
    const { error } = await supabase.from("books").insert({
      user_id: session?.user?.id,
      title: book.title,
      author: book.author || null,
      total_pages: book.totalPages,
      cover_url: book.coverUrl,
      status: "unread",
    });

    if (!error) {
      router.replace("/(tabs)");
    }
  };

  return (
    <View className="flex-1 bg-bg-main pt-16 px-6">
      <Text className="text-2xl font-bold text-text-primary mb-4">Add Book</Text>

      {/* Mode Tabs */}
      <View className="flex-row mb-6 gap-2">
        <TouchableOpacity
          onPress={() => setMode("manual")}
          className={`flex-1 py-2.5 rounded-full items-center ${
            mode === "manual" ? "bg-primary" : "bg-bg-sub"
          }`}
        >
          <Text className={`text-sm font-medium ${
            mode === "manual" ? "text-white" : "text-text-secondary"
          }`}>
            Manual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode("isbn")}
          className={`flex-1 py-2.5 rounded-full items-center ${
            mode === "isbn" ? "bg-primary" : "bg-bg-sub"
          }`}
        >
          <Text className={`text-sm font-medium ${
            mode === "isbn" ? "text-white" : "text-text-secondary"
          }`}>
            ISBN Search
          </Text>
        </TouchableOpacity>
      </View>

      {mode === "manual" ? (
        <AddBookForm
          userId={session?.user?.id ?? ""}
          onSuccess={() => router.replace("/(tabs)")}
          onScanPress={() => setMode("isbn")}
        />
      ) : (
        <ISBNSearch onBookFound={handleISBNAdd} />
      )}
    </View>
  );
}
