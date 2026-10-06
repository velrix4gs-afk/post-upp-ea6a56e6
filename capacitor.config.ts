import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.postupp.app',
  appName: 'Post Up',
  webDir: 'dist',
  // The app ships its own web build (dist/) instead of pointing at the
  // deployed site. Pointing server.url at a remote origin made the Android
  // app a browser wrapper: it needed a connection to open at all, none of
  // the JS was bundled, and offline use was impossible. Leave server.url
  // unset for a real app; only set it temporarily when live-reloading
  // against a dev server.
  android: {
    // Allow mixed content only where the app talks to its own HTTPS backend.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0EA5E9',
      showSpinner: false,
    },
  },
};

export default config;
