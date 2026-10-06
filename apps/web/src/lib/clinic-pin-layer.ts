import L from "leaflet";
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster";

export interface CanvasClinicPin { id: string; latitude: number; longitude: number; color: string; name: string }

interface ClinicPointProps { pin: CanvasClinicPin }

/** A cluster bubble, or a pin spot, placed on screen for this frame. A pin
 *  spot's `stack` normally holds one clinic — when two+ offices share (near)
 *  identical coordinates even at max zoom (e.g. the same building), supercluster
 *  can never separate them into their own pins, so they're merged into one
 *  clickable spot here instead of silently hiding all but the topmost. */
type DrawnItem =
  | { kind: "pin"; stack: CanvasClinicPin[]; x: number; y: number }
  | { kind: "cluster"; clusterId: number; count: number; lat: number; lng: number; x: number; y: number };

/** Screen-pixel bucket size for merging pins that land on (almost) the same
 *  spot into one stack — generous enough to catch "same building, a few
 *  meters apart" without merging genuinely distinct nearby offices. */
const STACK_PIXEL_BUCKET = 10;

// Narrower than supercluster's full 0-21 default — rebuilding the index walks
// every level in this range, and this app is never browsed below "whole metro
// area" or past "single building", so the extra levels were pure rebuild cost.
//
// MAX_CLUSTER_ZOOM must stay BELOW the map's real max zoom (TILE_MAX_ZOOM =
// 19, see map-tiles.ts). Supercluster only ever fully declusters points at
// `maxZoom + 1` (its internal "every point separate" tier) — if this equals
// the map's actual ceiling, a user who zooms all the way in can never reach
// that tier, so two distinct-but-nearby offices stay stuck in a cluster with
// no further zoom action available to split them. Keeping this one level
// below the map's ceiling guarantees "fully zoomed in" always reaches it.
const MIN_CLUSTER_ZOOM = 8;
const MAX_CLUSTER_ZOOM = 18;
/** Debounce window for index rebuilds — background batch loading can hand us
 *  a new `pins` array many times in quick succession; without this, each one
 *  triggered a full supercluster rebuild (clustering at every zoom level),
 *  which is what caused the reported stutter during the initial load. */
const REBUILD_DEBOUNCE_MS = 150;

/** The existing pin artwork, drawn on one canvas instead of thousands of DOM nodes.
 *  Dense groups of pins collapse into small numbered cluster bubbles (via
 *  supercluster) that split apart as the user zooms in — only the leaf-level
 *  points still use the original pin artwork. */
export class ClinicPinLayer extends L.Layer {
  private mapInstance?: L.Map;
  private canvas?: HTMLCanvasElement;
  private pins: CanvasClinicPin[] = [];
  private index: Supercluster<ClinicPointProps> | null = null;
  private images = new Map<string, HTMLImageElement>();
  private drawn: DrawnItem[] = [];
  private frame = 0;
  private rebuildTimer = 0;

