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

// import { useEffect, useState } from "react";
// import { Text, View } from "react-native";
// import { supabase } from "../../lib/supabase";
//
// export default function HomeScreen() {
//   const [status, setStatus] = useState("Connecting...");
//
//   useEffect(() => {
//     async function testConnection() {
//       const { data, error } = await supabase.from("books").select("count");
//       if (error) {
//         setStatus(`❌ Error: ${error.message}`);
//       } else {
//         setStatus("✅ Supabase connected!");
//       }
//     }
//     testConnection();
//   }, []);
//
//   return (
//     <View className="flex-1 items-center justify-center bg-bg-main">
//       <Text className="text-2xl font-bold text-primary">📚 Library</Text>
//       <Text className="mt-4 text-text-secondary">{status}</Text>
//     </View>
//   );
// }
