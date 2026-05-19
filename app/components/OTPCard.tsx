import { OTP } from '@/lib/types';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface OTPCardProps {
  otp: OTP;
  onExpire: (id: string) => void;
}

export default function OTPCard({ otp, onExpire }: OTPCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = new Date(otp.expires_at).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire(otp.id);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onExpire(otp.id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = async () => {
    if (!otp.otp_code) return;
    await Clipboard.setStringAsync(otp.otp_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const urgency = secondsLeft < 30 ? 'text-red-500' : secondsLeft < 60 ? 'text-orange-500' : 'text-gray-400';
  const borderColor = secondsLeft < 30 ? 'border-red-200' : 'border-gray-100';

  return (
    <View className={`bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm border ${borderColor}`}>
      {/* Header row */}
      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-base font-semibold text-gray-800">{otp.sender_name}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {otp.sender_profile?.display_name ?? otp.sender_profile?.phone ?? 'Family member'}
          </Text>
        </View>
        <Text className={`text-sm font-medium tabular-nums ${urgency}`}>
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </Text>
      </View>

      {/* OTP + Copy */}
      <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <Text className="text-3xl font-bold tracking-widest text-gray-900 font-mono">
          {otp.otp_code ?? '······'}
        </Text>
        <TouchableOpacity
          className={`px-3 py-1.5 rounded-lg ${copied ? 'bg-green-100' : 'bg-blue-100'}`}
          onPress={handleCopy}
        >
          <Text className={`text-sm font-semibold ${copied ? 'text-green-700' : 'text-blue-700'}`}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time received */}
      <Text className="text-xs text-gray-300 mt-2 text-right">
        {new Date(otp.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}
