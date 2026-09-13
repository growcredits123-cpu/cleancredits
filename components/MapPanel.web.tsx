import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';

export interface MapRef {
  animateToRegion: (region: { latitude: number; longitude: number }, duration?: number) => void;
}

interface MapPanelProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onRegionChange: (r: any) => void;
  items: Item[];
  onItemPress: (id: string) => void;
  showsUserLocation?: boolean;
  mapRef?: React.RefObject<MapRef | null>;
}

export function MapPanel({ region, onRegionChange, items, onItemPress, showsUserLocation = true, mapRef }: MapPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(mapRef, () => ({
    animateToRegion: (newRegion) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: 'setCenter', lat: newRegion.latitude, lng: newRegion.longitude }),
          '*'
        );
      } catch (e) {}
    }
  }));

  const validItems = useMemo(() => {
    return (items || []).filter(
      (item) => item && typeof item.lat === 'number' && typeof item.lng === 'number' && !isNaN(item.lat) && !isNaN(item.lng)
    );
  }, [items]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type === 'markerPress' && data.id) {
          onItemPress(data.id);
        } else if (data?.type === 'regionChange' && data.region) {
          onRegionChange(data.region);
        }
      } catch (err) {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [onItemPress, onRegionChange]);

  // Send items update whenever validItems changes
  useEffect(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'updateItems', items: validItems }),
        '*'
      );
    } catch (e) {}
  }, [validItems]);

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #map { height: 100%; width: 100%; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .custom-marker {
          background: #16a34a;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          width: 26px;
          height: 26px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .custom-marker:hover {
          transform: scale(1.15);
          background: #15803d;
        }
        .marker-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .marker-label {
          background: rgba(255, 255, 255, 0.95);
          padding: 3px 10px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          box-shadow: 0 2px 6px rgba(0,0,0,0.18);
          white-space: nowrap;
          border: 1px solid rgba(226, 232, 240, 0.8);
          backdrop-filter: blur(4px);
        }
        .user-marker {
          background: #2563eb;
          border: 3px solid #ffffff;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25), 0 2px 6px rgba(0,0,0,0.3);
        }
        .locate-btn {
          position: absolute;
          bottom: 24px;
          right: 20px;
          z-index: 1000;
          background: #ffffff;
          border-radius: 50%;
          box-shadow: 0 3px 10px rgba(0,0,0,0.22);
          cursor: pointer;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          transition: transform 0.15s ease, background 0.15s ease;
          font-size: 18px;
        }
        .locate-btn:hover {
          transform: scale(1.08);
          background: #f8fafc;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 3px 10px rgba(0,0,0,0.15) !important;
          border-radius: 10px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 16px !important;
          color: #334155 !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="locate-btn" title="Locate Me" onclick="locateUser()">🎯</div>
      <script>
        var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${region.latitude}, ${region.longitude}], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19,
          subdomains: ['a', 'b', 'c']
        }).addTo(map);

        setTimeout(function() {
          map.invalidateSize();
        }, 200);

        window.addEventListener('resize', function() {
          map.invalidateSize();
        });

        var markers = {};
        var userMarker = null;
        var currentLat = ${region.latitude};
        var currentLng = ${region.longitude};

        if (${showsUserLocation ? 'true' : 'false'}) {
          var userIcon = L.divIcon({ className: 'user-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
          userMarker = L.marker([currentLat, currentLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        }

        function locateUser() {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(pos) {
              var uLat = pos.coords.latitude;
              var uLng = pos.coords.longitude;
              currentLat = uLat;
              currentLng = uLng;
              map.setView([uLat, uLng], 15);
              if (userMarker) {
                userMarker.setLatLng([uLat, uLng]);
              } else {
                var userIcon = L.divIcon({ className: 'user-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
                userMarker = L.marker([uLat, uLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
              }
              safePostMessage({
                type: 'regionChange',
                region: { latitude: uLat, longitude: uLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              });
            }, function() {
              map.setView([currentLat, currentLng], 14);
            }, { enableHighAccuracy: true });
          } else {
            map.setView([currentLat, currentLng], 14);
          }
        }

        function safePostMessage(msg) {
          try {
            window.parent.postMessage(JSON.stringify(msg), '*');
          } catch(e) {}
        }

        function addMarker(id, lat, lng, title) {
          var safeTitle = (title || 'Item').replace(/['"<>]/g, '');
          var htmlStr = '<div class="custom-marker">🌿</div><div class="marker-label">' + safeTitle + '</div>';
          var icon = L.divIcon({ className: 'marker-wrapper', html: htmlStr, iconSize: null, iconAnchor: [13, 13] });
          var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
          marker.on('click', function() {
            safePostMessage({ type: 'markerPress', id: id });
          });
          markers[id] = marker;
        }

        map.on('moveend', function() {
          var center = map.getCenter();
          var bounds = map.getBounds();
          var latDelta = Math.abs(bounds.getNorth() - bounds.getSouth());
          var lngDelta = Math.abs(bounds.getEast() - bounds.getWest());
          safePostMessage({
            type: 'regionChange',
            region: { latitude: center.lat, longitude: center.lng, latitudeDelta: latDelta, longitudeDelta: lngDelta }
          });
        });

        // Initial items render
        var initialItems = ${JSON.stringify(validItems)};
        if (initialItems && initialItems.length) {
          initialItems.forEach(function(item) {
            addMarker(item.id, item.lat, item.lng, item.title);
          });
        }

        function handleMessage(e) {
          try {
            var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (data.type === 'updateItems') {
              for (var id in markers) { map.removeLayer(markers[id]); }
              markers = {};
              if (data.items) {
                data.items.forEach(function(item) { addMarker(item.id, item.lat, item.lng, item.title); });
              }
            } else if (data.type === 'setCenter') {
              currentLat = data.lat;
              currentLng = data.lng;
              map.setView([data.lat, data.lng], 15);
              if (userMarker) userMarker.setLatLng([data.lat, data.lng]);
            }
          } catch(err) {}
        }
        
        window.addEventListener('message', handleMessage);
      </script>
    </body>
    </html>
  `, [region.latitude, region.longitude, showsUserLocation]);

  return (
    <View style={styles.container}>
      <iframe
        ref={iframeRef as any}
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#f8fafc',
        }}
        title="FruitMap Interactive Map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.neutral[100],
    overflow: 'hidden',
  },
});
