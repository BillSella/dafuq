import { USA_MAP_PATH_D, WORLD_MAP_PATH_D } from "./generated/mapPaths";

export type MapRegion = "world" | "usa";

/**
 * Pre-projected SVG paths (viewBox 0 0 1000 500) from simplified country GeoJSON.
 * Regenerate: `npx mapshaper tmp-world.geojson -simplify 2% -o format=geojson world-simp.geojson` then
 * `node scripts/build-map-paths.mjs world-simp.geojson`
 */
export function basemapPath(region: MapRegion): string {
  return region === "world" ? WORLD_MAP_PATH_D : USA_MAP_PATH_D;
}
