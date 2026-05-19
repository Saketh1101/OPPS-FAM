import { OTP } from '@/lib/types';
import { create } from 'zustand';

interface OTPState {
  otps: OTP[];
  addOTP: (otp: OTP) => void;
  removeOTP: (id: string) => void;
  setOTPs: (otps: OTP[]) => void;
}

export const useOTPStore = create<OTPState>((set) => ({
  otps: [],
  addOTP: (otp) =>
    set((state) => ({
      otps: [otp, ...state.otps.filter((o) => o.id !== otp.id)],
    })),
  removeOTP: (id) =>
    set((state) => ({ otps: state.otps.filter((o) => o.id !== id) })),
  setOTPs: (otps) => set({ otps }),
}));
