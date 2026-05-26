import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.courtgo.app',
  appName: 'CourtGo',
  webDir: 'dist/frontend/browser',
  plugins: {
    StatusBar: {
      backgroundColor: '#0c1a11',
      style: 'DARK',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0c1a11',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
