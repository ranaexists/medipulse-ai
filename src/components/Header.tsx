import React from 'react';
import { Database, FileCode2 } from 'lucide-react';

interface HeaderProps {
  onOpenPythonModal: () => void;
  onOpenStateInspector: () => void;
  activeDistrict: string;
  activeRole: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPythonModal,
  onOpenStateInspector,
  activeDistrict,
  activeRole,
}) => {
  return (
    <header className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 text-white shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              MediPulse AI: National Medicine Stockout Early-Warning & Optimization System
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            National Health Mission (NHM) • Digital Public Goods Infrastructure • Pilot: Haryana State
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase bg-emerald-950/70 text-emerald-400 border border-emerald-800">
            Telemetry: Live
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase bg-sky-950/70 text-sky-400 border border-sky-800">
            Pilot: Karnal, Kurukshetra, Panipat
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase bg-slate-800 text-slate-300 border border-slate-700">
            DPGA Standard
          </span>

          <div className="flex items-center gap-2 ml-auto lg:ml-2">
            <button
              onClick={onOpenStateInspector}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Inspect st.session_state 4 relational tables"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Data Pipeline Inspector</span>
            </button>

            <button
              onClick={onOpenPythonModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="View & Copy Streamlit Python app.py"
            >
              <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Python app.py</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            Active Scope: <strong className="text-slate-200">{activeDistrict}</strong>
          </span>
          <span>
            Role Context: <strong className="text-slate-200">{activeRole}</strong>
          </span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          Directorate of Health Services • Government of Haryana
        </div>
      </div>
    </header>
  );
};
