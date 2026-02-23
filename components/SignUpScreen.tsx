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
  onNavigateToLogin: () => void;
};

export default function SignUpScreen({ onNavigateToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const isFormValid =
    email.length > 0 && password.length > 0 && confirmPassword.length > 0;

  const handleSignUp = async () => {
    setError('');
    setSuccess(false);

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-bg-main">
      <Text className="text-3xl font-extrabold text-text-primary text-center mb-2">
        Create Account
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-8">
        Start tracking your reading journey
      </Text>

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      {success ? (
        <Text className="text-sm text-accent text-center mb-4 bg-green-50 p-3 rounded-lg">
          Check your email for a confirmation link!
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
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-3"
      />

      <TextInput
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        className="bg-bg-sub rounded-xl p-3.5 text-base mb-5"
      />

      <TouchableOpacity
        onPress={handleSignUp}
        disabled={!isFormValid || loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? 'Signing up...' : 'Sign Up'}
        className={`rounded-xl p-4 items-center ${
          isFormValid && !loading ? 'bg-primary' : 'bg-primary/50'
        }`}
      >
        {loading ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white text-base font-bold">Signing up...</Text>
          </View>
        ) : (
          <Text className="text-white text-base font-bold">Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNavigateToLogin}
        className="mt-5 items-center"
      >
        <Text className="text-text-secondary text-sm">
          Already have an account?{' '}
          <Text className="text-primary font-semibold">Log In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
