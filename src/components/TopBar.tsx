import React from 'react';
import { Download } from 'lucide-react';

interface TopBarProps {
  activePresetId: string | null;
  onSelectPreset: (presetId: string) => void;
  onOpenGuide: () => void;
  onExportPng: () => void;
}

const TOP_PRESETS = [
  { id: 'dipole', label: 'Dipole' },
  { id: 'quadrupole', label: 'Quadrupole' },
  { id: 'capacitor', label: 'Parallel Plates' },
  { id: 'shield', label: 'Faraday Ring' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activePresetId,
  onSelectPreset,
  onOpenGuide,
  onExportPng,
}) => {
  return (
    <header className="h-14 shrink-0 border-b border-slate-800 bg-[#0B101B] px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectPreset('dipole');
        }}
        className="text-lg font-semibold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-4 rounded"
      >
        CoulombLab
      </a>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav
        aria-label="Preset configurations and physics guide"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
      >
        {TOP_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-4 cursor-pointer ${
                isActive
                  ? 'text-slate-100 border-sky-400'
                  : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenGuide}
          className="whitespace-nowrap shrink-0 py-1 text-slate-400 border-b-2 border-transparent hover:text-slate-100 hover:border-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-4 cursor-pointer"
        >
          Physics Guide
        </button>
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportPng}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-2"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export Snapshot</span>
        </button>
      </div>
    </header>
  );
};
