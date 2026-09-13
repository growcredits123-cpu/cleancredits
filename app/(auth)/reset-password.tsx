import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { session } = useAuth();

  async function handleUpdatePassword() {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    setBusy(false);
    
    if (error) {
      setError(error.message);
    } else {
      Alert.alert(
        "Password Updated",
        "Your password has been successfully updated. You can now use the app.",
        [{ text: "OK", onPress: () => router.replace('/(tabs)/profile') }]
      );
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scroll} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.brand}>
            <Text style={styles.title}>New Password</Text>
            <Text style={styles.subtitle}>
              {session ? "Enter your new password below." : "Waiting for secure session... Please ensure you clicked the link from your email on this device."}
            </Text>
          </Animated.View>

          {session && (
            <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.form}>
              <View style={styles.inputGroup}>
                <View style={styles.inputWrapper}>
                  <Lock size={20} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor={theme.colors.neutral[400]}
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? (
                      <EyeOff size={20} color={theme.colors.neutral[400]} />
                    ) : (
                      <Eye size={20} color={theme.colors.neutral[400]} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdatePassword} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </Animated.View>
          )}
          
          {!session && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.cancelText}>Back to Sign In</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: 36, marginTop: 20, maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular, textAlign: 'center', lineHeight: 24 },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 },
  inputGroup: { width: '100%' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 20,
    height: 60,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    height: '100%',
  },
  error: { color: theme.colors.error, fontSize: 14, textAlign: 'center', marginTop: 4, fontFamily: theme.fonts.regular },
  primaryBtn: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.full,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...theme.elevation.sm,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: theme.fonts.bold },
  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 20 },
  cancelText: { fontSize: 15, color: theme.colors.neutral[500], fontFamily: theme.fonts.regular },
});
