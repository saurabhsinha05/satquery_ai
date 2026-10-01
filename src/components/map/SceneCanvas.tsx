import { useCallback, useEffect, useMemo, useRef } from 'react';
import { WORLD, generateScene, type Scene } from '@/lib/mapScene';
import { renderWorld, strokeBoundary, type LayerVisibility } from '@/lib/mapRenderer';
import type { AnalysisKind, MapState, ScenePalette } from '@/lib/types';
import { cn, clamp, lerp, prefersReducedMotion } from '@/lib/utils';

export interface DrawnRect {
  /** Normalised 0..1 world-space rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SceneCanvasProps {
  seed: string;
  kind: AnalysisKind;
  palette: ScenePalette;
  visibility: LayerVisibility;
  mapState: MapState;
  interactive?: boolean;
  drawMode?: boolean;
  quality?: number;
  className?: string;
  showBoundary?: boolean;
  onCameraChange?: (patch: Partial<MapState>) => void;
  onDrawComplete?: (rect: DrawnRect) => void;
  ariaLabel?: string;
}

interface Camera {
  zoom: number;
  ox: number;
  oy: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export function SceneCanvas({
  seed,
  kind,
  palette,
  visibility,
  mapState,
  interactive = false,
  drawMode = false,
  quality = 1,
  className,
  showBoundary = true,
  onCameraChange,
  onDrawComplete,
  ariaLabel = 'Simulated Earth observation visualization (demo)',
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const camRef = useRef<Camera>({ zoom: mapState.zoom, ox: mapState.offsetX, oy: mapState.offsetY });
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const rectRef = useRef<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  const scene: Scene = useMemo(() => generateScene(seed, kind), [seed, kind]);

  const visibilityKey = `${visibility.change}|${visibility.target}|${visibility.baseline}|${visibility.basemap}`;

  const world = useMemo(
    () =>
      renderWorld(scene, palette, visibility, {
        highOnly: mapState.highOnly,
        baselineYear: mapState.baselineYear,
        quality,
      }),
    // `visibility` is an object literal from the parent; key on its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, palette, visibilityKey, mapState.highOnly, mapState.baselineYear, quality],
  );

  /** Target camera derived from map state + focus anchor. */
  const target = useMemo<Camera>(() => {
    if (mapState.focus !== 'none') {
      const anchor = scene.anchors[mapState.focus];
      return {
        zoom: mapState.zoom,
        ox: anchor.x - WORLD.w / 2,
        oy: anchor.y - WORLD.h / 2,
      };
    }
    return { zoom: mapState.zoom, ox: mapState.offsetX, oy: mapState.offsetY };
  }, [mapState.focus, mapState.offsetX, mapState.offsetY, mapState.zoom, scene.anchors]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const cam = camRef.current;
    const baseScale = Math.max(w / WORLD.w, h / WORLD.h);
    const scale = baseScale * cam.zoom;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04090D';
    ctx.fillRect(0, 0, w, h);

    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(WORLD.w / 2 + cam.ox), -(WORLD.h / 2 + cam.oy));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(world, 0, 0, WORLD.w, WORLD.h);

    if (showBoundary) strokeBoundary(ctx, scene, palette, scale);

    ctx.restore();

