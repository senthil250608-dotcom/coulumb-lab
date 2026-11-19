import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Minus, PinOff, Plus, RotateCcw } from 'lucide-react';
import {
  InteractionTool,
  PointCharge,
  ProbeState,
  SimulationSettings,
  TestParticle,
} from '../types/physics';
import {
  CHARGE_HIT_RADIUS_M,
  WorldBounds,
  computeFieldAndPotential,
  computeForceOnCharge,
  formatFieldMag,
  formatPotential,
  generateEquipotentials,
  generateFieldLines,
  getColormapCssGradient,
  renderHeatmapImageData,
} from '../physics/electrostatics';

export interface FieldCanvasHandle {
  exportPng: () => void;
}

interface FieldCanvasProps {
  charges: PointCharge[];
  selectedChargeId: string | null;
  activeTool: InteractionTool;
  settings: SimulationSettings;
  testParticles: TestParticle[];
  onSelectCharge: (id: string | null) => void;
  onMoveCharge: (id: string, x: number, y: number) => void;
  onAddChargeAt: (x: number, y: number, q: number) => void;
  onSpawnTestParticle: (x: number, y: number) => void;
  onUpdateTestParticles: React.Dispatch<React.SetStateAction<TestParticle[]>>;
}

const BASE_PX_PER_METER = 100;

