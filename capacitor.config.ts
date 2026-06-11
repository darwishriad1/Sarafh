import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sally.cashier.app',
  appName: 'إدارة الصرف الميداني المعتمد',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
