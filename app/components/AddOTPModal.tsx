import { parseOTP } from '@/lib/otpParser';
import { submitOTP } from '@/lib/smsService';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface AddOTPModalProps {
  visible: boolean;
  groupId: string;
  userId: string;
  onClose: () => void;
}

export default function AddOTPModal({ visible, groupId, userId, onClose }: AddOTPModalProps) {
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setSender('');
    setMessage('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const senderTrimmed = sender.trim();
    const messageTrimmed = message.trim();

    if (!senderTrimmed) {
      Alert.alert('Enter who this OTP is from, e.g. "SBI Bank"');
      return;
    }

    const parsed = parseOTP(messageTrimmed, senderTrimmed);
    const code = parsed?.code ?? messageTrimmed.match(/\b(\d{4,8})\b/)?.[1];

    if (!code) {
      Alert.alert('No code found', 'Paste the SMS text, or just type the 4-8 digit code.');
      return;
    }

    setLoading(true);
    try {
      await submitOTP({ groupId, userId, senderName: senderTrimmed, code });
      reset();
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not share this OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="bg-white rounded-t-3xl px-6 pt-6 pb-8"
        >
          <Text className="text-xl font-bold text-gray-900 mb-1">Add OTP manually</Text>
          <Text className="text-sm text-gray-500 mb-6">
            iOS can't read SMS automatically — paste the message or type the code yourself.
          </Text>

          <Text className="text-sm font-medium text-gray-700 mb-2">From</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            placeholder="e.g. SBI Bank"
            autoFocus
            maxLength={40}
            value={sender}
            onChangeText={setSender}
          />

          <Text className="text-sm font-medium text-gray-700 mb-2">SMS text or code</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
            placeholder="Paste the message, or just type 482913"
            multiline
            numberOfLines={3}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-4 items-center mb-3"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Share with group</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="items-center" onPress={handleClose} disabled={loading}>
            <Text className="text-gray-500 text-sm">Cancel</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
