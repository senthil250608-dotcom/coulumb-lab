import React from 'react';
import { X } from 'lucide-react';

interface PhysicsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhysicsGuideModal: React.FC<PhysicsGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="physics-guide-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0E1525] text-slate-100 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 id="physics-guide-title" className="text-lg font-semibold text-slate-50">
            Electrostatic Field &amp; Equipotential Principles
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close physics guide"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm leading-relaxed text-slate-300 max-h-[75vh] overflow-y-auto lab-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4 space-y-1.5">
              <div className="text-xs font-medium text-sky-400">01. Electric Field Superposition</div>
              <div className="font-mono text-xs text-slate-100 py-1">
                E(r) = Σ kₑ · qᵢ (r − rᵢ) / |r − rᵢ|³
              </div>
              <p className="text-xs text-slate-400">
                The net electric field vector at any point is the vector sum of individual Coulomb contributions from every charge qᵢ.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4 space-y-1.5">
              <div className="text-xs font-medium text-amber-400">02. Scalar Electric Potential</div>
              <div className="font-mono text-xs text-slate-100 py-1">
                V(r) = Σ kₑ · qᵢ / |r − rᵢ|
              </div>
              <p className="text-xs text-slate-400">
                Unlike the vector field E, potential V is a scalar sum. Points of equal V form equipotential contours, always perpendicular to field lines (E = −∇V).
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h3 className="text-sm font-semibold text-slate-100">Reading the Visualization</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <span className="font-semibold text-slate-100">Field Line Density:</span> The number of streamlines emerging from or terminating on a charge is proportional to |q|. Increasing density reveals finer field curvature near saddle points.
              </li>
              <li>
                <span className="font-semibold text-slate-100">Equipotential Contours:</span> Warm amber contours trace positive potential (V &gt; 0 kV), sky-blue contours trace negative potential (V &lt; 0 kV), and dashed white contours mark V = 0 kV.
              </li>
              <li>
                <span className="font-semibold text-slate-100">Intensity Heatmap:</span> Maps |E| on a logarithmic scale from 0.4 kV/m to 400 kV/m so both far-field gradients and near-charge peaks remain legible.
              </li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h3 className="text-sm font-semibold text-slate-100">Lab Controls &amp; Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between gap-2">
                <span>Drag charge token to canvas</span>
                <span className="font-mono text-slate-200">Place charge</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Double-click empty canvas</span>
                <span className="font-mono text-slate-200">Quick add +1 µC</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Hold Shift while dragging</span>
                <span className="font-mono text-slate-200">Snap 0.25 m grid</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Delete / Backspace</span>
                <span className="font-mono text-slate-200">Remove selected</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Key H / Key E</span>
                <span className="font-mono text-slate-200">Toggle Heatmap / V</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
