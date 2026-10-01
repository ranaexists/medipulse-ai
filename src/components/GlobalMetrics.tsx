import React from 'react';
import { AlertTriangle, Clock, ShieldAlert, Activity } from 'lucide-react';
import { RiskEngineAggregates } from '../types';

interface GlobalMetricsProps {
  aggregates: RiskEngineAggregates;
  totalFacilities: number;
}

export const GlobalMetrics: React.FC<GlobalMetricsProps> = ({
  aggregates,
  totalFacilities,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Facilities in Critical Deficit (<48 hrs) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Critical Deficit (&lt;48 hrs)
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#B91C1C] tracking-tight">
              {aggregates.criticalFacilitiesCount}{' '}
              <span className="text-sm font-normal text-slate-500">
                / {totalFacilities} facilities
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Stockout Vulnerability Index &le; 2.0 days
            </div>
          </div>
          <div className="p-2 rounded bg-red-50 text-[#B91C1C] border border-red-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. Active Ghost Inventory Discrepancies */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Ghost Stock Discrepancies
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#B91C1C] tracking-tight">
              {aggregates.activeGhostDiscrepanciesCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Portal positive vs 72h ASHA shortage
            </div>
          </div>
          <div className="p-2 rounded bg-red-50 text-[#B91C1C] border border-red-200">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Value of Stock at Risk of Imminent Expiry (INR) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Imminent Expiry at Risk (INR)
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#B45309] tracking-tight font-mono">
              ₹{aggregates.expiringStockValueInr.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Exp &le; 30d exceeding 7d local burn
            </div>
          </div>
          <div className="p-2 rounded bg-amber-50 text-[#B45309] border border-amber-200">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 4. Aggregate Supply Chain Resilience Score (%) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Supply Chain Resilience
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#15803D] tracking-tight font-mono">
              {aggregates.supplyChainResilienceScore}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Weighted cross-district integrity index
            </div>
          </div>
          <div className="p-2 rounded bg-emerald-50 text-[#15803D] border border-emerald-200">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

