import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Props = {
  email: string;
};

export default function SettingsScreen({ email }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    setError('');
    setLoading(true);

    const { error: signOutError } = await supabase.auth.signOut();

    setLoading(false);

    if (signOutError) {
      setError(signOutError.message);
    }
  };

  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-text-primary mb-8">Settings</Text>

      {/* Account Info */}
      <View className="bg-bg-sub rounded-xl p-4 mb-6">
        <Text className="text-xs text-text-secondary mb-1">Account</Text>
        <Text className="text-base text-text-primary">{email}</Text>
      </View>

      {error ? (
        <Text className="text-sm text-danger text-center mb-4 bg-red-50 p-3 rounded-lg">
          {error}
        </Text>
      ) : null}

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Log Out"
        className="rounded-xl p-4 items-center border border-danger"
      >
        {loading ? (
          <ActivityIndicator color="#ef4444" size="small" />
        ) : (
          <Text className="text-danger text-base font-bold">Log Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
