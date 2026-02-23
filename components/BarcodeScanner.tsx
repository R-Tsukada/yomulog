import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Props = {
  onScanned: (isbn: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-main">
        <Text className="text-text-secondary">Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-main px-6">
        <Text className="text-base text-text-primary text-center mb-4">
          Camera permission is required to scan barcodes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary rounded-xl py-3 px-6"
        >
          <Text className="text-white font-bold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} className="mt-4">
          <Text className="text-text-secondary">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      {/* Overlay */}
      <View className="flex-1 justify-between">
        {/* Top bar */}
        <View className="pt-16 px-6 flex-row justify-between items-center">
          <Text className="text-white text-lg font-bold">Scan ISBN Barcode</Text>
          <TouchableOpacity
            onPress={onClose}
            className="bg-black/50 rounded-full px-4 py-2"
          >
            <Text className="text-white font-medium">Close</Text>
          </TouchableOpacity>
        </View>

        {/* Scan guide */}
        <View className="items-center mb-32">
          <View className="w-64 h-32 border-2 border-white rounded-xl" />
          <Text className="text-white text-sm mt-3">
            Point at the barcode on the back of the book
          </Text>
        </View>
      </View>
    </View>
  );
}
