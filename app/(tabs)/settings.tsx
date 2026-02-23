import { useAuth } from "../../hooks/useAuth";
import SettingsScreen from "../../components/SettingsScreen";
import ScreenWrapper from "../../components/ScreenWrapper";

export default function SettingsPage() {
  const { session } = useAuth();

  return (
    <ScreenWrapper>
      <SettingsScreen email={session?.user?.email ?? ""} />
    </ScreenWrapper>
  );
}
