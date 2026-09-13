import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setError(null);
    setBusy(true);
    const { error: resetError } = await resetPassword(email.trim());
    setBusy(false);
    
    if (resetError) {
      setError(resetError);
    } else {
      setSuccess(true);
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
          <View style={styles.cardContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>

          <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.brand}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {success 
                ? "Check your email for a password reset link. You can close this screen once you've reset your password."
                : "Enter your email address and we'll send you a link to reset your password."}
            </Text>
          </Animated.View>

          {!success && (
            <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.form}>
              <View style={styles.inputGroup}>
                <View style={styles.inputWrapper}>
                  <Mail size={20} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={theme.colors.neutral[400]}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
              </TouchableOpacity>
            </Animated.View>
          )}

          {success && (
            <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.form}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
                <Text style={styles.primaryBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  cardContainer: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  brand: { marginBottom: 36 },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular, lineHeight: 24 },
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
});