    // Draw-mode rectangle lives in screen space.
    const rect = rectRef.current;
    if (rect) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = Math.min(rect.sx, rect.ex);
      const y = Math.min(rect.sy, rect.ey);
      const rw = Math.abs(rect.ex - rect.sx);
      const rh = Math.abs(rect.ey - rect.sy);
      ctx.fillStyle = 'rgba(42, 203, 147, 0.12)';
      ctx.fillRect(x, y, rw, rh);
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(42, 203, 147, 0.95)';
      ctx.strokeRect(x, y, rw, rh);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(42, 203, 147, 0.95)';
      for (const [cx, cy] of [
        [x, y],
        [x + rw, y],
        [x, y + rh],
        [x + rw, y + rh],
      ]) {
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      }
      ctx.restore();
    }
  }, [palette, scene, showBoundary, world]);

  /** Ease the camera toward its target; stop the loop once settled. */
  const animate = useCallback(() => {
    const cam = camRef.current;
    const instant = prefersReducedMotion();
    const t = instant ? 1 : 0.16;
    cam.zoom = lerp(cam.zoom, target.zoom, t);
    cam.ox = lerp(cam.ox, target.ox, t);
    cam.oy = lerp(cam.oy, target.oy, t);

    const settled =
      Math.abs(cam.zoom - target.zoom) < 0.002 &&
      Math.abs(cam.ox - target.ox) < 0.4 &&
      Math.abs(cam.oy - target.oy) < 0.4;

    if (settled) {
      cam.zoom = target.zoom;
      cam.ox = target.ox;
      cam.oy = target.oy;
      paint();
      rafRef.current = 0;
      return;
    }
    paint();
    rafRef.current = requestAnimationFrame(animate);
  }, [paint, target]);

  const kick = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => {
    kick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [kick, target]);

  useEffect(() => {
    paint();
  }, [paint]);

  /* Size / DPR handling */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      paint();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  /* Wheel zoom — needs a non-passive listener to preventDefault. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive || !onCameraChange) return undefined;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clamp(
        camRef.current.zoom * (e.deltaY < 0 ? 1.16 : 1 / 1.16),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      onCameraChange({
        zoom: next,
        focus: 'none',
        offsetX: camRef.current.ox,
        offsetY: camRef.current.oy,
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [interactive, onCameraChange]);

  /* Pointer interaction: pan, or draw a rectangle in draw mode. */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (drawMode) {
      rectRef.current = { sx: px, sy: py, ex: px, ey: py };
      paint();
      return;
    }
    dragRef.current = { x: e.clientX, y: e.clientY, ox: camRef.current.ox, oy: camRef.current.oy };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drawMode && rectRef.current) {
      const rect = canvas.getBoundingClientRect();
      rectRef.current.ex = e.clientX - rect.left;
      rectRef.current.ey = e.clientY - rect.top;
      paint();
      return;
    }

    const drag = dragRef.current;
    if (!drag || !onCameraChange) return;
    const { w, h } = sizeRef.current;
    const baseScale = Math.max(w / WORLD.w, h / WORLD.h) * camRef.current.zoom;
    const nx = drag.ox - (e.clientX - drag.x) / baseScale;
    const ny = drag.oy - (e.clientY - drag.y) / baseScale;
    const limit = WORLD.w * 0.42;
    camRef.current.ox = clamp(nx, -limit, limit);
    camRef.current.oy = clamp(ny, -limit * 0.7, limit * 0.7);
    paint();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    canvas?.releasePointerCapture?.(e.pointerId);

    if (drawMode && rectRef.current && onDrawComplete) {
      const { w, h } = sizeRef.current;
      const r = rectRef.current;
      const x = Math.min(r.sx, r.ex) / Math.max(w, 1);
      const y = Math.min(r.sy, r.ey) / Math.max(h, 1);
      const rw = Math.abs(r.ex - r.sx) / Math.max(w, 1);
      const rh = Math.abs(r.ey - r.sy) / Math.max(h, 1);
      if (rw > 0.03 && rh > 0.03) onDrawComplete({ x, y, w: rw, h: rh });
      return;
    }

    if (dragRef.current && onCameraChange) {
      onCameraChange({
        offsetX: camRef.current.ox,
        offsetY: camRef.current.oy,
        focus: 'none',
      });
    }
    dragRef.current = null;
  };

  const clearRect = useCallback(() => {
    rectRef.current = null;
    paint();
  }, [paint]);

  useEffect(() => {
    if (!drawMode) clearRect();
  }, [drawMode, clearRect]);

  return (
    <div ref={wrapRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'block h-full w-full touch-none',
          interactive && (drawMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'),
        )}
      />
    </div>
  );
}