export const FieldCanvas = React.forwardRef<FieldCanvasHandle, FieldCanvasProps>(
  (
    {
      charges,
      selectedChargeId,
      activeTool,
      settings,
      testParticles,
      onSelectCharge,
      onMoveCharge,
      onAddChargeAt,
      onSpawnTestParticle,
      onUpdateTestParticles,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [viewport, setViewport] = useState<{ width: number; height: number }>({
      width: 900,
      height: 640,
    });
    const [zoom, setZoom] = useState<number>(1);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hoveredChargeId, setHoveredChargeId] = useState<string | null>(null);
    const [hoverWorld, setHoverWorld] = useState<{ x: number; y: number } | null>(null);
    const [pinnedProbe, setPinnedProbe] = useState<{ x: number; y: number } | null>(null);
    const [dragOverPreview, setDragOverPreview] = useState<{
      x: number;
      y: number;
      q: number;
    } | null>(null);

    const pxPerMeter = BASE_PX_PER_METER * zoom;

    const getWorldBounds = useCallback(
      (w: number, h: number, ppm: number): WorldBounds => {
        const halfW = w / (2 * ppm);
        const halfH = h / (2 * ppm);
        return {
          minX: -halfW,
          maxX: halfW,
          minY: -halfH,
          maxY: halfH,
        };
      },
      []
    );

    const screenToWorld = useCallback(
      (sx: number, sy: number) => {
        return {
          x: (sx - viewport.width / 2) / pxPerMeter,
          y: (viewport.height / 2 - sy) / pxPerMeter,
        };
      },
      [viewport.width, viewport.height, pxPerMeter]
    );

    const worldToScreen = useCallback(
      (wx: number, wy: number) => {
        return {
          x: viewport.width / 2 + wx * pxPerMeter,
          y: viewport.height / 2 - wy * pxPerMeter,
        };
      },
      [viewport.width, viewport.height, pxPerMeter]
    );

    // Expose PNG snapshot export
    useImperativeHandle(
      ref,
      () => ({
        exportPng: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const link = document.createElement('a');
          link.download = `coulomblab-field-${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        },
      }),
      []
    );

    // Observe container dimensions
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateSize = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewport({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
        }
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Rebuild static field layer (Heatmap + Grid + Equipotentials + Vector Grid + RK4 Field Lines)
    const rebuildStaticLayer = useCallback(() => {
      const { width, height } = viewport;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!staticCanvasRef.current) {
        staticCanvasRef.current = document.createElement('canvas');
      }
      const staticCanvas = staticCanvasRef.current;
      staticCanvas.width = Math.floor(width * dpr);
      staticCanvas.height = Math.floor(height * dpr);

      const ctx = staticCanvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Base obsidian lab canvas
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);

      const bounds = getWorldBounds(width, height, pxPerMeter);
      const isDragging = draggingId !== null;

      // 2. Logarithmic Field Intensity Heatmap
      if (settings.showHeatmap && charges.length > 0) {
        const hmStep = isDragging ? 4 : 2;
        const hmW = Math.max(16, Math.ceil(width / hmStep));
        const hmH = Math.max(16, Math.ceil(height / hmStep));

        if (!heatmapCanvasRef.current) {
          heatmapCanvasRef.current = document.createElement('canvas');
        }
        const hmCanvas = heatmapCanvasRef.current;
        if (hmCanvas.width !== hmW || hmCanvas.height !== hmH) {
          hmCanvas.width = hmW;
          hmCanvas.height = hmH;
        }
        const hmCtx = hmCanvas.getContext('2d');
        if (hmCtx) {
          const imgData = hmCtx.createImageData(hmW, hmH);
          renderHeatmapImageData(
            imgData,
            hmW,
            hmH,
            charges,
            bounds,
            settings.colormap,
            settings.heatmapOpacity
          );
          hmCtx.putImageData(imgData, 0, 0);

          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(hmCanvas, 0, 0, width, height);
          ctx.restore();
        }
      }

      // 3. Coordinate Grid & Axes
      if (settings.showGridAxes) {
        const minorStep = 0.5;
        const startX = Math.floor(bounds.minX / minorStep) * minorStep;
        const startY = Math.floor(bounds.minY / minorStep) * minorStep;

        ctx.lineWidth = 1;

        for (let wx = startX; wx <= bounds.maxX; wx += minorStep) {
          const sx = width / 2 + wx * pxPerMeter;
          const isMajor = Math.abs(wx - Math.round(wx)) < 1e-4;
          const isAxis = Math.abs(wx) < 1e-4;
          ctx.strokeStyle = isAxis
            ? 'rgba(148, 163, 184, 0.28)'
            : isMajor
              ? 'rgba(148, 163, 184, 0.11)'
              : 'rgba(148, 163, 184, 0.045)';
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, height);
          ctx.stroke();

          if (isMajor && Math.abs(wx) >= 0.9) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
            ctx.font = '10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(wx)}m`, sx, height / 2 + 13);
          }
        }

        for (let wy = startY; wy <= bounds.maxY; wy += minorStep) {
          const sy = height / 2 - wy * pxPerMeter;
          const isMajor = Math.abs(wy - Math.round(wy)) < 1e-4;
          const isAxis = Math.abs(wy) < 1e-4;
          ctx.strokeStyle = isAxis
            ? 'rgba(148, 163, 184, 0.28)'
            : isMajor
              ? 'rgba(148, 163, 184, 0.11)'
              : 'rgba(148, 163, 184, 0.045)';
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(width, sy);
          ctx.stroke();

          if (isMajor && Math.abs(wy) >= 0.9) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
            ctx.font = '10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${Math.round(wy)}m`, width / 2 + 6, sy + 3);
          }
        }
      }

      // 4. Equipotential Contours (Marching Squares)
      if (settings.showEquipotentials && charges.length > 0) {
        const cellMeters = isDragging ? 0.11 : 0.065;
        const eqLevels = generateEquipotentials(
          charges,
          bounds,
          settings.contourDensity,
          cellMeters
        );

        for (const eq of eqLevels) {
          const isZero = Math.abs(eq.levelKv) < 1e-4;
          ctx.save();
          if (isZero) {
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([5, 5]);
          } else if (eq.levelKv > 0) {
            ctx.strokeStyle = 'rgba(251, 146, 60, 0.58)';
            ctx.lineWidth = 1.25;
          } else {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.58)';
            ctx.lineWidth = 1.25;
          }

          ctx.beginPath();
          for (let i = 0; i < eq.segments.length; i++) {
            const s = eq.segments[i];
            const sx1 = width / 2 + s.x1 * pxPerMeter;
            const sy1 = height / 2 - s.y1 * pxPerMeter;
            const sx2 = width / 2 + s.x2 * pxPerMeter;
            const sy2 = height / 2 - s.y2 * pxPerMeter;
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
          }
          ctx.stroke();
          ctx.restore();

          // Draw clean contour potential value badge if not dragging
          if (!isDragging && eq.labelPos && eq.segments.length > 14) {
            const lx = width / 2 + eq.labelPos.x * pxPerMeter;
            const ly = height / 2 - eq.labelPos.y * pxPerMeter;
            // Avoid drawing label right on top of a charge
            const tooClose = charges.some(
              (c) => Math.hypot(c.x - eq.labelPos!.x, c.y - eq.labelPos!.y) < 0.45
            );
            if (!tooClose) {
              const text =
                eq.levelKv === 0
                  ? '0 V'
                  : `${eq.levelKv > 0 ? '+' : ''}${eq.levelKv} kV`;
              ctx.font = '500 10px "IBM Plex Mono", monospace';
              const tw = ctx.measureText(text).width;
              ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
              ctx.fillRect(lx - tw / 2 - 4, ly - 7, tw + 8, 14);
              ctx.fillStyle = isZero
                ? '#E2E8F0'
                : eq.levelKv > 0
                  ? '#FDBA74'
                  : '#7DD3FC';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, lx, ly);
            }
          }
        }
      }

      // 5. Vector Field Arrow Grid
      if (settings.showVectorGrid && charges.length > 0) {
        const spacing = 0.75;
        const startX = Math.ceil(bounds.minX / spacing) * spacing;
        const startY = Math.ceil(bounds.minY / spacing) * spacing;

        for (let wy = startY; wy <= bounds.maxY; wy += spacing) {
          for (let wx = startX; wx <= bounds.maxX; wx += spacing) {
            const nearCharge = charges.some(
              (c) => Math.hypot(c.x - wx, c.y - wy) < 0.34
            );
            if (nearCharge) continue;

            const sample = computeFieldAndPotential(wx, wy, charges);
            if (sample.eMag < 0.05) continue;

            const ux = sample.ex / sample.eMag;
            const uy = sample.ey / sample.eMag;
            // Log-compressed opacity for magnitude readability
            const intensity = Math.max(
              0.25,
              Math.min(0.92, (Math.log10(sample.eMag + 1) / 2.2))
            );
            const len = 18;
            const sx = width / 2 + wx * pxPerMeter;
            const sy = height / 2 - wy * pxPerMeter;
            // Canvas Y is inverted relative to world Y
            const dx = ux * len;
            const dy = -uy * len;

            const x1 = sx - dx * 0.45;
            const y1 = sy - dy * 0.45;
            const x2 = sx + dx * 0.55;
            const y2 = sy + dy * 0.55;

            ctx.strokeStyle = `rgba(186, 230, 253, ${intensity.toFixed(2)})`;
            ctx.fillStyle = `rgba(186, 230, 253, ${intensity.toFixed(2)})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - 5 * Math.cos(angle - 0.5), y2 - 5 * Math.sin(angle - 0.5));
            ctx.lineTo(x2 - 5 * Math.cos(angle + 0.5), y2 - 5 * Math.sin(angle + 0.5));
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 6. RK4 Electrostatic Field Lines
      if (settings.showFieldLines && charges.length > 0) {
        const lines = generateFieldLines(charges, settings.fieldLineDensity, bounds);

        ctx.strokeStyle = settings.showHeatmap
          ? 'rgba(248, 250, 252, 0.78)'
          : 'rgba(226, 232, 240, 0.72)';
        ctx.fillStyle = settings.showHeatmap
          ? 'rgba(248, 250, 252, 0.92)'
          : 'rgba(226, 232, 240, 0.9)';
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const line of lines) {
          const pts = line.points;
          if (pts.length < 2) continue;

          ctx.beginPath();
          const p0x = width / 2 + pts[0].x * pxPerMeter;
          const p0y = height / 2 - pts[0].y * pxPerMeter;
          ctx.moveTo(p0x, p0y);

          for (let i = 1; i < pts.length; i++) {
            const px = width / 2 + pts[i].x * pxPerMeter;
            const py = height / 2 - pts[i].y * pxPerMeter;
            ctx.lineTo(px, py);
          }
          ctx.stroke();

          // Draw directional arrowheads along the curve
          const arrowIndices =
            pts.length > 36
              ? [Math.floor(pts.length * 0.35), Math.floor(pts.length * 0.72)]
              : pts.length > 10
                ? [Math.floor(pts.length * 0.5)]
                : [];

          for (const idx of arrowIndices) {
            const a = pts[Math.max(0, idx - 1)];
            const b = pts[Math.min(pts.length - 1, idx + 1)];
            const ax = width / 2 + a.x * pxPerMeter;
            const ay = height / 2 - a.y * pxPerMeter;
            const bx = width / 2 + b.x * pxPerMeter;
            const by = height / 2 - b.y * pxPerMeter;

            // Keep arrows inside visible canvas
            if (bx < 12 || bx > width - 12 || by < 12 || by > height - 12) continue;

            const angle = Math.atan2(by - ay, bx - ax);
            const mx = 0.5 * (ax + bx);
            const my = 0.5 * (ay + by);

            ctx.beginPath();
            ctx.moveTo(mx + 4.5 * Math.cos(angle), my + 4.5 * Math.sin(angle));
            ctx.lineTo(mx - 4 * Math.cos(angle - 0.55), my - 4 * Math.sin(angle - 0.55));
            ctx.lineTo(mx - 4 * Math.cos(angle + 0.55), my - 4 * Math.sin(angle + 0.55));
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }, [viewport, pxPerMeter, charges, settings, draggingId, getWorldBounds]);

    useEffect(() => {
      rebuildStaticLayer();
    }, [rebuildStaticLayer]);

    // Interactive foreground render (Static buffer + Force vectors + Charges + Test Particles + Probe)
    const renderForeground = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = viewport;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Copy pre-rendered static field layer
      if (staticCanvasRef.current) {
        ctx.drawImage(staticCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#090D16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.scale(dpr, dpr);

      // Draw test particle trajectories & bodies
      for (const p of testParticles) {
        if (p.trail.length > 1) {
          ctx.beginPath();
          const t0 = worldToScreen(p.trail[0].x, p.trail[0].y);
          ctx.moveTo(t0.x, t0.y);
          for (let i = 1; i < p.trail.length; i++) {
            const pt = worldToScreen(p.trail[i].x, p.trail[i].y);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        const pos = worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#34D399';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#090D16';
        ctx.stroke();
      }

      // Draw net electrostatic force arrow on selected charge
      const selectedCharge = charges.find((c) => c.id === selectedChargeId);
      if (selectedCharge && charges.length > 1) {
        const force = computeForceOnCharge(selectedCharge, charges);
        if (force.fMag > 0.01) {
          const origin = worldToScreen(selectedCharge.x, selectedCharge.y);
          const dirX = force.fx / force.fMag;
          const dirY = -force.fy / force.fMag; // screen Y inverted
          const arrowLen = Math.min(96, Math.max(36, 26 + Math.log10(force.fMag + 1) * 32));
          const tipX = origin.x + dirX * arrowLen;
          const tipY = origin.y + dirY * arrowLen;

          ctx.save();
          ctx.strokeStyle = '#FBBF24';
          ctx.fillStyle = '#FBBF24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();

          const ang = Math.atan2(dirY, dirX);
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - 9 * Math.cos(ang - 0.45), tipY - 9 * Math.sin(ang - 0.45));
          ctx.lineTo(tipX - 9 * Math.cos(ang + 0.45), tipY - 9 * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fill();

          ctx.font = '600 11px "IBM Plex Mono", monospace';
          ctx.textAlign = dirX >= 0 ? 'left' : 'right';
          ctx.fillText(
            `F = ${force.fMag.toFixed(1)} mN`,
            tipX + (dirX >= 0 ? 8 : -8),
            tipY - 6
          );
          ctx.restore();
        }
      }

      // Draw point charges
      for (const c of charges) {
        const pos = worldToScreen(c.x, c.y);
        const isPos = c.q >= 0;
        const isSelected = c.id === selectedChargeId;
        const isHovered = c.id === hoveredChargeId || c.id === draggingId;
        const radius = Math.max(15, Math.min(24, (14 + Math.abs(c.q) * 0.9) * Math.sqrt(zoom)));

        // Outer selection / hover halo
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#F8FAFC' : 'rgba(248, 250, 252, 0.45)';
          ctx.lineWidth = isSelected ? 2 : 1.5;
          ctx.setLineDash(isSelected ? [] : [3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Charge core disc
        const grad = ctx.createRadialGradient(
          pos.x - radius * 0.28,
          pos.y - radius * 0.28,
          radius * 0.15,
          pos.x,
          pos.y,
          radius
        );
        if (isPos) {
          grad.addColorStop(0, '#FB7185');
          grad.addColorStop(1, '#BE123C');
        } else {
          grad.addColorStop(0, '#38BDF8');
          grad.addColorStop(1, '#0369A1');
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isPos ? '#FDA4AF' : '#7DD3FC';
        ctx.stroke();

        // Sign glyph inside disc
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 15px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isPos ? '+' : '−', pos.x, pos.y + 0.5);

        // Magnitude label below disc
        const magText = `${c.q >= 0 ? '+' : ''}${c.q.toFixed(1)} µC`;
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        const tw = ctx.measureText(magText).width;
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(pos.x - tw / 2 - 5, pos.y + radius + 5, tw + 10, 16);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(magText, pos.x, pos.y + radius + 13);
      }

      // Draw drag-from-palette drop target preview
      if (dragOverPreview) {
        const dp = worldToScreen(dragOverPreview.x, dragOverPreview.y);
        ctx.save();
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 232, 240, 0.14)';
        ctx.fill();
        ctx.restore();
      }

      // Draw pinned field probe marker
      if (pinnedProbe) {
        const pp = worldToScreen(pinnedProbe.x, pinnedProbe.y);
        ctx.save();
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 8, 0, Math.PI * 2);
        ctx.moveTo(pp.x - 14, pp.y);
        ctx.lineTo(pp.x - 4, pp.y);
        ctx.moveTo(pp.x + 4, pp.y);
        ctx.lineTo(pp.x + 14, pp.y);
        ctx.moveTo(pp.x, pp.y - 14);
        ctx.lineTo(pp.x, pp.y - 4);
        ctx.moveTo(pp.x, pp.y + 4);
        ctx.lineTo(pp.x, pp.y + 14);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }, [
      viewport,
      charges,
      selectedChargeId,
      hoveredChargeId,
      draggingId,
      testParticles,
      dragOverPreview,
      pinnedProbe,
      zoom,
      worldToScreen,
    ]);

    useEffect(() => {
      renderForeground();
    }, [renderForeground]);

    const chargesRef = useRef(charges);
    chargesRef.current = charges;
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const pxPerMeterRef = useRef(pxPerMeter);
    pxPerMeterRef.current = pxPerMeter;
    const hasAliveParticles = testParticles.some((p) => p.alive);

    // Test particle physics animation loop
    useEffect(() => {
      if (!hasAliveParticles) return;

      let animId = 0;
      let lastTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min(0.032, Math.max(0.004, (now - lastTime) / 1000));
        lastTime = now;

        const currentCharges = chargesRef.current;
        const vp = viewportRef.current;
        const ppm = pxPerMeterRef.current;
        const bounds = getWorldBounds(vp.width, vp.height, ppm);

        onUpdateTestParticles((prev) =>
          prev.map((p) => {
            if (!p.alive) return p;

            const sample = computeFieldAndPotential(p.x, p.y, currentCharges);
            const accelScale = 0.085;
            const maxAccel = 18;
            let ax = sample.ex * accelScale;
            let ay = sample.ey * accelScale;
            const aMag = Math.hypot(ax, ay);
            if (aMag > maxAccel) {
              ax = (ax / aMag) * maxAccel;
              ay = (ay / aMag) * maxAccel;
            }

            const nvx = p.vx * 0.992 + ax * dt;
            const nvy = p.vy * 0.992 + ay * dt;
            const nx = p.x + nvx * dt;
            const ny = p.y + nvy * dt;

            const hitSink = currentCharges.some(
              (c) => Math.hypot(nx - c.x, ny - c.y) < 0.2
            );
            const outOfBounds =
              nx < bounds.minX - 1 ||
              nx > bounds.maxX + 1 ||
              ny < bounds.minY - 1 ||
              ny > bounds.maxY + 1;

            const nextTrail = [...p.trail, { x: nx, y: ny }];
            if (nextTrail.length > 90) nextTrail.shift();

            return {
              ...p,
              x: nx,
              y: ny,
              vx: nvx,
              vy: nvy,
              trail: nextTrail,
              alive: !hitSink && !outOfBounds,
            };
          })
        );

        animId = requestAnimationFrame(step);
      };

      animId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animId);
    }, [hasAliveParticles, getWorldBounds, onUpdateTestParticles]);

    // Hit test helper for charges
    const findChargeAtScreen = (sx: number, sy: number): PointCharge | null => {
      const worldPt = screenToWorld(sx, sy);
      const hitRadiusM = Math.max(CHARGE_HIT_RADIUS_M, 24 / pxPerMeter);
      for (let i = charges.length - 1; i >= 0; i--) {
        const c = charges[i];
        if (Math.hypot(c.x - worldPt.x, c.y - worldPt.y) <= hitRadiusM) {
          return c;
        }
      }
      return null;
    };

    const getCanvasLocalCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { sx: 0, sy: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        sx: clientX - rect.left,
        sy: clientY - rect.top,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { sx, sy } = getCanvasLocalCoords(e.clientX, e.clientY);
      const worldPt = screenToWorld(sx, sy);
      const hit = findChargeAtScreen(sx, sy);

      if (hit) {
        onSelectCharge(hit.id);
        setDraggingId(hit.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      if (activeTool === InteractionTool.PinProbe) {
        setPinnedProbe({ x: worldPt.x, y: worldPt.y });
        return;
      }

      if (activeTool === InteractionTool.LaunchTestCharge) {
        onSpawnTestParticle(worldPt.x, worldPt.y);
        return;
      }

      onSelectCharge(null);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { sx, sy } = getCanvasLocalCoords(e.clientX, e.clientY);
      const worldPt = screenToWorld(sx, sy);
      setHoverWorld(worldPt);

      if (draggingId) {
        let nx = worldPt.x;
        let ny = worldPt.y;
        if (e.shiftKey) {
          nx = Math.round(nx * 4) / 4;
          ny = Math.round(ny * 4) / 4;
        }
        onMoveCharge(draggingId, nx, ny);
        return;
      }

      const hit = findChargeAtScreen(sx, sy);
      setHoveredChargeId(hit ? hit.id : null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (draggingId) {
        setDraggingId(null);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { sx, sy } = getCanvasLocalCoords(e.clientX, e.clientY);
      const hit = findChargeAtScreen(sx, sy);
      if (hit) return;
      const worldPt = screenToWorld(sx, sy);
      const q = e.altKey || e.shiftKey ? -1 : 1;
      onAddChargeAt(worldPt.x, worldPt.y, q);
    };

    // HTML5 Drag & Drop from Sidebar Charge Palette
    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
      if (e.dataTransfer.types.includes('application/x-coulomb-charge')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const { sx, sy } = getCanvasLocalCoords(e.clientX, e.clientY);
        const worldPt = screenToWorld(sx, sy);
        setDragOverPreview({ x: worldPt.x, y: worldPt.y, q: 1 });
      }
    };

    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      const raw = e.dataTransfer.getData('application/x-coulomb-charge');
      setDragOverPreview(null);
      if (!raw) return;
      e.preventDefault();
      const q = parseFloat(raw);
      if (Number.isNaN(q)) return;
      const { sx, sy } = getCanvasLocalCoords(e.clientX, e.clientY);
      const worldPt = screenToWorld(sx, sy);
      onAddChargeAt(worldPt.x, worldPt.y, q);
    };

    // Active probe readout (pinned takes priority over hover)
    const activeProbeCoords = pinnedProbe ?? hoverWorld;
    const activeProbe: ProbeState | null = activeProbeCoords
      ? {
          x: activeProbeCoords.x,
          y: activeProbeCoords.y,
          sample: computeFieldAndPotential(
            activeProbeCoords.x,
            activeProbeCoords.y,
            charges
          ),
          pinned: pinnedProbe !== null,
        }
      : null;

    const cursorClass = draggingId
      ? 'cursor-grabbing'
      : hoveredChargeId
        ? 'cursor-grab'
        : 'cursor-crosshair';

    return (
      <main
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#090D16] select-none min-h-[420px]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setHoverWorld(null);
            setHoveredChargeId(null);
          }}
          onDoubleClick={handleDoubleClick}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOverPreview(null)}
          onDrop={handleDrop}
          className={`block w-full h-full touch-none ${cursorClass}`}
        />

        {charges.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-lg border border-slate-800 bg-[#0B101B]/90 px-5 py-3 text-center text-xs text-slate-300 backdrop-blur-xs">
              Drag a +q or −q token onto the canvas, or double-click anywhere to place a charge.
            </div>
          </div>
        )}

        {/* Top-Left Layer Legend */}
        <div className="pointer-events-none absolute top-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-800 bg-[#0B101B]/90 px-3.5 py-2 text-xs text-slate-300 backdrop-blur-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" aria-hidden="true" />
            <span>+q Source</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" aria-hidden="true" />
            <span>−q Sink</span>
          </span>
          {settings.showFieldLines && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-slate-200" aria-hidden="true" />
              <span>E Field</span>
            </span>
          )}
          {settings.showEquipotentials && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-amber-400" aria-hidden="true" />
              <span>V &gt; 0</span>
              <span className="w-3.5 h-0.5 bg-sky-400 ml-1" aria-hidden="true" />
              <span>V &lt; 0</span>
            </span>
          )}
        </div>

        {/* Top-Right Heatmap Colorbar HUD (visible when heatmap is enabled) */}
        {settings.showHeatmap && (
          <div className="pointer-events-none absolute top-4 right-4 rounded-lg border border-slate-800 bg-[#0B101B]/90 px-3.5 py-2.5 backdrop-blur-xs w-52">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-300 mb-1.5">
              <span>Field Intensity |E|</span>
              <span className="font-mono text-slate-400">log scale</span>
            </div>
            <div
              className="h-2.5 w-full rounded-sm border border-slate-700"
              style={{ background: getColormapCssGradient(settings.colormap) }}
            />
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400 mt-1">
              <span>0.4 kV/m</span>
              <span>12</span>
              <span>400+</span>
            </div>
          </div>
        )}

        {/* Bottom-Left Live Field Probe HUD */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-slate-800 bg-[#0B101B]/92 px-4 py-3 backdrop-blur-xs min-w-[272px] max-w-[340px]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-semibold text-slate-200">
              {activeProbe?.pinned ? 'Pinned Field Probe' : 'Field Probe'}
            </span>
            {activeProbe?.pinned ? (
              <button
                type="button"
                onClick={() => setPinnedProbe(null)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                <PinOff className="w-3 h-3" aria-hidden="true" />
                <span>Unpin</span>
              </button>
            ) : (
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {activeProbe
                  ? `(${activeProbe.x.toFixed(2)}, ${activeProbe.y.toFixed(2)}) m`
                  : 'Move cursor over field'}
              </span>
            )}
          </div>

          {activeProbe ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono tabular-nums">
              <div>
                <div className="text-[10px] font-sans text-slate-400">Potential V</div>
                <div
                  className={`text-sm font-semibold ${
                    activeProbe.sample.v > 0.01
                      ? 'text-amber-300'
                      : activeProbe.sample.v < -0.01
                        ? 'text-sky-300'
                        : 'text-slate-200'
                  }`}
                >
                  {formatPotential(activeProbe.sample.v)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-slate-400">Magnitude |E|</div>
                <div className="text-sm font-semibold text-slate-100">
                  {formatFieldMag(activeProbe.sample.eMag)}
                </div>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Ex: {activeProbe.sample.ex >= 0 ? '+' : ''}
                  {activeProbe.sample.ex.toFixed(1)} kV/m
                </span>
                <span>
                  Ey: {activeProbe.sample.ey >= 0 ? '+' : ''}
                  {activeProbe.sample.ey.toFixed(1)} kV/m
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Hover anywhere on the canvas to sample V(r) and E(r).
            </div>
          )}
        </div>

        {/* Bottom-Right Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B101B]/92 p-1 backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
            aria-label="Zoom out"
            className="p-2 rounded-md text-slate-300 hover:bg-slate-800 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Reset zoom to 100%"
            className="px-2.5 py-1 text-xs font-mono tabular-nums text-slate-300 hover:text-slate-50 cursor-pointer"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
            aria-label="Zoom in"
            className="p-2 rounded-md text-slate-300 hover:bg-slate-800 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </main>
    );
  }
);

FieldCanvas.displayName = 'FieldCanvas';
