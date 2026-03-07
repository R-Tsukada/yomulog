import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [searchText, setSearchText] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const tabFiltered =
    activeTab === 'All'
      ? books
      : books.filter((b) => b.status === activeTab.toLowerCase());

  const filteredBooks = searchText
    ? tabFiltered.filter(
        (b) =>
          b.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (b.author ?? '').toLowerCase().includes(searchText.toLowerCase())
      )
    : tabFiltered;

  const getCount = (tab: TabFilter) =>
    tab === 'All'
      ? books.length
      : books.filter((b) => b.status === tab.toLowerCase()).length;

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-2xl font-bold text-text-primary">Library</Text>
      </View>

      {/* Search Bar */}
      <View className="mb-3">
        {searchActive ? (
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center bg-bg-sub rounded-xl px-3 py-2.5 border border-primary">
              <Ionicons name="search" size={16} color="#3ea8ff" style={{ marginRight: 8 }} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search by title or author"
                autoFocus
                className="flex-1 text-base text-text-primary"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  className="bg-text-secondary/30 rounded-full w-5 h-5 items-center justify-center"
                >
                  <Ionicons name="close" size={12} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setSearchActive(false);
                setSearchText('');
              }}
            >
              <Text className="text-primary text-sm font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setSearchActive(true)}
            className="flex-row items-center bg-bg-sub rounded-xl px-3 py-2.5"
          >
            <Ionicons name="search" size={16} color="#93a5b6" style={{ marginRight: 8 }} />
            <Text className="text-text-secondary text-sm">Search by title or author</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Tabs */}
      <View className="flex-row mb-1 border-b border-border-light">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`px-3 py-2 border-b-2 ${
              activeTab === tab ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-base font-medium ${
                activeTab === tab ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {tab}
            </Text>
            <Text
              className={`text-sm opacity-70 ${
                activeTab === tab ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {' '}({getCount(tab)})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Book List or Empty State */}
      {filteredBooks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl mb-4">📚</Text>
          <Text className="text-lg font-semibold text-text-primary mb-2">
            {searchText ? `No books matching "${searchText}"` : 'No books yet'}
          </Text>
          {!searchText && (
            <Text className="text-base text-text-secondary text-center px-8">
              Tap the Add Book tab to start building your library
            </Text>
          )}
        </View>
      ) : (
        <View className="bg-bg-sub rounded-xl overflow-hidden mt-2">
        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View className="border-b border-border-light" />
          )}
          renderItem={({ item }) => {
            const pct =
              item.total_pages > 0
                ? Math.round((item.current_page / item.total_pages) * 100)
                : 0;

            return (
              <TouchableOpacity
                onPress={() => onBookPress(item.id)}
                className="flex-row p-4"
              >
                {/* Cover Image */}
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    className="w-16 h-24 rounded-md mr-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-16 h-24 rounded-md mr-3 bg-border-light items-center justify-center flex-shrink-0">
                    <Ionicons name="book" size={28} color="#93a5b6" />
                  </View>
                )}

                {/* Book Info */}
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-lg font-bold text-text-primary"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.author ? (
                    <Text className="text-base text-text-secondary mt-0.5">
                      {item.author}
                    </Text>
                  ) : null}

                  {/* Status Badge */}
                  <View className="mt-1.5">
                    <View
                      className={`self-start flex-row items-center gap-1 px-2 py-0.5 rounded-full ${
                        item.status === 'reading'
                          ? 'bg-blue-100'
                          : item.status === 'finished'
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Ionicons
                        name={
                          item.status === 'reading'
                            ? 'book-outline'
                            : item.status === 'finished'
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={12}
                        color={
                          item.status === 'reading'
                            ? '#2563eb'
                            : item.status === 'finished'
                            ? '#16a34a'
                            : '#6b7280'
                        }
                      />
                      <Text
                        className={`text-sm font-medium ${
                          item.status === 'reading'
                            ? 'text-blue-600'
                            : item.status === 'finished'
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {item.status === 'reading'
                          ? 'Reading'
                          : item.status === 'finished'
                          ? 'Finished'
                          : 'Unread'}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View className="mt-2">
                    <View className="flex-row items-center gap-2">
                      <View className="flex-1 h-1.5 bg-border-light rounded-full overflow-hidden">
                        <View
                          className={`h-full rounded-full ${
                            pct === 100 ? 'bg-green-500' : 'bg-primary'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text
                        className={`text-sm font-semibold ${
                          pct === 100 ? 'text-green-500' : 'text-primary'
                        }`}
                      >
                        {pct}%
                      </Text>
                    </View>
                    <Text className="text-sm text-text-secondary mt-1">
                      {item.current_page} / {item.total_pages}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
        </View>
      )}
    </View>
  );
}
