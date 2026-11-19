import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ColormapType,
  ContourDensity,
  InteractionTool,
  PointCharge,
  SimulationSettings,
  TestParticle,
} from './types/physics';
import { PRESETS } from './physics/electrostatics';
import { TopBar } from './components/TopBar';
import { ControlSidebar } from './components/ControlSidebar';
import { FieldCanvas, FieldCanvasHandle } from './components/FieldCanvas';
import { PhysicsGuideModal } from './components/PhysicsGuideModal';

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPresetCharges(presetId: string): PointCharge[] {
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  return preset.charges.map((c, idx) => ({
    id: `${preset.id}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    x: c.x,
    y: c.y,
    q: c.q,
  }));
}

export default function App() {
  const canvasHandleRef = useRef<FieldCanvasHandle>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>('dipole');
  const [charges, setCharges] = useState<PointCharge[]>(() => buildPresetCharges('dipole'));
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<InteractionTool>(InteractionTool.SelectMove);
  const [testParticles, setTestParticles] = useState<TestParticle[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<SimulationSettings>({
    showFieldLines: true,
    fieldLineDensity: 10,
    showEquipotentials: true,
    contourDensity: ContourDensity.Standard,
    showHeatmap: false,
    heatmapOpacity: 0.7,
    colormap: ColormapType.Inferno,
    showVectorGrid: false,
    showGridAxes: true,
  });

  const handleUpdateSettings = useCallback((patch: Partial<SimulationSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectPreset = useCallback((presetId: string) => {
    setActivePresetId(presetId);
    setCharges(buildPresetCharges(presetId));
    setSelectedChargeId(null);
    setTestParticles([]);
  }, []);

  const handleAddChargeAt = useCallback((x: number, y: number, q: number) => {
    const newCharge: PointCharge = {
      id: makeId('q'),
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      q,
    };
    setCharges((prev) => [...prev, newCharge]);
    setSelectedChargeId(newCharge.id);
    setActivePresetId(null);
  }, []);

  const handleAddChargeAtCenter = useCallback(
    (q: number) => {
      // Offset slightly so multiple clicks don't stack on identical coordinates
      const jitterX = ((charges.length % 5) - 2) * 0.35;
      const jitterY = (Math.floor(charges.length / 5) % 3) * 0.35;
      handleAddChargeAt(jitterX, jitterY, q);
    },
    [charges.length, handleAddChargeAt]
  );

  const handleMoveCharge = useCallback((id: string, x: number, y: number) => {
    setCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, x, y } : c))
    );
    setActivePresetId(null);
  }, []);

  const handleUpdateChargeMagnitude = useCallback((id: string, q: number) => {
    setCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, q } : c))
    );
    setActivePresetId(null);
  }, []);

  const handleDeleteCharge = useCallback((id: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== id));
    setSelectedChargeId((prevId) => (prevId === id ? null : prevId));
    setActivePresetId(null);
  }, []);

  const handleClearCharges = useCallback(() => {
    setCharges([]);
    setSelectedChargeId(null);
    setTestParticles([]);
    setActivePresetId(null);
  }, []);

  const handleSpawnTestParticle = useCallback((x: number, y: number) => {
    const particle: TestParticle = {
      id: makeId('tp'),
      x,
      y,
      vx: 0,
      vy: 0,
      trail: [{ x, y }],
      alive: true,
    };
    setTestParticles((prev) => [...prev.slice(-11), particle]);
  }, []);

  // Keyboard shortcuts for fast classroom & lab workflow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape') {
        if (isGuideOpen) {
          setIsGuideOpen(false);
        } else {
          setSelectedChargeId(null);
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedChargeId) {
        e.preventDefault();
        handleDeleteCharge(selectedChargeId);
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        handleUpdateSettings({ showHeatmap: !settings.showHeatmap });
      } else if (e.key === 'e' || e.key === 'E') {
        handleUpdateSettings({ showEquipotentials: !settings.showEquipotentials });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isGuideOpen,
    selectedChargeId,
    settings.showHeatmap,
    settings.showEquipotentials,
    handleDeleteCharge,
    handleUpdateSettings,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#090D16] text-slate-100">
      <TopBar
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onOpenGuide={() => setIsGuideOpen(true)}
        onExportPng={() => canvasHandleRef.current?.exportPng()}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <ControlSidebar
          charges={charges}
          selectedChargeId={selectedChargeId}
          activeTool={activeTool}
          settings={settings}
          activePresetId={activePresetId}
          testParticleCount={testParticles.length}
          onToolChange={setActiveTool}
          onAddChargeAtCenter={handleAddChargeAtCenter}
          onUpdateChargeMagnitude={handleUpdateChargeMagnitude}
          onDeleteCharge={handleDeleteCharge}
          onClearCharges={handleClearCharges}
          onUpdateSettings={handleUpdateSettings}
          onSelectPreset={handleSelectPreset}
          onClearTestParticles={() => setTestParticles([])}
        />

        <FieldCanvas
          ref={canvasHandleRef}
          charges={charges}
          selectedChargeId={selectedChargeId}
          activeTool={activeTool}
          settings={settings}
          testParticles={testParticles}
          onSelectCharge={setSelectedChargeId}
          onMoveCharge={handleMoveCharge}
          onAddChargeAt={handleAddChargeAt}
          onSpawnTestParticle={handleSpawnTestParticle}
          onUpdateTestParticles={setTestParticles}
        />
      </div>

      <PhysicsGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
