import React from 'react';

export default function LiveMap({ latitude, longitude }) {
  if (latitude == null || longitude == null || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return React.createElement('div', { style: { padding: 24 } }, 'Aguardando posição GPS da máquina');
  const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : -7.115;
  const lng = Number.isFinite(Number(longitude)) ? Number(longitude) : -34.861;
  const delta = .012;
  const source = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-delta}%2C${lat-delta}%2C${lng+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lng}`;
  return React.createElement('iframe', { title: 'Posição GPS', src: source, loading: 'lazy', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 } });
}
