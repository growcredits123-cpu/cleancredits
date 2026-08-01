import React from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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

export function MapPanel({ region, onRegionChange, items, onItemPress, showsUserLocation }: MapPanelProps) {
  return (
    <MapView
      style={{ flex: 1 }}
      region={region}
      onRegionChangeComplete={onRegionChange}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton
    >
      {items.map((item: Item) => (
        <Marker
          key={item.id}
          coordinate={{ latitude: item.lat, longitude: item.lng }}
          onPress={() => onItemPress(item.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.neutral[100], gap: 8 },
  fallbackText: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  fallbackSubtext: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
});
