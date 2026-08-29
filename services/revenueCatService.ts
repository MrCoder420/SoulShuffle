import { Platform } from 'react-native';

class RevenueCatService {
  private static isConfigured = false;

  static async initialize(userId?: string): Promise<void> {
    try {
      if (this.isConfigured) return;

      let Purchases: any = null;
      try {
        Purchases = require('react-native-purchases').default || require('react-native-purchases');
      } catch (e) {
        // Native module unavailable in Expo Go
        console.log('[RevenueCatService] Purchases module not available in standard Expo Go.');
        return;
      }

      const apiKey = Platform.OS === 'ios' 
        ? (process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || 'appl_dummy_key')
        : (process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || 'goog_dummy_key');

      if (Purchases && typeof Purchases.configure === 'function') {
        Purchases.configure({
          apiKey,
          appUserID: userId || undefined,
        });
        this.isConfigured = true;
      }
    } catch (e) {
      console.log('[RevenueCatService] Init skipped in development:', e);
    }
  }

  static async identify(userId: string): Promise<void> {
    try {
      if (!this.isConfigured) {
        await this.initialize(userId);
      }
      let Purchases: any = null;
      try {
        Purchases = require('react-native-purchases').default || require('react-native-purchases');
      } catch (e) {}

      if (Purchases && typeof Purchases.logIn === 'function') {
        await Purchases.logIn(userId);
      }
    } catch (e) {
      console.log('[RevenueCatService] logIn skipped:', e);
    }
  }

  static async logout(): Promise<void> {
    try {
      let Purchases: any = null;
      try {
        Purchases = require('react-native-purchases').default || require('react-native-purchases');
      } catch (e) {}

      if (this.isConfigured && Purchases && typeof Purchases.logOut === 'function') {
        await Purchases.logOut();
      }
    } catch (e) {
      console.log('[RevenueCatService] logOut skipped:', e);
    }
  }
}

export default RevenueCatService;
