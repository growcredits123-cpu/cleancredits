import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    const { error } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  }

  async function handleApple() {
    setError(null);
    const { error } = await signInWithApple();
    if (error) setError(error);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Image source={require('@/assets/images/icon.png')} style={{ width: 72, height: 72, borderRadius: 36 }} resizeMode="cover" />
            </View>
            <Text style={styles.title}>GrowCredits</Text>
            <Text style={styles.subtitle}>Earn credits, exchange items, recycle locally.</Text>
          </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.neutral[400]}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.neutral[400]}
            secureTextEntry
            textContentType="password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.oauthRow}>
            <TouchableOpacity style={styles.oauthBtn} onPress={handleGoogle}>
              <Text style={styles.oauthText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.oauthBtn} onPress={handleApple}>
              <Text style={styles.oauthText}>Apple</Text>
            </TouchableOpacity>
          </View>

          <Link href="/(auth)/signup" style={styles.link}>
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkBold}>Create an account</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary[600],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 15, color: theme.colors.textMuted, marginTop: 6, fontFamily: theme.fonts.regular },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6, marginTop: 12, fontFamily: theme.fonts.bold },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  error: { color: theme.colors.error, fontSize: 13, marginTop: 10, fontFamily: theme.fonts.regular },
  primaryBtn: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: theme.colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: theme.fonts.bold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  divider: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: theme.colors.neutral[400], fontFamily: theme.fonts.regular },
  oauthRow: { flexDirection: 'row', gap: 12 },
  oauthBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  oauthText: { fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  link: { alignSelf: 'center', marginTop: 24 },
  linkText: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  linkBold: { color: theme.colors.primary[600], fontWeight: '700', fontFamily: theme.fonts.bold },
});
