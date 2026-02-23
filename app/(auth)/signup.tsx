import { useRouter } from "expo-router";
import SignUpScreen from "../../components/SignUpScreen";

export default function SignUpPage() {
  const router = useRouter();

  return (
    <SignUpScreen
      onNavigateToLogin={() => router.replace("/(auth)/login")}
    />
  );
}