  onAdd(map: L.Map): this {
    this.mapInstance = map;
    this.canvas = L.DomUtil.create("canvas", "smw-clinic-pins");
    this.canvas.style.position = "absolute";
    this.canvas.style.pointerEvents = "none";
    this.canvas.setAttribute("aria-label", "Nearby doctor office markers");
    map.getPane("markerPane")!.appendChild(this.canvas);
    // Redraw after pans/resizes settle, and once a zoom animation finishes —
    // NOT on every intermediate "zoom" tick, which was forcing a full
    // getClusters() recompute ~60x/sec during a zoom gesture (the other half
    // of the reported stutter). `zoomanim` below keeps the canvas visually in
    // sync with the map during the animation itself, so nothing "lags".
    map.on("move zoomend resize", this.schedule, this);
    map.on("zoomanim", this.onZoomAnim, this);
    this.schedule();
    return this;
  }
  onRemove(map: L.Map): this {
    map.off("move zoomend resize", this.schedule, this);
    map.off("zoomanim", this.onZoomAnim, this);
    window.clearTimeout(this.rebuildTimer);
    cancelAnimationFrame(this.frame);
    this.canvas?.remove();
    this.mapInstance = undefined;
    this.drawn = [];
    return this;
  }
  setPins(pins: CanvasClinicPin[]): void {
    this.pins = pins;
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuildIndex(), REBUILD_DEBOUNCE_MS);
  }
  /** Zoom level at which a cluster first splits apart — used to zoom-to-expand
   *  on click. Capped at MAX_CLUSTER_ZOOM + 1 (the map's real max zoom, not
   *  supercluster's maxZoom option) so a cluster of very-close-but-distinct
   *  offices can still zoom in far enough to fully resolve on click. */
  expansionZoom(clusterId: number): number {
    if (!this.index) return MAX_CLUSTER_ZOOM + 1;
    try {
      return Math.min(this.index.getClusterExpansionZoom(clusterId), MAX_CLUSTER_ZOOM + 1);
    } catch {
      return MAX_CLUSTER_ZOOM + 1;
    }
  }
  locate(point: L.Point): DrawnItem | undefined {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i];
      if (d.kind === "cluster") {
        const dx = point.x - d.x, dy = point.y - d.y;
        if (dx * dx + dy * dy <= clusterRadius(d.count) ** 2) return d;
      } else if (Math.abs(point.x - d.x) <= 18 && point.y >= d.y - 48 && point.y <= d.y) {
        return d;
      }
    }
  }

  pick(point: L.Point): DrawnItem | undefined {
    return this.locate(point);
  }
  private rebuildIndex(): void {
    const index = new Supercluster<ClinicPointProps>({
      radius: 50,
      minZoom: MIN_CLUSTER_ZOOM,
      maxZoom: MAX_CLUSTER_ZOOM,
    });
    index.load(
      this.pins.map((pin): PointFeature<ClinicPointProps> => ({
        type: "Feature",
        properties: { pin },
        geometry: { type: "Point", coordinates: [pin.longitude, pin.latitude] },
      }))
    );
    this.index = index;
    this.schedule();
  }
  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }
  /** Keep the canvas visually glued to the map during Leaflet's animated zoom
   *  transition — without this, our canvas (repositioned only on settle)
   *  renders at the final position/scale instantly while the tile layer is
   *  still easing in, so large cluster bubbles visibly "swim" away from the
   *  pins underneath until the animation catches up. This mirrors exactly
   *  what Leaflet's own built-in Canvas renderer does internally. */
  private onZoomAnim(e: L.ZoomAnimEvent): void {
    const map = this.mapInstance, canvas = this.canvas;
    if (!map || !canvas) return;
    const scale = map.getZoomScale(e.zoom, map.getZoom());
    const offset = (map as unknown as { _latLngToNewLayerPoint: (latlng: L.LatLng, zoom: number, center: L.LatLng) => L.Point })
      ._latLngToNewLayerPoint(map.getBounds().getNorthWest(), e.zoom, e.center);
    L.DomUtil.setTransform(canvas, offset, scale);
  }
  private image(color: string): HTMLImageElement {
    let image = this.images.get(color);
    if (!image) {
      image = new Image();
      image.onload = () => this.schedule();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 24 32"><path fill="${color}" stroke="white" stroke-width="1.5" d="M12 .5C5.9.5 1 5.4 1 11.5c0 8 11 19.5 11 19.5s11-11.5 11-19.5C23 5.4 18.1.5 12 .5z"/><circle cx="12" cy="11.5" r="4.3" fill="white"/></svg>`);
      this.images.set(color, image);
    }
    return image;
  }
  private draw(): void {
    const map = this.mapInstance, canvas = this.canvas;
    if (!map || !canvas || !this.index) return;
    const size = map.getSize(), scale = window.devicePixelRatio || 1;
    canvas.width = size.x * scale; canvas.height = size.y * scale;
    canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
    // setTransform (not setPosition) so a leftover scale from onZoomAnim is
    // always reset to 1 once we redraw at the map's final settled state.
    L.DomUtil.setTransform(canvas, map.containerPointToLayerPoint([0, 0]), 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale,scale);

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ];
    // Clamp into the index's built range — querying outside it throws. The
    // upper bound is MAX_CLUSTER_ZOOM + 1 (not MAX_CLUSTER_ZOOM): supercluster
    // builds its fully-unclustered "every point separate" tier one level past
    // its own configured maxZoom, and only returns it once queried at exactly
    // that level — capping here at MAX_CLUSTER_ZOOM would always stay one
    // level short of it, the bug this comment used to describe.
    const zoom = Math.min(MAX_CLUSTER_ZOOM + 1, Math.max(MIN_CLUSTER_ZOOM, Math.round(map.getZoom())));
    const clusters = this.index.getClusters(bbox, zoom);

    const items: DrawnItem[] = [];
    // Merge pin-level leaves that land on (almost) the same screen spot — two
    // offices at the same building never separate no matter how far you zoom,
    // so without this only whichever one is drawn last would ever be clickable.
    const pinStacks = new Map<string, { pins: CanvasClinicPin[]; x: number; y: number }>();
    for (const feature of clusters) {
      const [lng, lat] = feature.geometry.coordinates;
      const point = map.latLngToContainerPoint([lat, lng]);
      if (point.x < -40 || point.x > size.x + 40 || point.y < -40 || point.y > size.y + 48) continue;

      if (feature.properties.cluster) {
        const c = feature as ClusterFeature<ClinicPointProps>;
        items.push({ kind: "cluster", clusterId: c.id as number, count: c.properties.point_count, lat, lng, x: point.x, y: point.y });
      } else {
        const key = `${Math.round(point.x / STACK_PIXEL_BUCKET)}:${Math.round(point.y / STACK_PIXEL_BUCKET)}`;
        const existing = pinStacks.get(key);
        if (existing) existing.pins.push(feature.properties.pin);
        else pinStacks.set(key, { pins: [feature.properties.pin], x: point.x, y: point.y });
      }
    }
    for (const { pins, x, y } of pinStacks.values()) {
      items.push({ kind: "pin", stack: pins, x, y });
    }
    // Draw clusters first (so pins layer on top where they overlap at the boundary).
    items.sort((a, b) => (a.kind === "cluster" ? 0 : 1) - (b.kind === "cluster" ? 0 : 1));
    this.drawn = items;

    for (const item of items) {
      if (item.kind === "cluster") {
        drawCluster(ctx, item.x, item.y, item.count);
      } else {
        ctx.save();
        ctx.shadowColor = "rgba(15,23,42,0.28)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
        const image = this.image(item.stack[0].color);
        if (image.complete && image.naturalWidth) ctx.drawImage(image, item.x - 18, item.y - 48, 36, 48);
        ctx.restore();
        if (item.stack.length > 1) drawStackBadge(ctx, item.x, item.y, item.stack.length);
      }
    }
    canvas.dataset.clinicCount = String(this.pins.length);
    canvas.dataset.visibleCount = String(this.drawn.length);
  }
}

