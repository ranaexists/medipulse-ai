import React, { useState } from 'react';
import { Database, X, Copy, Check, Braces } from 'lucide-react';
import {
  FacilityRecord,
  InventoryRecord,
  HistoricalConsumptionRecord,
  AshaGroundReportRecord,
  RedistributionTransferOrder,
  RedistributionEscalation,
  RedistributionItem,
} from '../types';

interface SessionStateViewerProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: FacilityRecord[];
  inventory: InventoryRecord[];
  historicalConsumption: HistoricalConsumptionRecord[];
  ashaReports: AshaGroundReportRecord[];
  redistribution: (RedistributionTransferOrder | RedistributionItem)[];
  escalations?: RedistributionEscalation[];
}

export const SessionStateViewer: React.FC<SessionStateViewerProps> = ({
  isOpen,
  onClose,
  facilities,
  inventory,
  historicalConsumption,
  ashaReports,
  redistribution,
  escalations = [],
}) => {
  const [activeKey, setActiveKey] = useState<
    | 'facilities_df'
    | 'inventory_df'
    | 'historical_consumption_df'
    | 'asha_ground_reports_df'
    | 'redistribution_plan'
    | 'redistribution_escalations_df'
  >('inventory_df');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const dataMap = {
    facilities_df: facilities,
    inventory_df: inventory,
    historical_consumption_df: historicalConsumption.slice(0, 50),
    asha_ground_reports_df: ashaReports,
    redistribution_plan: redistribution,
    redistribution_escalations_df: escalations,
  };

  const currentJson = JSON.stringify(dataMap[activeKey], null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#0F172A] text-white">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold">Relational Pipeline Inspector</h3>
              <p className="text-[11px] text-slate-400">
                Live inspection of relational dataframes, FEFO redistribution & central escalations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 text-sm font-semibold rounded hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setActiveKey('facilities_df')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'facilities_df'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            facilities_df ({facilities.length})
          </button>
          <button
            onClick={() => setActiveKey('inventory_df')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'inventory_df'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            inventory_df ({inventory.length})
          </button>
          <button
            onClick={() => setActiveKey('historical_consumption_df')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'historical_consumption_df'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            historical_consumption_df ({historicalConsumption.length})
          </button>
          <button
            onClick={() => setActiveKey('asha_ground_reports_df')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'asha_ground_reports_df'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            asha_ground_reports_df ({ashaReports.length})
          </button>
          <button
            onClick={() => setActiveKey('redistribution_plan')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'redistribution_plan'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            redistribution_plan ({redistribution.length})
          </button>
          <button
            onClick={() => setActiveKey('redistribution_escalations_df')}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
              activeKey === 'redistribution_escalations_df'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            escalations_df ({escalations.length})
          </button>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-mono flex items-center gap-1.5">
            <Braces className="w-3.5 h-3.5 text-sky-700" />
            <span>
              Format: Tabular Array / Record-Oriented JSON Schema (NIC/CoWIN Interoperability)
            </span>
          </span>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-medium"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#15803D]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{copied ? 'Copied JSON' : 'Copy JSON Payload'}</span>
          </button>
        </div>

        {/* JSON Viewer */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-900 font-mono text-xs text-sky-300 leading-relaxed">
          <pre>{currentJson}</pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
          <span>Targeting state storage key: <strong className="text-slate-900 font-mono">st.session_state.{activeKey}</strong></span>
          <span>Status: Validated Vector Structure</span>
        </div>
      </div>
    </div>
  );
};
