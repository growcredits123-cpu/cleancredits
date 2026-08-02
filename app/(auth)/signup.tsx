import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Mail, Lock, User } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

export default function SignupScreen() {
  const { signUpWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const { error } = await signUpWithEmail(email.trim(), password, name.trim());
    setBusy(false);
    if (error) setError(error);
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
            <View style={styles.logo}>
              <Image 
                source={require('@/assets/images/icon.png')} 
                style={{ width: 80, height: 80, borderRadius: 24 }} 
                resizeMode="cover" 
              />
            </View>
            <Text style={styles.title}>Join GrowCredits</Text>
            <Text style={styles.subtitle}>Create an account to start earning</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.form}>
            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <User size={20} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={theme.colors.neutral[400]}
                  textContentType="name"
                />
              </View>
            </View>

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

            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor={theme.colors.neutral[400]}
                  secureTextEntry
                  textContentType="newPassword"
                />
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignUp} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkBold}>Sign in</Text>
              </Text>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...theme.elevation.md,
  },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular },
  form: { width: '100%', gap: 16 },
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
  link: { alignSelf: 'center', marginTop: 24, paddingVertical: 8 },
  linkText: { fontSize: 15, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  linkBold: { color: theme.colors.primary[600], fontWeight: '700', fontFamily: theme.fonts.bold },
});
