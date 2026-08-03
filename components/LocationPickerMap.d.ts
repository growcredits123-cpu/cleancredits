import React from 'react';

export interface LocationPickerRef {
  setCenter: (lat: number, lng: number) => void;
}

export interface LocationPickerMapProps {
  initialCoords?: { lat: number; lng: number } | null;
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  pickerRef?: React.RefObject<LocationPickerRef | null>;
  height?: number;
}

export declare function LocationPickerMap(props: LocationPickerMapProps): React.JSX.Element;
