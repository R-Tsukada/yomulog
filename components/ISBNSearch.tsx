import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { searchByISBN } from '../services/bookSearch';
import BarcodeScanner from './BarcodeScanner';

type BookData = {
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
};

type Props = {
  onBookFound: (book: BookData) => void;
};

export default function ISBNSearch({ onBookFound }: Props) {
  const [isbn, setIsbn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);

  const isFormValid = isbn.trim().length > 0;

  const handleSearch = async (searchIsbn?: string) => {
    const target = searchIsbn ?? isbn.trim();
    if (!target) return;

    setResult(null);
    setNotFound(false);
    setLoading(true);

    const book = await searchByISBN(target);

    setLoading(false);

    if (book) {
      setResult(book);
    } else {
      setNotFound(true);
    }
  };

  const handleScanned = (scannedIsbn: string) => {
    setScanning(false);
    setIsbn(scannedIsbn);
    handleSearch(scannedIsbn);
  };

  if (scanning) {
    return (
      <BarcodeScanner
        onScanned={handleScanned}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <View>
      {/* Scan Button */}
      <TouchableOpacity
        onPress={() => setScanning(true)}
        className="bg-bg-sub rounded-xl py-4 items-center mb-4 border border-dashed border-primary"
      >
        <Text className="text-primary font-bold text-base">📷 Scan Barcode</Text>
        <Text className="text-text-secondary text-xs mt-1">
          Use your camera to scan ISBN barcode
        </Text>
      </TouchableOpacity>

      {/* Manual Search */}
      <View className="flex-row gap-2 mb-4">
        <TextInput
          placeholder="ISBN"
          value={isbn}
          onChangeText={setIsbn}
          keyboardType="numeric"
          className="flex-1 bg-bg-sub rounded-xl p-3.5 text-base"
        />
        <TouchableOpacity
          onPress={() => handleSearch()}
          disabled={!isFormValid || loading}
          accessibilityRole="button"
          accessibilityLabel="Search"
          className={`rounded-xl px-5 justify-center ${
            isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Not Found */}
      {notFound ? (
        <Text className="text-text-secondary text-sm text-center py-4">
          No book found for this ISBN
        </Text>
      ) : null}

      {/* Result */}
      {result ? (
        <View className="bg-bg-sub rounded-xl p-4">
          <Text className="text-base font-semibold text-text-primary">
            {result.title}
          </Text>
          {result.author ? (
            <Text className="text-sm text-text-secondary mt-1">
              {result.author}
            </Text>
          ) : null}
          <Text className="text-xs text-text-secondary mt-1">
            {result.totalPages} pages
          </Text>

          <TouchableOpacity
            onPress={() => onBookFound(result)}
            accessibilityRole="button"
            accessibilityLabel="Add to Library"
            className="bg-primary rounded-lg py-3 items-center mt-4"
          >
            <Text className="text-white text-sm font-bold">Add to Library</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
