export async function loadCurrentTrack() {
  const response = await fetch('/api/track/current', {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Track API returned ${response.status}`);
  const data = await response.json();
  const feature = data.circuit?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'LineString' || !Array.isArray(coordinates)
    || coordinates.length < 4 || !coordinates.every(point => Array.isArray(point)
      && point.length >= 2 && point.slice(0, 2).every(Number.isFinite))) {
    throw new Error('Track API returned invalid circuit geometry');
  }
  return data;
}
