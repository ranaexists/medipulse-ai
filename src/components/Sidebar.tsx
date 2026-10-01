import React from 'react';
import { RefreshCw, MapPin, User, SlidersHorizontal, Building2, Calendar } from 'lucide-react';
import { RoleType, DistrictFilterType, FacilityTypeFilter, DateRangeFilter, SystemModeType } from '../types';

interface SidebarProps {
  selectedRole: RoleType;
  onSelectRole: (role: RoleType) => void;
  selectedDistrict: DistrictFilterType;
  onSelectDistrict: (district: DistrictFilterType) => void;
  selectedFacilityType: FacilityTypeFilter;
  onSelectFacilityType: (tier: FacilityTypeFilter) => void;
  selectedDateRange: DateRangeFilter;
  onSelectDateRange: (range: DateRangeFilter) => void;
  systemMode: SystemModeType;
  onSelectSystemMode: (mode: SystemModeType) => void;
  onReseedData: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  lastSyncTime: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedRole,
  onSelectRole,
  selectedDistrict,
  onSelectDistrict,
  selectedFacilityType,
  onSelectFacilityType,
  selectedDateRange,
  onSelectDateRange,
  systemMode,
  onSelectSystemMode,
  onReseedData,
  isOpenMobile,
  onCloseMobile,
  lastSyncTime,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
        />
      )}

      <aside
        className={`
        fixed lg:static top-0 bottom-0 left-0 z-50
        w-72 sm:w-80 bg-[#0F172A] border-r border-slate-800 p-5
        flex flex-col h-full overflow-y-auto text-slate-200
        transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        {/* Sidebar Header */}
        <div className="pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                National Health Mission
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                Digital Public Infrastructure
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-white p-1 text-sm font-semibold"
            >
              ✕
            </button>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Haryana State Primary Care Surveillance
          </div>
        </div>

        <div className="space-y-5 py-4 flex-1">
          {/* 1. Role Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>Operating Role</span>
            </label>
            <select
              value={selectedRole}
              onChange={(e) => onSelectRole(e.target.value as RoleType)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="District Health Officer (DHO)">District Health Officer (DHO)</option>
              <option value="PHC Medical Officer">PHC Medical Officer</option>
              <option value="ASHA Field Coordinator">ASHA Field Coordinator</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Determines audit authorization and transfer dispatch privilege.
            </p>
          </div>

          {/* 2. District Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>Geographic Filter</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['All Districts', 'Karnal', 'Kurukshetra', 'Panipat'] as DistrictFilterType[]).map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => onSelectDistrict(dist)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-all text-center cursor-pointer ${
                    selectedDistrict === dist
                      ? 'bg-sky-600 text-white border-sky-500 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {dist}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Facility Tier Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Facility Tier</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['All Types', 'PHC', 'CHC'] as FacilityTypeFilter[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onSelectFacilityType(tier)}
                  className={`px-2 py-1.5 text-xs font-medium rounded border transition-all text-center cursor-pointer ${
                    selectedFacilityType === tier
                      ? 'bg-sky-600 text-white border-sky-500 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Historical Horizon / Date Range */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Telemetry Horizon</span>
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => onSelectDateRange(e.target.value as DateRangeFilter)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="Past 90 Days">Past 90 Days (Full Quarter)</option>
              <option value="Past 60 Days">Past 60 Days</option>
              <option value="Past 30 Days">Past 30 Days (Monthly)</option>
              <option value="Past 14 Days">Past 14 Days (Immediate)</option>
            </select>
          </div>

          {/* 5. System Telemetry Mode */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>System Telemetry Mode</span>
            </label>
            <div className="space-y-2 bg-slate-900/90 p-2.5 rounded border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="radio"
                  name="systemMode"
                  value="Real-time Simulation"
                  checked={systemMode === 'Real-time Simulation'}
                  onChange={() => onSelectSystemMode('Real-time Simulation')}
                  className="accent-sky-500"
                />
                <span>Real-time Simulation (Live)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="radio"
                  name="systemMode"
                  value="Historical Monitoring"
                  checked={systemMode === 'Historical Monitoring'}
                  onChange={() => onSelectSystemMode('Historical Monitoring')}
                  className="accent-sky-500"
                />
                <span>Historical Monitoring</span>
              </label>
            </div>
          </div>

          {/* 4. Data Pipeline Management & Re-seed Button */}
          <div className="pt-3 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Data Pipeline Management
            </div>

            <button
              type="button"
              onClick={onReseedData}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Reset / Re-seed Data Pipeline</span>
            </button>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded p-2.5 mt-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Facilities Monitored:</span>
                <span className="text-slate-200 font-mono">15 PHC / CHC</span>
              </div>
              <div className="flex justify-between">
                <span>Relational Tables:</span>
                <span className="text-slate-200 font-mono">4 Dataframes</span>
              </div>
              <div className="flex justify-between">
                <span>Last Pipeline Sync:</span>
                <span className="text-sky-400 font-mono text-[10px]">{lastSyncTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
          <div>CoWIN / NIC Public Goods Standards</div>
          <div className="text-[10px] text-slate-600 mt-0.5">MediPulse AI Phase 2 • Relational Pipeline</div>
        </div>
      </aside>
    </>
  );
};
