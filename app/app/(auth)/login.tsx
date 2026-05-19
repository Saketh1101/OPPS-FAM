import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendOTP = async () => {
    const cleaned = phone.trim().replace(/\s+/g, '');
    // Must be E.164 format: +91XXXXXXXXXX
    if (!/^\+[1-9]\d{9,14}$/.test(cleaned)) {
      Alert.alert('Invalid number', 'Enter phone with country code, e.g. +919876543210');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: cleaned });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.push({ pathname: '/(auth)/verify', params: { phone: cleaned } });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white px-6 justify-center"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text className="text-3xl font-bold text-gray-900 mb-2">OTPShare</Text>
      <Text className="text-base text-gray-500 mb-10">
        Share OTPs instantly with your family
      </Text>

      <Text className="text-sm font-medium text-gray-700 mb-2">Phone number</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={setPhone}
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center"
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Send OTP</Text>
        )}
      </TouchableOpacity>

      <Text className="text-xs text-gray-400 text-center mt-6">
        We'll send a one-time code to verify your number.
      </Text>
    </KeyboardAvoidingView>
  );
}
