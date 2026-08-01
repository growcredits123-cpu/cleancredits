import React, { Component } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';
import MapView, { Marker } from 'react-native-maps';

interface MapPanelProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onRegionChange: (r: any) => void;
  items: Item[];
  onItemPress: (id: string) => void;
  showsUserLocation?: boolean;
}

class MapErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('Map rendering error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackSubtext}>Map Preview</Text>
          <Text style={styles.fallbackText}>Interactive map unavailable on this device.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function MapPanel({ region, onRegionChange, items, onItemPress, showsUserLocation }: MapPanelProps) {
  const validItems = (items || []).filter(
    (item) =>
      item &&
      typeof item.lat === 'number' &&
      typeof item.lng === 'number' &&
      !isNaN(item.lat) &&
      !isNaN(item.lng)
  );

  return (
    <MapErrorBoundary>
      <MapView
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={onRegionChange}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton
      >
        {validItems.map((item: Item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            onPress={() => onItemPress(item.id)}
          />
        ))}
      </MapView>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.neutral[100], gap: 8 },
  fallbackText: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  fallbackSubtext: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
});
