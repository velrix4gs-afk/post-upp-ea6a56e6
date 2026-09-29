import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.postupp.app',
  appName: 'post-upp',
  webDir: 'dist',
  server: {
    url: 'https://post-upp.vercel.app',
    cleartext: true
  }
};

export default config;
