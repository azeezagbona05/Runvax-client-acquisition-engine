'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, CircleF, useJsApiLoader } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { Business } from '@/types';

interface SearchMapProps {
  countryName: string | null;
  stateName: string | null;
  areaName: string | null;
  radiusKm: number;
  businesses: Business[];
  searching: boolean;
}

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos — sensible default before any selection
const DEFAULT_ZOOM = 4;

// Muted dark style so the map sits naturally inside the app's dark theme instead of a jarring white default
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1b1a24' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#131319' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#938fa3' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3c3648' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#201d28' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#322d3d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#453f54' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3a3348' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#5b5270' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1620' }] },
] as google.maps.MapTypeStyle[];

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_MAP_STYLE,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'cooperative',
  backgroundColor: '#0c1620',
};

export default function SearchMap({ countryName, stateName, areaName, radiusKm, businesses, searching }: SearchMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'aip-google-map-script',
    googleMapsApiKey: apiKey || '',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
  }, []);
  const onUnmount = useCallback(() => { mapRef.current = null; }, []);

  // Geocode the most specific location we currently have and pan/zoom the live map to it
  useEffect(() => {
    if (!isLoaded) return;
    const query = [areaName, stateName, countryName].filter(Boolean).join(', ');
    if (!query) return;
    const zoom = areaName ? 14 : stateName ? 10 : 6;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!geocoderRef.current) return;
      geocoderRef.current.geocode({ address: query }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) return;
        const loc = results[0].geometry.location;
        const next = { lat: loc.lat(), lng: loc.lng() };
        setCenter(next);
        const map = mapRef.current;
        if (map) { map.panTo(next); map.setZoom(zoom); }
      });
    }, 550);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [isLoaded, countryName, stateName, areaName]);

  // Once results land, frame the map around every pinned business
  const located = useMemo(() => businesses.filter((b) => b.location), [businesses]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || located.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    located.forEach((b) => bounds.extend({ lat: b.location!.latitude, lng: b.location!.longitude }));
    map.fitBounds(bounds, 48);
  }, [located]);

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <div className="flex items-center justify-center h-full text-xs text-gray-500 px-4 text-center">
          Set <code className="mx-1 text-purple-400">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the map preview.
        </div>
      );
    }
    return null;
  }

  if (loadError) {
    return <div className="flex items-center justify-center h-full text-xs text-gray-500">Map failed to load.</div>;
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {center && (
          <CircleF
            center={center}
            radius={radiusKm * 1000}
            options={{
              strokeColor: '#a855f7', strokeOpacity: 0.4, strokeWeight: 1,
              fillColor: '#a855f7', fillOpacity: 0.08, clickable: false,
            }}
          />
        )}
        {located.map((b, i) => (
          <MarkerF
            key={b.id}
            position={{ lat: b.location!.latitude, lng: b.location!.longitude }}
            label={{ text: String(i + 1), color: '#fff', fontSize: '10px', fontWeight: '700' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: b.hasWebsite ? '#a855f7' : '#22c55e',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => setActiveMarker(b.id)}
          >
            {activeMarker === b.id && (
              <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                <div className="text-xs text-gray-900 max-w-[180px]">
                  <p className="font-bold">{b.name}</p>
                  <p className="text-gray-600">{b.category}</p>
                  {!b.hasWebsite && <p className="text-orange-600 font-semibold mt-1">No website</p>}
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}
      </GoogleMap>

      {searching && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 w-56 h-56 -mt-28 -ml-28 rounded-full opacity-30 animate-map-sweep"
            style={{ background: 'conic-gradient(from 0deg, #a855f7 0deg, transparent 55deg, transparent 360deg)' }}
          />
        </div>
      )}

      {located.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur border border-purple-500/25 rounded-md px-2.5 py-1 text-[11px] text-white">
          <span className="font-bold text-purple-300">{located.length}</span> found
        </div>
      )}
    </div>
  );
}
