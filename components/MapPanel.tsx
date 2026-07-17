import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';

// react-native-maps is native-only; we load it dynamically so the web build
// doesn't try to import native RN internals.
let MapView: any = null;
let Marker: any = null;
let MapModuleLoaded = false;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    MapModuleLoaded = true;
  } catch {
    // module not available
  }
}

interface MapPanelProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onRegionChange: (r: any) => void;
  items: Item[];
  onItemPress: (id: string) => void;
  showsUserLocation?: boolean;
}

export function MapPanel({ region, onRegionChange, items, onItemPress, showsUserLocation }: MapPanelProps) {
  if (Platform.OS === 'web' || !MapModuleLoaded || !MapView || !Marker) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={theme.colors.primary[500]} />
        <Text style={styles.fallbackText}>Map view is available on mobile devices.</Text>
        <Text style={styles.fallbackSubtext}>{items.length} items nearby</Text>
      </View>
    );
  }

  const MapViewComp = MapView as any;
  const MarkerComp = Marker as any;
  return (
    <MapViewComp
      style={{ flex: 1 }}
      region={region}
      onRegionChangeComplete={onRegionChange}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton
    >
      {items.map((item: Item) => (
        <MarkerComp
          key={item.id}
          coordinate={{ latitude: item.lat, longitude: item.lng }}
          onPress={() => onItemPress(item.id)}
        />
      ))}
    </MapViewComp>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.neutral[100], gap: 8 },
  fallbackText: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  fallbackSubtext: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
});
