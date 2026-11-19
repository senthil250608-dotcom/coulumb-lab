import React from 'react';
import {
  Crosshair,
  GripVertical,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  ColormapType,
  ContourDensity,
  InteractionTool,
  PointCharge,
  SimulationSettings,
} from '../types/physics';
import {
  PRESETS,
  computeForceOnCharge,
  getColormapCssGradient,
} from '../physics/electrostatics';

interface ControlSidebarProps {
  charges: PointCharge[];
  selectedChargeId: string | null;
  activeTool: InteractionTool;
  settings: SimulationSettings;
  activePresetId: string | null;
  testParticleCount: number;
  onToolChange: (tool: InteractionTool) => void;
  onAddChargeAtCenter: (q: number) => void;
  onUpdateChargeMagnitude: (id: string, q: number) => void;
  onDeleteCharge: (id: string) => void;
  onClearCharges: () => void;
  onUpdateSettings: (patch: Partial<SimulationSettings>) => void;
  onSelectPreset: (presetId: string) => void;
  onClearTestParticles: () => void;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  charges,
  selectedChargeId,
  activeTool,
  settings,
  activePresetId,
  testParticleCount,
  onToolChange,
  onAddChargeAtCenter,
  onUpdateChargeMagnitude,
  onDeleteCharge,
  onClearCharges,
  onUpdateSettings,
  onSelectPreset,
  onClearTestParticles,
}) => {
  const selectedCharge = charges.find((c) => c.id === selectedChargeId) ?? null;
  const selectedForce = selectedCharge ? computeForceOnCharge(selectedCharge, charges) : null;

  const netCharge = charges.reduce((acc, c) => acc + c.q, 0);

  const handlePaletteDragStart = (e: React.DragEvent<HTMLDivElement>, q: number) => {
    e.dataTransfer.setData('application/x-coulomb-charge', String(q));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside
      aria-label="Electrostatic simulation controls"
      className="w-full lg:w-[356px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0D1320] flex flex-col max-h-[44vh] lg:max-h-none overflow-y-auto lab-scroll"
    >
      <div className="p-5 space-y-6">
        {/* Section 1: Interaction Tool & Point Charge Palette */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Point Charges</h2>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {charges.length} {charges.length === 1 ? 'charge' : 'charges'} · Σq {netCharge >= 0 ? '+' : ''}
              {netCharge.toFixed(1)} µC
            </span>
          </div>

          {/* Tool Selector */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800">
            <button
              type="button"
              onClick={() => onToolChange(InteractionTool.SelectMove)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTool === InteractionTool.SelectMove
                  ? 'bg-slate-800 text-slate-50 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Move</span>
            </button>
            <button
              type="button"
              onClick={() => onToolChange(InteractionTool.PinProbe)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTool === InteractionTool.PinProbe
                  ? 'bg-slate-800 text-slate-50 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Probe</span>
            </button>
            <button
              type="button"
              onClick={() => onToolChange(InteractionTool.LaunchTestCharge)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTool === InteractionTool.LaunchTestCharge
                  ? 'bg-slate-800 text-slate-50 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Test +q₀</span>
            </button>
          </div>

          {activeTool === InteractionTool.LaunchTestCharge && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#090D16] px-3 py-2 text-xs text-slate-300">
              <span>Click canvas to release a +q₀ test charge</span>
              {testParticleCount > 0 && (
                <button
                  type="button"
                  onClick={onClearTestParticles}
                  className="text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap cursor-pointer"
                >
                  Clear ({testParticleCount})
                </button>
              )}
            </div>
          )}

          {/* Drag-and-drop charge emitters */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              draggable
              onDragStart={(e) => handlePaletteDragStart(e, 2)}
              className="group flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#090D16] px-3 py-2.5 hover:border-rose-500/50 transition-colors cursor-grab active:cursor-grabbing"
              title="Drag onto the canvas or click + to add a +2.0 µC charge"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" aria-hidden="true" />
                <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/70 text-rose-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  +
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate">Positive</div>
                  <div className="text-[11px] font-mono text-slate-400">+2.0 µC</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddChargeAtCenter(2)}
                aria-label="Add +2 microcoulomb charge"
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              draggable
              onDragStart={(e) => handlePaletteDragStart(e, -2)}
              className="group flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#090D16] px-3 py-2.5 hover:border-sky-500/50 transition-colors cursor-grab active:cursor-grabbing"
              title="Drag onto the canvas or click + to add a -2.0 µC charge"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" aria-hidden="true" />
                <span className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/70 text-sky-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  −
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate">Negative</div>
                  <div className="text-[11px] font-mono text-slate-400">−2.0 µC</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddChargeAtCenter(-2)}
                aria-label="Add -2 microcoulomb charge"
                className="p-1.5 rounded-md text-slate-400 hover:text-sky-300 hover:bg-sky-500/15 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Drag tokens onto the field stage, or double-click the canvas to drop a charge.
          </p>
        </section>

        {/* Section 2: Selected Charge Inspector */}
        <section className="border-t border-slate-800 pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Selected Charge</h2>
            {charges.length > 0 && (
              <button
                type="button"
                onClick={onClearCharges}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {selectedCharge ? (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-[#090D16] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedCharge.q >= 0 ? 'bg-rose-400' : 'bg-sky-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-slate-200">
                    {selectedCharge.q >= 0 ? 'Positive Source' : 'Negative Sink'}
                  </span>
                </div>
                <span className="text-sm font-mono font-semibold tabular-nums text-slate-50">
                  {selectedCharge.q >= 0 ? '+' : ''}
                  {selectedCharge.q.toFixed(1)} µC
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>−8.0 µC</span>
                  <span>Magnitude</span>
                  <span>+8.0 µC</span>
                </div>
                <input
                  type="range"
                  aria-label="Selected charge magnitude in microcoulombs"
                  min={-8}
                  max={8}
                  step={0.5}
                  value={selectedCharge.q}
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (val === 0) val = selectedCharge.q >= 0 ? -0.5 : 0.5;
                    onUpdateChargeMagnitude(selectedCharge.id, val);
                  }}
                  className="lab-slider"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono tabular-nums">
                <div className="rounded bg-[#0D1320] px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-sans">Position</div>
                  <div className="text-slate-200">
                    ({selectedCharge.x.toFixed(2)}, {selectedCharge.y.toFixed(2)}) m
                  </div>
                </div>
                <div className="rounded bg-[#0D1320] px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-sans">Net Force |F|</div>
                  <div className="text-amber-300">
                    {selectedForce ? `${selectedForce.fMag.toFixed(2)} mN` : '0.00 mN'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateChargeMagnitude(selectedCharge.id, -selectedCharge.q)}
                  className="flex-1 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Invert Sign
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCharge(selectedCharge.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800/80 bg-[#090D16]/60 px-3.5 py-3 text-xs text-slate-400">
              Click any point charge on the canvas to inspect its coordinates, net force, or adjust its charge magnitude.
            </div>
          )}
        </section>

        {/* Section 3: Field Lines & Equipotential Controls */}
        <section className="border-t border-slate-800 pt-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Field &amp; Potential Layers</h2>

          {/* Field Lines Toggle + Density Slider */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="toggle-field-lines" className="text-xs font-medium text-slate-200 cursor-pointer">
                Electric Field Lines
              </label>
              <button
                id="toggle-field-lines"
                type="button"
                role="switch"
                aria-checked={settings.showFieldLines}
                onClick={() => onUpdateSettings({ showFieldLines: !settings.showFieldLines })}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  settings.showFieldLines ? 'bg-sky-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.showFieldLines ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className={`space-y-1.5 transition-opacity ${settings.showFieldLines ? 'opacity-100' : 'opacity-45 pointer-events-none'}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Line Density</span>
                <span className="font-mono tabular-nums text-sky-300">
                  {settings.fieldLineDensity} lines / µC
                </span>
              </div>
              <input
                type="range"
                aria-label="Field line density per microcoulomb"
                min={4}
                max={24}
                step={2}
                value={settings.fieldLineDensity}
                onChange={(e) =>
                  onUpdateSettings({ fieldLineDensity: parseInt(e.target.value, 10) })
                }
                className="lab-slider"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Sparse (4)</span>
                <span>Medium (12)</span>
                <span>Dense (24)</span>
              </div>
            </div>
          </div>

          {/* Equipotential Contours Toggle + Spacing */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="toggle-equipotentials" className="text-xs font-medium text-slate-200 cursor-pointer">
                Equipotential Contours
              </label>
              <button
                id="toggle-equipotentials"
                type="button"
                role="switch"
                aria-checked={settings.showEquipotentials}
                onClick={() =>
                  onUpdateSettings({ showEquipotentials: !settings.showEquipotentials })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  settings.showEquipotentials ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.showEquipotentials ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800 transition-opacity ${
                settings.showEquipotentials ? 'opacity-100' : 'opacity-45 pointer-events-none'
              }`}
            >
              {(
                [
                  { id: ContourDensity.Coarse, label: 'Coarse' },
                  { id: ContourDensity.Standard, label: 'Standard' },
                  { id: ContourDensity.Fine, label: 'Fine' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ contourDensity: opt.id })}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    settings.contourDensity === opt.id
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Layer Toggles */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onUpdateSettings({ showVectorGrid: !settings.showVectorGrid })}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-left ${
                settings.showVectorGrid
                  ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                  : 'border-slate-800 bg-[#090D16] text-slate-400 hover:text-slate-200'
              }`}
            >
              Vector Arrows
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showGridAxes: !settings.showGridAxes })}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-left ${
                settings.showGridAxes
                  ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                  : 'border-slate-800 bg-[#090D16] text-slate-400 hover:text-slate-200'
              }`}
            >
              Meter Grid
            </button>
          </div>
        </section>

        {/* Section 4: Field Intensity Heatmap Overlay */}
        <section className="border-t border-slate-800 pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label htmlFor="toggle-heatmap" className="text-sm font-semibold text-slate-100 cursor-pointer block">
                Field Intensity Heatmap
              </label>
              <span className="text-xs text-slate-400">Logarithmic |E| scalar overlay</span>
            </div>
            <button
              id="toggle-heatmap"
              type="button"
              role="switch"
              aria-checked={settings.showHeatmap}
              onClick={() => onUpdateSettings({ showHeatmap: !settings.showHeatmap })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.showHeatmap ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  settings.showHeatmap ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div
            className={`space-y-3 transition-opacity ${
              settings.showHeatmap ? 'opacity-100' : 'opacity-45 pointer-events-none'
            }`}
          >
            {/* Colormap Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800">
              {(
                [
                  { id: ColormapType.Inferno, label: 'Inferno' },
                  { id: ColormapType.Viridis, label: 'Viridis' },
                  { id: ColormapType.Coolwarm, label: 'Thermal' },
                ] as const
              ).map((map) => (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => onUpdateSettings({ colormap: map.id })}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    settings.colormap === map.id
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {map.label}
                </button>
              ))}
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Overlay Opacity</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {Math.round(settings.heatmapOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Heatmap overlay opacity"
                min={0.2}
                max={0.95}
                step={0.05}
                value={settings.heatmapOpacity}
                onChange={(e) =>
                  onUpdateSettings({ heatmapOpacity: parseFloat(e.target.value) })
                }
                className="lab-slider"
              />
            </div>

            {/* Calibrated Colorbar */}
            <div className="space-y-1 pt-0.5">
              <div
                className="h-2.5 w-full rounded-sm border border-slate-700/70"
                style={{ background: getColormapCssGradient(settings.colormap) }}
              />
              <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400">
                <span>0.4 kV/m</span>
                <span>12 kV/m</span>
                <span>400+ kV/m</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Lab Presets */}
        <section className="border-t border-slate-800 pt-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-100">Lab Configurations</h2>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  title={preset.summary}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors truncate cursor-pointer ${
                    isActive
                      ? 'border-sky-400/70 bg-sky-500/10 text-sky-200'
                      : 'border-slate-800 bg-[#090D16] text-slate-300 hover:border-slate-700 hover:text-slate-100'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
};
