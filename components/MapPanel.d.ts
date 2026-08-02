import { Item } from '@/lib/types';
import React from 'react';

interface MapPanelProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onRegionChange: (r: any) => void;
  items: Item[];
  onItemPress: (id: string) => void;
  showsUserLocation?: boolean;
  mapRef?: any;
}

export declare function MapPanel(props: MapPanelProps): React.JSX.Element;
