import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tsnwlvyaqiilvhoimhkp.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbndsdnlhcWlpbHZob2ltaGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTYwNzksImV4cCI6MjEwMTE5MjA3OX0.CnLhKrTqnZMMiYoOP1IjxT1PNk7a1OlGpf-GrJo0oQY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
