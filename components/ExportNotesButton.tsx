import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { File, Paths } from 'expo-file-system/next';

type Note = {
  id: string;
  page_number: number;
  content: string;
  is_bookmarked?: boolean;
};

type Book = {
  title: string;
  author?: string | null;
};

type Props = {
  book: Book;
  notes: Note[];
};

function sanitizeFilename(name: string): string {
  return name.replace(/[:/\\*?"<>|]/g, '_');
}

function buildMarkdown(book: Book, notes: Note[], today: string): string {
  const author = book.author || 'Unknown';

  const lines = [
    '---',
    'aliases:',
    `  - ${book.title}`,
    `author: ${author}`,
    `created: ${today}`,
    '---',
    '',
    `# ${book.title}`,
    '',
    `Author: ${author}`,
    '',
    '---',
    '',
    '## Notes',
    ...notes.map(n => `\n### p.${n.page_number}\n${n.content}`),
  ];

  return lines.join('\n');
}

export default function ExportNotesButton({ book, notes }: Props) {
  const [loading, setLoading] = useState(false);

  const hasNotes = notes.length > 0;
  const bookmarkedNotes = notes.filter(n => n.is_bookmarked);
  const selectedNotes = bookmarkedNotes.length > 0 ? bookmarkedNotes : notes;
  const exportNotes = [...selectedNotes].sort((a, b) => a.page_number - b.page_number);

  const handleExport = async () => {
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const filename = `${sanitizeFilename(book.title)}_${today}.md`;
    const file = new File(Paths.cache, filename);

    try {
      file.write(buildMarkdown(book, exportNotes, today));
      await Share.share({ url: file.uri });
    } catch {
      Alert.alert('Error', 'Export is not supported on this device.');
    } finally {
      try { file.delete(); } catch {}
      setLoading(false);
    }
  };

  return (
    <View className="mt-4">
      <TouchableOpacity
        onPress={handleExport}
        disabled={!hasNotes || loading}
        accessibilityRole="button"
        accessibilityLabel="Export Notes"
        className={`rounded-lg py-2.5 items-center ${
          hasNotes && !loading ? 'bg-accent' : 'bg-accent/50'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white text-sm font-bold">Export Notes</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
