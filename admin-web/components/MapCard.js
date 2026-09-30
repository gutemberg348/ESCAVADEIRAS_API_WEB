'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const DEFAULT_CENTER = [-7.115, -34.861];

function validPosition(machine) {
  if (machine?.currentState?.latitude == null || machine?.currentState?.longitude == null) return false;
  const latitude = Number(machine?.currentState?.latitude);
  const longitude = Number(machine?.currentState?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function markerColor(status) {
  if (status === 'ALERT') return '#ffb020';
  if (status === 'OFFLINE' || status === 'DISABLED') return '#77808e';
  if (status === 'MAINTENANCE') return '#4f8cff';
  return '#37d67a';
}

export default function MapCard({ machines = [], focus }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const points = useMemo(() => (focus ? [focus] : machines).filter(validPosition), [focus, machines]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(hostRef.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    import('leaflet').then(({ default: L }) => {
      const layer = layerRef.current;
      const map = mapRef.current;
      if (!layer || !map) return;
      layer.clearLayers();
      const bounds = [];
      points.forEach((machine) => {
        const position = [Number(machine.currentState.latitude), Number(machine.currentState.longitude)];
        const marker = L.circleMarker(position, {
          radius: focus ? 10 : 8,
          color: '#10151c',
          weight: 3,
          fillColor: markerColor(machine.status),
          fillOpacity: 1
        }).addTo(layer);
        const popup = document.createElement('div');
        const title = document.createElement('strong');
        const details = document.createElement('span');
        title.textContent = `${machine.code || 'Máquina'} · ${machine.name || ''}`;
        const driver = machine.assignments?.[0]?.driverProfile?.user?.name || 'Aguardando identificação';
        details.textContent = `${machine.status || 'SEM STATUS'} · ${machine.currentState.speed ?? '—'} km/h · ${driver}`;
        popup.className = 'map-popup-copy';
        popup.append(title, details);
        marker.bindPopup(popup);
        marker.bindTooltip(machine.code || 'Máquina', { direction: 'top', offset: [0, -8] });
        bounds.push(position);
      });
      if (bounds.length === 1) map.setView(bounds[0], focus ? 16 : 14, { animate: true });
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    });
  }, [points, focus, ready]);

  return (
    <section className={`fleet-map-canvas real-map ${focus ? 'focus' : ''}`}>
      <div ref={hostRef} className="leaflet-host" />
      {!points.length && (
        <div className="map-empty-overlay"><MapPin size={20} /><strong>Sem posição GPS</strong><span>Aguardando a primeira coordenada do dispositivo.</span></div>
      )}
      <div className="map-live-badge"><i />{points.some(item => item.currentState?.online && item.currentState?.gpsValid) ? 'GPS ATUALIZADO' : 'ÚLTIMA POSIÇÃO / AGUARDANDO GPS'}</div>
    </section>
  );
}
