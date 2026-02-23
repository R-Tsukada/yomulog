import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image } from 'react-native';

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: 'unread' | 'reading' | 'finished';
  cover_url: string | null;
};

type Props = {
  books: Book[];
  onBookPress: (id: string) => void;
};

const TABS = ['All', 'Reading', 'Finished', 'Unread'] as const;

type TabFilter = (typeof TABS)[number];

export default function BookList({ books, onBookPress }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('All');

  const filteredBooks =
    activeTab === 'All'
      ? books
      : books.filter((b) => b.status === activeTab.toLowerCase());

  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-text-primary mb-4">Library</Text>

      {/* Status Tabs */}
      <View className="flex-row mb-4 gap-2">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === tab ? 'bg-primary' : 'bg-bg-sub'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Book List or Empty State */}
      {filteredBooks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl mb-4">📚</Text>
          <Text className="text-lg font-semibold text-text-primary mb-2">
            No books yet
          </Text>
          <Text className="text-sm text-text-secondary text-center px-8">
            Tap the Add Book tab to start building your library
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onBookPress(item.id)}
              className="bg-bg-sub rounded-xl p-4 mb-3"
            >
              {/* Cover Image */}
              {item.cover_url ? (
                <Image
                  source={{ uri: item.cover_url }}
                  className="w-14 h-20 rounded-md mr-3"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-14 h-20 rounded-md mr-3 bg-border-light items-center justify-center">
                  <Text className="text-2xl">📖</Text>
                </View>
              )}

              {/* Book Info */}
              <View className="flex-1">
              <Text className="text-base font-semibold text-text-primary">
                {item.title}
              </Text>
              {item.author ? (
                <Text className="text-sm text-text-secondary mt-1">
                  {item.author}
                </Text>
              ) : null}
              {/* Status Badge */}
              <View className="mt-2">
                <View className={`self-start px-2 py-0.5 rounded-full ${
                  item.status === 'reading' ? 'bg-blue-100' :
                  item.status === 'finished' ? 'bg-green-100' :
                  'bg-gray-100'
                }`}>
                  <Text className={`text-xs font-medium ${
                    item.status === 'reading' ? 'text-blue-600' :
                    item.status === 'finished' ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    {item.status === 'reading' ? '📖 Reading' :
                     item.status === 'finished' ? '✅ Finished' :
                     '📕 Unread'}
                  </Text>
                </View>
                </View>
              </View>
              {/* Progress */}
              <View className="mt-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-text-secondary">
                    {item.current_page} / {item.total_pages}
                  </Text>
                </View>
                <View className="h-1.5 bg-border-light rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: item.total_pages > 0
                        ? `${(item.current_page / item.total_pages) * 100}%`
                        : '0%',
                    }}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
