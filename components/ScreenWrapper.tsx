import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  noPadding?: boolean;
};

export default function ScreenWrapper({ children, noPadding }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <View className={`flex-1 ${noPadding ? '' : 'px-6'}`}>
        {children}
      </View>
    </SafeAreaView>
  );
}
