import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (otp.length < 6) {
      Alert.alert('Enter the 6-digit code sent to your phone');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone!,
      token: otp.trim(),
      type: 'sms',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Invalid code', error.message);
      return;
    }
    // RootLayout auth guard will redirect to /(tabs)/feed automatically
  };

  const handleResend = async () => {
    await supabase.auth.signInWithOtp({ phone: phone! });
    Alert.alert('Code resent', `A new code was sent to ${phone}`);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white px-6 justify-center"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity className="mb-8" onPress={() => router.back()}>
        <Text className="text-blue-600 text-base">← Back</Text>
      </TouchableOpacity>

      <Text className="text-2xl font-bold text-gray-900 mb-2">Verify your number</Text>
      <Text className="text-base text-gray-500 mb-8">
        Enter the 6-digit code sent to{'\n'}
        <Text className="font-semibold text-gray-700">{phone}</Text>
      </Text>

      <TextInput
        ref={inputRef}
        className="border border-gray-300 rounded-xl px-4 py-4 text-center text-3xl tracking-widest text-gray-900 mb-6"
        placeholder="------"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        value={otp}
        onChangeText={setOtp}
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center mb-4"
        onPress={handleVerify}
        disabled={loading || otp.length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} className="items-center">
        <Text className="text-gray-500 text-sm">
          Didn't get a code? <Text className="text-blue-600 font-medium">Resend</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