/** Small corner badge on a pin that's actually standing in for 2+ offices at
 *  the same spot — distinct from a cluster bubble (which replaces the pin
 *  entirely); this sits on top of the normal pin artwork as a hint that
 *  clicking it opens a picker instead of going straight to one office.
 *  Shows the real count (a single building can genuinely hold 80+ listed
 *  providers) rather than capping low and silently understating it — only
 *  caps at "99+" so three-digit counts don't overflow the badge. */
function drawStackBadge(ctx: CanvasRenderingContext2D, pinX: number, pinY: number, count: number): void {
  const label = count > 99 ? "99+" : String(count);
  const r = label.length >= 3 ? 10 : label.length === 2 ? 9 : 8;
  const bx = pinX + 11, by = pinY - 44;
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.35)"; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${label.length >= 3 ? 7.5 : 9}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx, by + 0.5);
  ctx.restore();
}

function clusterRadius(count: number): number {
  // 9px for small clusters, growing slowly (capped) for very large ones —
  // a small numbered dot like a map-pin badge, not a big blob.
  return Math.min(9 + Math.log(count) * 2.6, 16);
}

function drawCluster(ctx: CanvasRenderingContext2D, x: number, y: number, count: number): void {
  const r = clusterRadius(count);
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.3)"; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${r >= 13 ? 10.5 : 9.5}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 999 ? "999+" : String(count), x, y + 0.5);
  ctx.restore();
}
