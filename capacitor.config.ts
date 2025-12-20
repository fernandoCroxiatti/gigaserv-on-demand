import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.2b1d77f735af4b4b861f94592a65d081',
  appName: 'GIGA S.O.S',
  webDir: 'dist',
  server: {
    url: 'https://2b1d77f7-35af-4b4b-861f-94592a65d081.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
