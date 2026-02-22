import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-main">
      <Text className="text-2xl font-bold text-primary">📚 Library</Text>
      <Text className="mt-2 text-text-secondary">
        NativeWind is working!
      </Text>
    </View>
  );
}

