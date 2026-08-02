import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { RefreshCw, MapPin } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { MapPanel } from '@/components/MapPanel';
import type { Item } from '@/lib/types';
import MapView from 'react-native-maps';
import useSWR from 'swr';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [error, setError] = useState<string | null>(null);
  const fetcher = async (url: string) => {
    const { data, err } = await fetchItems(region);
    if (err) throw new Error(err);
    return data;
  };

  const { data: items = [], error: fetchError, mutate, isValidating } = useSWR(
    `items_${region.latitude.toFixed(2)}_${region.longitude.toFixed(2)}`,
    fetcher,
    { dedupingInterval: 10000 }
  );

  useEffect(() => {
    if (fetchError) setError(fetchError.message);
    else setError(null);
  }, [fetchError]);

  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        mutate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied — showing default area.');
          setRegion(DEFAULT_REGION);
          return;
        }
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!loc) {
          loc = await Location.getLastKnownPositionAsync() as Location.LocationObject;
        }
        
        if (loc) {
          const newRegion = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
        } else {
          setError('Could not get your location.');
        }
      } catch (err: any) {
        // Fallback to default region if location fails completely
        setError('Location unavailable. Using default area.');
        setRegion(DEFAULT_REGION);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Nearby items</Text>
          <Text style={styles.subtext}>
            {profile?.name ? `Welcome, ${profile.name.split(' ')[0]}` : 'Explore the swap map'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => mutate()} disabled={isValidating}>
          {isValidating ? (
            <ActivityIndicator size="small" color={theme.colors.primary[600]} />
          ) : (
            <RefreshCw size={18} color={theme.colors.primary[600]} />
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <MapPanel
        mapRef={mapRef}
        region={region}
        onRegionChange={handleRegionChange}
        items={items}
        onItemPress={(itemId) => router.push(`/item/${itemId}`)}
        showsUserLocation
      />

      <View style={styles.listToggle}>
        <MapPin size={14} color={theme.colors.primary[600]} />
        <Text style={styles.listToggleText}>{items.length} items in view</Text>
      </View>
    </SafeAreaView>
  );
}

async function fetchItems(region: Region): Promise<{ data: Item[]; err: string | null }> {
  const latDelta = region.latitudeDelta;
  const lngDelta = region.longitudeDelta;
  const minLat = region.latitude - latDelta;
  const maxLat = region.latitude + latDelta;
  const minLng = region.longitude - lngDelta;
  const maxLng = region.longitude + lngDelta;

  const { data, error } = await supabase
    .from('items')
    .select('id, owner_id, title, description, photo_url, token_price, lat, lng, status, created_at, owner:users!items_owner_id_fkey(id, name, avatar_url, rating_avg, is_blocked)')
    .eq('status', 'available')
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) return { data: [], err: error.message };
  return { data: (data as unknown as Item[]) || [], err: null };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtext: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBar: { backgroundColor: '#fef2f2', paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: theme.colors.error, fontSize: 12, fontFamily: theme.fonts.regular },
  listToggle: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: theme.colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    gap: 6,
  },
  listToggleText: { fontSize: 13, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
});
