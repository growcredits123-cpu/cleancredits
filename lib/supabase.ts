import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sruluflddqhxghibysvb.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydWx1ZmxkZHFoeGdoaWJ5c3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNTM3OTUsImV4cCI6MjA5OTkyOTc5NX0.dNjCMokdpMjtGSmUKI-a7qxzZ9LI3wuVQbkUlrve0Wg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
