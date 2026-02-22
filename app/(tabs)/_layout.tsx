import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: "Library", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: "Add Book", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: () => null }}
      />
    </Tabs>
  );
}
