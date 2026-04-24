/** Shared logical view for map SVGs (2:1 world aspect). */
export const MAP_VIEW_W = 1000;
export const MAP_VIEW_H = 500;

export type MapPoint = { x: number; y: number };

export function projectWorld(lon: number, lat: number): MapPoint {
  const x = ((lon + 180) / 360) * MAP_VIEW_W;
  const y = ((90 - lat) / 180) * MAP_VIEW_H;
  return { x, y };
}

const USA = {
  lonMin: -125.2,
  lonMax: -66.2,
  latMin: 24.3,
  latMax: 49.4
};

export function projectUsa(lon: number, lat: number): MapPoint {
  const x = ((lon - USA.lonMin) / (USA.lonMax - USA.lonMin)) * MAP_VIEW_W;
  const y = ((USA.latMax - lat) / (USA.latMax - USA.latMin)) * MAP_VIEW_H;
  return { x, y };
}

export function inUsaBounds(lon: number, lat: number): boolean {
  return (
    lon >= USA.lonMin - 0.2 &&
    lon <= USA.lonMax + 0.2 &&
    lat >= USA.latMin - 0.3 &&
    lat <= USA.latMax + 0.2
  );
}

export function ringToPath(
  ring: [number, number][],
  project: (lon: number, lat: number) => MapPoint
): string {
  if (ring.length < 2) return "";
  const p0 = project(ring[0]![0], ring[0]![1]);
  let d = `M ${p0.x} ${p0.y}`;
  for (let i = 1; i < ring.length; i++) {
    const p = project(ring[i]![0], ring[i]![1]);
    d += ` L ${p.x} ${p.y}`;
  }
  d += " Z";
  return d;
}

/**
 * Quadratic bezier for a bulge between two map points (great-circle-ish look on a flat map).
 */
export function curvedLinePath(
  a: MapPoint,
  b: MapPoint,
  bend: number
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;
  const k = dist * bend;
  return `M ${a.x} ${a.y} Q ${mx + nx * k} ${my + ny * k} ${b.x} ${b.y}`;
}
