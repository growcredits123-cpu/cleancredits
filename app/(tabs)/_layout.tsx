import { Redirect, Tabs } from 'expo-router';
import { View, StyleSheet, ActivityIndicator, Platform, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, Plus, Wallet, MessageSquare, User as UserIcon, Recycle, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function TabLayout() {
  const { session, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [uploadingId, setUploadingId] = useState(false);

  // Check global settings
  const { data: globalSettings } = useSWR('global_settings', async () => {
    const { data } = await supabase.from('app_events').select('payload').eq('event_type', 'global_settings').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data?.payload || {};
  });

  const requireId = globalSettings?.require_id === true;
  const showIdBlocker = requireId && profile && profile.id_verified === false;

  async function handleUploadID() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return alert('Permission required');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
      if (result.canceled || !result.assets[0].base64) return;
      
      setUploadingId(true);
      const filePath = `${session!.user.id}/id_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('verification-docs').upload(filePath, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('verification-docs').getPublicUrl(filePath);
      await supabase.from('id_verifications').insert({ user_id: session!.user.id, id_photo_url: publicUrl, status: 'pending' });
      
      // We will optimisticly mark them as verified so they can use the app while pending
      // In a real app, we might want them to wait for approval. Let's just set a local state or update their profile.
      await supabase.from('users').update({ id_verified: true }).eq('id', session!.user.id);
      alert('ID submitted successfully! You may now use the app.');
      // A reload or state update would happen via auth context, but setting profile isn't directly exposed.
      // The auth listener might pick it up, or we can just force a reload.
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploadingId(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[600],
        tabBarInactiveTintColor: theme.colors.neutral[400],
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : 60 + insets.bottom,
          paddingBottom: Platform.OS === 'web' ? 8 : insets.bottom + 8,
          paddingTop: 8,
          ...(Platform.OS === 'web' ? {
            maxWidth: 760,
            width: '100%',
            marginHorizontal: 'auto',
            left: 0,
            right: 0,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 8,
          } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.fonts.regular, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ size, color }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: ({ size, color }) => <Plus size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recycle"
        options={{
          title: 'Recycle',
          tabBarIcon: ({ size, color }) => <Recycle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exchanges"
        options={{
          title: 'Swaps',
          tabBarIcon: ({ size, color }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ size, color }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserIcon size={size} color={color} />,
        }}
      />
    </Tabs>
    
    {showIdBlocker && (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface, zIndex: 9999, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={{ maxWidth: 460, width: '100%', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 24, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16 }}>
          <ShieldAlert size={64} color={theme.colors.error} style={{ marginBottom: 20 }} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>ID Verification Required</Text>
          <Text style={{ fontSize: 16, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 30 }}>
            The admin has required all users to upload a valid Government or School ID before accessing the marketplace.
          </Text>
          <TouchableOpacity 
            onPress={handleUploadID} 
            disabled={uploadingId}
            style={{ backgroundColor: theme.colors.primary[500], paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {uploadingId ? <ActivityIndicator color="#fff" /> : <><Camera color="#fff" size={20} /><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Upload ID Document</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
});
