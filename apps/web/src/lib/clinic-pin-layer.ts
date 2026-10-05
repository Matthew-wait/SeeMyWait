import L from "leaflet";

export interface CanvasClinicPin { id: string; latitude: number; longitude: number; color: string; name: string }

/** The existing pin artwork, drawn on one canvas instead of thousands of DOM nodes. */
export class ClinicPinLayer extends L.Layer {
  private mapInstance?: L.Map;
  private canvas?: HTMLCanvasElement;
  private pins: CanvasClinicPin[] = [];
  private images = new Map<string, HTMLImageElement>();
  private drawn: { pin: CanvasClinicPin; x: number; y: number }[] = [];
  private frame = 0;

  onAdd(map: L.Map): this {
    this.mapInstance = map;
    this.canvas = L.DomUtil.create("canvas", "smw-clinic-pins");
    this.canvas.style.position = "absolute";
    this.canvas.style.pointerEvents = "none";
    this.canvas.setAttribute("aria-label", "Nearby doctor office markers");
    map.getPane("markerPane")!.appendChild(this.canvas);
    map.on("move zoom resize", this.schedule, this);
    this.schedule();
    return this;
  }
  onRemove(map: L.Map): this {
    map.off("move zoom resize", this.schedule, this);
    cancelAnimationFrame(this.frame);
    this.canvas?.remove();
    this.mapInstance = undefined;
    this.drawn = [];
    return this;
  }
  setPins(pins: CanvasClinicPin[]): void { this.pins = pins; this.schedule(); }
  pick(point: L.Point): CanvasClinicPin | undefined {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const p = this.drawn[i];
      if (Math.abs(point.x - p.x) <= 18 && point.y >= p.y - 48 && point.y <= p.y) return p.pin;
    }
  }
  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
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
    if (!map || !canvas) return;
    const size = map.getSize(), scale = window.devicePixelRatio || 1;
    canvas.width = size.x * scale; canvas.height = size.y * scale;
    canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0,0]));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale,scale);
    ctx.shadowColor = "rgba(15,23,42,0.28)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    // Exactly overlapping pins already obscure one another. Keep the top pin at
    // each screen pixel without discarding any clinic from the source data/list.
    const visible = new Map<string, { pin: CanvasClinicPin; x: number; y: number }>();
    for (const pin of this.pins) {
      const point = map.latLngToContainerPoint([pin.latitude,pin.longitude]);
      if (point.x < -18 || point.x > size.x + 18 || point.y < 0 || point.y > size.y + 48) continue;
      visible.set(`${Math.round(point.x)}:${Math.round(point.y)}`, {pin,x:point.x,y:point.y});
    }
    this.drawn = [...visible.values()].sort((a,b) => a.y-b.y);
    for (const p of this.drawn) {
      const image = this.image(p.pin.color);
      if (image.complete && image.naturalWidth) ctx.drawImage(image,p.x-18,p.y-48,36,48);
    }
    canvas.dataset.clinicCount = String(this.pins.length);
    canvas.dataset.visibleCount = String(this.drawn.length);
  }
}
