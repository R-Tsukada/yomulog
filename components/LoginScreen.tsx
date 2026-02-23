import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Props = {
  onNavigateToSignUp: () => void;
};

export default function LoginScreen({ onNavigateToSignUp }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const isFormValid = email.length > 0 && password.length > 0;

  const handleLogin = async () => {
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-bg-main">
      <Text className="text-3xl font-extrabold text-text-primary text-center mb-2">
        YomuLog
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-8">
        Track your reading journey
      </Text>

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-3"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-5"
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={!isFormValid || loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? 'Logging in...' : 'Log In'}
        className={`rounded-xl p-4 items-center ${
          isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
        }`}
      >
        {loading ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white text-base font-bold">Logging in...</Text>
          </View>
        ) : (
          <Text className="text-white text-base font-bold">Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNavigateToSignUp}
        className="mt-5 items-center"
      >
        <Text className="text-text-secondary text-sm">
          Don't have an account?{' '}
          <Text className="text-primary font-semibold">Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
