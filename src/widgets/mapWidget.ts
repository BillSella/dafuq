import { clamp, type WidgetState } from "./baseWidget";
import { basemapPath, type MapRegion } from "./mapLandRings";
import { curvedLinePath, inUsaBounds, projectUsa, projectWorld, type MapPoint } from "./mapProjections";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";

const NODE_PALETTE = [
  "#d1ff52",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#22d3ee"
] as const;

const LINK_PALETTE = [
  "rgb(209 255 82 / 45%)",
  "rgb(96 165 250 / 55%)",
  "rgb(245 158 11 / 50%)",
  "rgb(244 114 182 / 50%)",
  "rgb(52 211 153 / 50%)"
] as const;

export type MapNode = {
  id: string;
  lat: number;
  lon: number;
  value: number;
  color?: string;
};

export type MapLink = {
  from: string;
  to: string;
  color?: string;
  width?: number;
  style?: "solid" | "dashed";
};

export type MapDataPayload = {
  nodes: MapNode[];
  links: MapLink[];
};

export type MapVizNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  value: number;
};

export type MapVizLink = {
  d: string;
  color: string;
  width: number;
  dash: string;
};

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded network: ~20 global nodes, connected spanning tree + extra edges. */
export function buildDefaultWorldMapSampleJson(): string {
  const rand = mulberry32(0x3d1f1e99);
  const n = 20;
  const nodes: MapNode[] = [];
  for (let i = 0; i < n; i++) {
    const lat = rand() * 150 - 75;
    const lon = rand() * 340 - 170;
    const value = 15 + Math.round(rand() * 9850) / 10;
    const color = NODE_PALETTE[Math.floor(rand() * NODE_PALETTE.length)] ?? NODE_PALETTE[0];
    nodes.push({ id: `n${i}`, lat, lon, value, color });
  }

  const ids = nodes.map((o) => o.id);
  const inTree = new Set([ids[0]!]);
  const rest = new Set(ids.slice(1));
  const links: MapLink[] = [];
  const edgeKey = (a: string, b: string) => {
    return a < b ? `${a}\0${b}` : `${b}\0${a}`;
  };
  const seen = new Set<string>();

  const pushLink = (a: string, b: string) => {
    const k = edgeKey(a, b);
    if (a === b || seen.has(k)) return;
    seen.add(k);
    const color = LINK_PALETTE[Math.floor(rand() * LINK_PALETTE.length)] ?? LINK_PALETTE[0]!;
    const width = 1.2 + rand() * 2.2;
    const style: "solid" | "dashed" = rand() > 0.45 ? "solid" : "dashed";
    links.push({ from: a, to: b, color, width, style });
  };

  while (rest.size) {
    let pickA = "";
    let pickB = "";
    let guard = 0;
    do {
      pickA = [...inTree][Math.floor(rand() * inTree.size)]!;
      pickB = [...rest][Math.floor(rand() * rest.size)]!;
      guard++;
    } while ((pickA === pickB || seen.has(edgeKey(pickA, pickB))) && guard < 500);
    if (pickA && pickB) {
      pushLink(pickA, pickB);
      inTree.add(pickB);
      rest.delete(pickB);
    } else {
      const [b] = rest;
      if (b) {
        inTree.add(b);
        rest.delete(b);
      }
    }
  }

  for (let e = 0; e < 16; e++) {
    const i = Math.floor(rand() * n);
    const j = Math.floor(rand() * n);
    if (i !== j) pushLink(nodes[i]!.id, nodes[j]!.id);
  }

  return JSON.stringify({ nodes, links } satisfies MapDataPayload);
}

export type MapConfig = {
  label: string;
  align: "left" | "center" | "right";
  mapRegion: MapRegion;
  min: number;
  max: number;
  dotRadiusMin: number;
  dotRadiusMax: number;
  format: NumberFormat;
  decimals: 0 | 1 | 2 | 3;
  lineBend: number;
  defaultValue: string;
  updateGroup: string;
  apiEndpoint: string;
  field: string;
};

const DEFAULT_MAP_JSON = buildDefaultWorldMapSampleJson();

export class MapWidget extends BaseChartWidget<"mapNetwork", MapConfig> {
  static create(id: string, colStart: number, rowStart: number): MapWidget {
    return new MapWidget({
      id,
      type: "mapNetwork",
      colStart,
      rowStart,
      colSpan: 22,
      rowSpan: 20,
      config: {
        label: "Map",
        align: "left",
        mapRegion: "world",
        min: 0,
        max: 1000,
        dotRadiusMin: 2.2,
        dotRadiusMax: 9.5,
        format: "compact",
        decimals: 0,
        lineBend: 0.14,
        defaultValue: DEFAULT_MAP_JSON,
        updateGroup: "",
        apiEndpoint: "https://api.example.com/v1/network-map",
        field: ""
      }
    });
  }

  constructor(state: WidgetState<"mapNetwork", MapConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"mapNetwork", MapConfig>): this {
    return new MapWidget(state) as this;
  }

  getPayload(): MapDataPayload {
    const raw = (this.config.defaultValue ?? "").trim();
    if (!raw) return { nodes: [], links: [] };
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && "nodes" in (parsed as object)) {
          const o = parsed as { nodes?: unknown; links?: unknown };
          return {
            nodes: Array.isArray(o.nodes) ? (o.nodes as MapNode[]) : [],
            links: Array.isArray(o.links) ? (o.links as MapLink[]) : []
          };
        }
      } catch {
        return { nodes: [], links: [] };
      }
    }
    return { nodes: [], links: [] };
  }

  getDisplayValue(): string {
    const { nodes, links } = this.getPayload();
    if (nodes.length === 0) return "—";
    return `${nodes.length} loc · ${links.length} links`;
  }

  getBasemapD(): string {
    return basemapPath(this.config.mapRegion);
  }

  private valueToRadius(v: number): number {
    const { min, max, dotRadiusMin, dotRadiusMax } = this.config;
    const lo = min;
    const hi = Math.max(lo + 1e-6, max);
    const t = clamp((v - lo) / (hi - lo), 0, 1);
    return dotRadiusMin + t * (dotRadiusMax - dotRadiusMin);
  }

  getViz(): { nodes: MapVizNode[]; links: MapVizLink[]; project: (lon: number, lat: number) => MapPoint } {
    const { nodes, links } = this.getPayload();
    const isUsa = this.config.mapRegion === "usa";
    const project = isUsa ? projectUsa : projectWorld;

    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const outNodes: MapVizNode[] = [];
    for (const n of nodes) {
      if (isUsa && !inUsaBounds(n.lon, n.lat)) continue;
      const p = project(n.lon, n.lat);
      const val = Number.isFinite(n.value) ? n.value : 0;
      const color = (n.color?.trim() || NODE_PALETTE[0])!;
      outNodes.push({
        id: n.id,
        x: p.x,
        y: p.y,
        r: this.valueToRadius(val),
        color,
        value: val
      });
    }
    const pos = new Map(outNodes.map((o) => [o.id, o] as const));
    const bend = clamp(this.config.lineBend, 0.02, 0.4);
    const outLinks: MapVizLink[] = [];
    for (const L of links) {
      const a = pos.get(L.from);
      const b = pos.get(L.to);
      if (!a || !b) continue;
      const d = curvedLinePath(
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
        bend
      );
      const color = (L.color?.trim() || "rgb(148 163 184 / 55%)") as string;
      const width = Math.max(0.4, L.width ?? 1.4);
      const dash = L.style === "dashed" ? "4 5" : "";
      outLinks.push({ d, color, width, dash });
    }
    return { nodes: outNodes, links: outLinks, project };
  }
}

