import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.booknookapp',
  appName: 'Booknook',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#2B1A0F',
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'booknook-release-key.jks',
      keystoreAlias: 'booknook',
    },
  },
};

export default config;
