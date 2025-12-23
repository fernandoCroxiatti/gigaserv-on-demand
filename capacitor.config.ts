import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.2b1d77f735af4b4b861f94592a65d081',
  appName: 'GIGA S.O.S',
  webDir: 'dist',
  server: {
    // For development: point to sandbox URL
    // For production: comment out or remove the url property
    url: 'https://2b1d77f7-35af-4b4b-861f-94592a65d081.lovableproject.com?forceHideBadge=true',
    cleartext: true // Required for Android to allow HTTP during development
  },
  android: {
    // Permissions are declared in AndroidManifest.xml
    // These are automatically added by Capacitor plugins
    allowMixedContent: false // Disable mixed content for security in production
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
