import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  onBack: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
};

export default function ScreenHeader({ title, onBack, rightAction }: Props) {
  return (
    <View className="flex-row items-center justify-between mb-4 h-10">
      <TouchableOpacity
        onPress={onBack}
        className="flex-row items-center"
      >
        <Ionicons name="chevron-back" size={24} color="#3ea8ff" />
        <Text className="text-primary text-base ml-1">Back</Text>
      </TouchableOpacity>

      <Text className="text-base font-bold text-text-primary">{title}</Text>

      {rightAction ? (
        <TouchableOpacity onPress={rightAction.onPress}>
          <Text className="text-primary text-base">{rightAction.label}</Text>
        </TouchableOpacity>
      ) : (
        <View className="w-16" />
      )}
    </View>
  );
}
