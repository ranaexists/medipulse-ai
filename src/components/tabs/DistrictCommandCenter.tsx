import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, MapPin, Building2, Users, Clock, Activity, ArrowRight, Sparkles, Copy, Check } from 'lucide-react';
import {
  InventoryRecord,
  FacilityRecord,
  DistrictFilterType,
  FacilityTypeFilter,
  RiskSummaryRecord,
  RiskEngineAggregates,
} from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateClinicalBrief, ClinicalBrief } from '../../services/geminiService';

interface DistrictCommandCenterProps {
  inventory: InventoryRecord[];
  facilities: FacilityRecord[];
  selectedDistrict: DistrictFilterType;
  selectedFacilityType?: FacilityTypeFilter;
  riskSummary?: RiskSummaryRecord[];
  aggregates?: RiskEngineAggregates;
  actionDrawerItems?: RiskSummaryRecord[];
  onInitiateAudit?: (facilityId: string, medicineName: string) => void;
  onDispatchAction?: (facilityId: string, medicineName: string, actionType: string) => void;
}

export const DistrictCommandCenter: React.FC<DistrictCommandCenterProps> = ({
  inventory,
  facilities,
  selectedDistrict,
  selectedFacilityType = 'All Types',
  riskSummary = [],
  aggregates,
  actionDrawerItems = [],
  onInitiateAudit,
  onDispatchAction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuickMed, setSelectedQuickMed] = useState('All 8 Medicines');
  const [hoveredFacility, setHoveredFacility] = useState<any | null>(null);
  const [selectedMapFacilityId, setSelectedMapFacilityId] = useState<string | null>(null);
  const [dispatchedActions, setDispatchedActions] = useState<Record<string, string>>({});

  // Phase 7: Gemini Clinical Brief state
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [clinicalBrief, setClinicalBrief] = useState<{
    brief: ClinicalBrief;
    isLive: boolean;
    message: string;
  } | null>(null);
  const [copiedBrief, setCopiedBrief] = useState(false);

  // Filter facilities by district and tier
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      const matchDist = selectedDistrict === 'All Districts' || f.district === selectedDistrict;
      const matchTier =
        selectedFacilityType === 'All Types' ||
        f.facility_type === selectedFacilityType;
      return matchDist && matchTier;
    });
  }, [facilities, selectedDistrict, selectedFacilityType]);

  const validFacilityIds = useMemo(
    () => new Set(filteredFacilities.map((f) => f.facility_id)),
    [filteredFacilities]
  );

  // Filter inventory by active facilities
  const scopedInventory = useMemo(() => {
    return inventory.filter((item) => validFacilityIds.has(item.facility_id));
  }, [inventory, validFacilityIds]);

  // Filter inventory by quick medicine filter
  const medicineFilteredInventory = useMemo(() => {
    if (selectedQuickMed === 'All 8 Medicines') {
      return scopedInventory;
    }
    return scopedInventory.filter((item) => item.medicine_name === selectedQuickMed);
  }, [scopedInventory, selectedQuickMed]);

  // Compute facility-level status for map pins and risk distribution
  const facilityRiskMetrics = useMemo(() => {
    return filteredFacilities.map((fac) => {
      const items = medicineFilteredInventory.filter((i) => i.facility_id === fac.facility_id);
      
      let status: 'Critical Stockout (<4d)' | 'Low Stock (4-14d)' | 'Adequate Stock (>14d)' = 'Adequate Stock (>14d)';
      let minDoi = 99;
      let topDeficit = 'None';

      if (items.length > 0) {
        const sortedByDoi = [...items].sort((a, b) => (a.days_of_stock || 0) - (b.days_of_stock || 0));
        minDoi = sortedByDoi[0].days_of_stock ?? 99;

        const criticalItem = items.find((i) => i.stock_status === 'Critical Deficit' || (i.days_of_stock ?? 99) <= 4);
        const lowItem = items.find((i) => i.stock_status === 'Low Stock' || ((i.days_of_stock ?? 99) > 4 && (i.days_of_stock ?? 99) <= 14));

        if (criticalItem) {
          status = 'Critical Stockout (<4d)';
          topDeficit = criticalItem.medicine_name;
        } else if (lowItem) {
          status = 'Low Stock (4-14d)';
          topDeficit = lowItem.medicine_name;
        }
      }

      const estDailyOpd = Math.round(
        fac.catchment_population * (fac.facility_type === 'CHC' ? 0.0035 : 0.0022)
      );

      return {
        ...fac,
        minDoi,
        riskStatus: status,
        topDeficitMedicine: topDeficit,
        dailyOpd: estDailyOpd,
      };
    });
  }, [filteredFacilities, medicineFilteredInventory]);

  // Risk distribution breakdown
  const riskCounts = useMemo(() => {
    const counts = {
      'Critical Stockout (<4d)': 0,
      'Low Stock (4-14d)': 0,
      'Adequate Stock (>14d)': 0,
    };
    facilityRiskMetrics.forEach((f) => {
      counts[f.riskStatus]++;
    });
    return [
      { name: 'Critical (<4d)', count: counts['Critical Stockout (<4d)'], color: '#B91C1C' },
      { name: 'Low (4-14d)', count: counts['Low Stock (4-14d)'], color: '#B45309' },
      { name: 'Adequate (>14d)', count: counts['Adequate Stock (>14d)'], color: '#15803D' },
    ];
  }, [facilityRiskMetrics]);

  // Search & table display list
  const displayedInventory = useMemo(() => {
    return medicineFilteredInventory.filter((item) => {
      const term = searchTerm.toLowerCase();
      return (
        (item.facility_name || '').toLowerCase().includes(term) ||
        item.medicine_name.toLowerCase().includes(term) ||
        item.batch_id.toLowerCase().includes(term) ||
        (item.district || '').toLowerCase().includes(term)
      );
    });
  }, [medicineFilteredInventory, searchTerm]);

  // Critical items banner
  const criticalItems = useMemo(() => {
    return scopedInventory.filter((i) => i.stock_status === 'Critical Deficit' || (i.days_of_stock ?? 99) <= 4);
  }, [scopedInventory]);

  // Geo bounds for SVG Map
  // Lat: 29.2 to 30.2
  // Lon: 76.5 to 77.2
  const minLat = 29.15;
  const maxLat = 30.25;
  const minLon = 76.50;
  const maxLon = 77.25;

  const getSvgCoordinates = (lat: number, lon: number) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 480 + 30;
    const y = 320 - ((lat - minLat) / (maxLat - minLat)) * 260;
    return { x, y };
  };

  const medicineList = [
    'All 8 Medicines',
    'Paracetamol',
    'Amoxicillin',
    'ORS Packets',
    'Zinc Sulfate',
    'Cetirizine',
    'Metformin',
    'Azithromycin',
    'Rabies Vaccine',
  ];

  return (
    <div className="space-y-5">
      {/* Alert Banner for Critical Deficits */}
      {criticalItems.length > 0 && (
        <div className="bg-red-50 border-l-4 border-[#B91C1C] border-t border-r border-b border-red-200 rounded p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#B91C1C] text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>
              Critical Deficit Warning ({criticalItems.length} Batches at Imminent Stockout)
            </span>
          </div>
          <div className="text-slate-700 mt-1 leading-relaxed">
            Emergency regional replenishment required for centers with breached 4-day threshold:{' '}
            <strong>
              {Array.from(new Set(criticalItems.map((c) => c.facility_name)))
                .slice(0, 5)
                .join(', ')}
            </strong>
            .
          </div>
        </div>
      )}

      {/* Phase 5: High-Priority Action Drawer */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>High-Priority Action Drawer</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#B91C1C] border border-red-300">
                {actionDrawerItems.length} Urgent Mandates
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Surveillance queue prioritizing imminent stockouts (&le;48 hrs), ghost inventory, and expiring surplus
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            District Clinical Triage
          </div>
        </div>

        {actionDrawerItems.length === 0 ? (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-[#15803D] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All monitored facilities secure — No critical stockouts, ghost stock discrepancies, or expiring surplus detected.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionDrawerItems.slice(0, 6).map((item) => {
              const actionKey = `${item.facility_id}::${item.medicine_name}`;
              const isDispatched = Boolean(dispatchedActions[actionKey]);

              let badgeBg = 'bg-red-50 text-[#B91C1C] border-red-200';
              let borderAccent = 'border-l-4 border-l-[#B91C1C]';
              let badgeLabel = `[${item.action_priority}]`;
              let btnLabel = 'Dispatch Emergency Buffer';

              if (item.action_priority === 'GHOST STOCK AUDIT REQUIRED') {
                badgeBg = 'bg-red-50 text-[#B91C1C] border-red-200';
                borderAccent = 'border-l-4 border-l-[#B91C1C]';
                btnLabel = 'Initiate Ground Audit';
              } else if (item.action_priority === 'EXPIRING SURPLUS') {
                badgeBg = 'bg-amber-50 text-[#B45309] border-amber-200';
                borderAccent = 'border-l-4 border-l-[#B45309]';
                btnLabel = 'Authorize FEFO Transfer';
              }

              const handleAction = () => {
                setDispatchedActions((prev) => ({
                  ...prev,
                  [actionKey]: 'DISPATCHED',
                }));
                if (item.action_priority === 'GHOST STOCK AUDIT REQUIRED' && onInitiateAudit) {
                  onInitiateAudit(item.facility_id, item.medicine_name);
                } else if (onDispatchAction) {
                  onDispatchAction(item.facility_id, item.medicine_name, item.action_priority);
                }
              };

              return (
                <div
                  key={actionKey + item.batch_id}
                  className={`bg-white border border-slate-200 ${borderAccent} rounded-md p-3 shadow-xs flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">
                          {item.facility_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.district} • {item.facility_type}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider whitespace-nowrap border ${badgeBg}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-sky-800 mb-1">
                      {item.medicine_name}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({item.batch_id})
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded border border-slate-100 mb-3">
                      {item.action_priority === 'CRITICAL DEFICIT' && (
                        <>
                          <div className="flex justify-between">
                            <span>Current On-Hand:</span>
                            <strong className="text-slate-900 font-mono">{item.current_stock_units} units</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Daily Burn Rate:</span>
                            <span className="font-mono text-slate-700">{item.projected_daily_demand} u/day</span>
                          </div>
                          <div className="flex justify-between text-[#B91C1C] font-semibold">
                            <span>SVI Remaining:</span>
                            <span className="font-mono">{item.days_left} Days (&le;48h Stockout)</span>
                          </div>
                        </>
                      )}

                      {item.action_priority === 'GHOST STOCK AUDIT REQUIRED' && (
                        <>
                          <div className="flex justify-between">
                            <span>Portal Registry:</span>
                            <strong className="text-slate-900 font-mono">{item.current_stock_units} units</strong>
                          </div>
                          <div className="flex justify-between text-[#B91C1C]">
                            <span>ASHA Field Count:</span>
                            <strong>0 units (Shortage)</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Discrepancy Margin:</span>
                            <span className="font-mono text-slate-800">{item.discrepancy_margin} units</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[10px]">
                            <span>Facility Integrity:</span>
                            <span className="font-mono font-bold">{item.facility_integrity_score}%</span>
                          </div>
                        </>
                      )}

                      {item.action_priority === 'EXPIRING SURPLUS' && (
                        <>
                          <div className="flex justify-between">
                            <span>Days to Expiry:</span>
                            <strong className="text-[#B45309] font-mono">{item.days_to_expiry} days</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Stock vs 7d Burn:</span>
                            <span className="font-mono text-slate-800">{item.current_stock_units} &gt; {item.projected_7d_demand}</span>
                          </div>
                          <div className="flex justify-between text-[#B45309] font-semibold">
                            <span>Value at Risk:</span>
                            <span className="font-mono">₹{item.expiry_risk_value_inr.toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    {isDispatched ? (
                      <div className="w-full py-1.5 px-2 bg-emerald-50 border border-emerald-200 rounded text-center text-[11px] font-bold text-[#15803D] flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Action Mandate Dispatched</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAction}
                        className={`w-full py-1.5 px-2.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1 text-white ${
                          item.action_priority === 'EXPIRING SURPLUS'
                            ? 'bg-[#B45309] hover:bg-amber-800'
                            : 'bg-[#B91C1C] hover:bg-red-800'
                        }`}
                      >
                        <span>{btnLabel}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Phase 7: Gemini Clinical Intelligence Action Strip */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-700" />
              <span>Gemini 2.5 Clinical Explainability</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Correlate current stockouts with epidemiological triggers, weather shocks, and facility lead times.
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              setIsBriefLoading(true);
              try {
                const meds = actionDrawerItems.slice(0, 4).map((i) => `${i.medicine_name} at ${i.facility_name}`).join(', ');
                const res = await generateClinicalBrief('Surveillance Queue Triage', selectedDistrict, meds);
                setClinicalBrief(res);
              } finally {
                setIsBriefLoading(false);
              }
            }}
            disabled={isBriefLoading}
            className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{isBriefLoading ? 'Synthesizing Telemetry...' : 'Ask Gemini: Generate Executive Clinical Brief'}</span>
          </button>
        </div>

        {/* Render Generated Clinical Brief */}
        {clinicalBrief && (
          <div className="mt-3 p-4 bg-[#0F172A] text-slate-100 rounded-lg border border-slate-800 shadow-sm text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  Executive Clinical Brief — {selectedDistrict}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  clinicalBrief.isLive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-sky-950 text-sky-300 border border-sky-800'
                }`}>
                  {clinicalBrief.isLive ? 'LIVE GEMINI 2.5 FLASH' : 'CLINICAL INTELLIGENCE ENGINE'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(clinicalBrief.brief.full_text);
                  setCopiedBrief(true);
                  setTimeout(() => setCopiedBrief(false), 2500);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                {copiedBrief ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedBrief ? 'Copied to Clipboard' : 'Copy Brief for Ministry Escalation'}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  1. Root Cause Assessment (Epidemiological Correlation)
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {clinicalBrief.brief.root_cause}
                </p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                  2. Operational Impact (Facility Stockout Horizon)
                </div>
                <p className="text-red-200/90 leading-relaxed text-[11px]">
                  {clinicalBrief.brief.operational_impact}
                </p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  3. Prescriptive Validation (Rebalancing & Requisition)
                </div>
                <p className="text-emerald-200/90 leading-relaxed text-[11px]">
                  {clinicalBrief.brief.prescriptive_validation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Filter Metric Strip (Medicine Selector) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quick Filter Metric Strip
            </div>
            <div className="text-[11px] text-slate-500">
              Select specific medication to isolate operational risk distributions across centers
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Active Scope: <strong className="text-slate-800">{selectedDistrict}</strong> • Tier: <strong className="text-slate-800">{selectedFacilityType}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {medicineList.map((med) => {
            const isSelected = selectedQuickMed === med;
            return (
              <button
                key={med}
                type="button"
                onClick={() => setSelectedQuickMed(med)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {med}
              </button>
            );
          })}
        </div>
      </div>

      {/* Geospatial Map + Risk Distribution Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Geospatial Facility Map (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-700" />
                <span>Geospatial Primary Care Risk Map (Haryana Pilot Cluster)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pin colors indicate real-time stock status for {selectedQuickMed}
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
              {filteredFacilities.length} Monitored Facilities
            </span>
          </div>

          {/* Interactive SVG Map */}
          <div className="relative bg-slate-50 border border-slate-200 rounded-md p-2 flex-1 min-h-[300px] overflow-hidden">
            <svg
              viewBox="0 0 540 340"
              className="w-full h-full select-none"
              style={{ maxHeight: '340px' }}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="540" height="340" fill="url(#grid)" />

              {/* District boundary zones */}
              <path
                d="M 40,40 Q 180,30 320,60 T 480,80 L 490,180 L 330,220 L 60,180 Z"
                fill="#F0F9FF"
                fillOpacity="0.4"
                stroke="#BAE6FD"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <path
                d="M 60,180 Q 240,190 400,210 L 420,310 L 120,320 Z"
                fill="#FEF3C7"
                fillOpacity="0.25"
                stroke="#FDE68A"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Zone labels */}
              <text x="70" y="70" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="1">
                KURUKSHETRA DISTRICT
              </text>
              <text x="210" y="170" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="1">
                KARNAL CATCHMENT
              </text>
              <text x="140" y="290" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="1">
                PANIPAT DISTRICT
              </text>

              {/* Facility Markers */}
              {facilityRiskMetrics.map((fac) => {
                const { x, y } = getSvgCoordinates(fac.latitude, fac.longitude);
                const isCritical = fac.riskStatus === 'Critical Stockout (<4d)';
                const isLow = fac.riskStatus === 'Low Stock (4-14d)';
                const pinColor = isCritical ? '#B91C1C' : isLow ? '#B45309' : '#15803D';
                const isSelected = selectedMapFacilityId === fac.facility_id;

                return (
                  <g
                    key={fac.facility_id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredFacility(fac)}
                    onMouseLeave={() => setHoveredFacility(null)}
                    onClick={() => {
                      setSelectedMapFacilityId(fac.facility_id);
                      setSearchTerm(fac.facility_name);
                    }}
                  >
                    {/* Ripple on critical */}
                    {isCritical && (
                      <circle
                        r="12"
                        fill="#B91C1C"
                        fillOpacity="0.25"
                        className="animate-ping"
                      />
                    )}
                    {isSelected && (
                      <circle
                        r="11"
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2.5"
                      />
                    )}
                    {/* Pin body */}
                    <circle
                      r="6.5"
                      fill={pinColor}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-transform group-hover:scale-125"
                    />
                    {/* Facility label */}
                    <text
                      y="14"
                      textAnchor="middle"
                      fill="#1E293B"
                      fontSize="9.5"
                      fontWeight="600"
                      className="pointer-events-none drop-shadow-xs"
                    >
                      {fac.facility_name.replace('PHC ', '').replace('CHC ', '')}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredFacility && (
              <div
                className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded p-3 text-xs shadow-md z-20 w-64 pointer-events-none"
              >
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex justify-between items-center">
                  <span>{hoveredFacility.facility_name}</span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600">
                    {hoveredFacility.facility_type}
                  </span>
                </div>
                <div className="space-y-1 mt-1.5 text-slate-600 text-[11px]">
                  <div className="flex justify-between">
                    <span>District:</span>
                    <strong className="text-slate-800">{hoveredFacility.district}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily OPD Volume:</span>
                    <strong className="text-slate-800">{hoveredFacility.dailyOpd} patients/day</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Stock Status:</span>
                    <strong
                      className={
                        hoveredFacility.riskStatus.includes('Critical')
                          ? 'text-[#B91C1C]'
                          : hoveredFacility.riskStatus.includes('Low')
                          ? 'text-[#B45309]'
                          : 'text-[#15803D]'
                      }
                    >
                      {hoveredFacility.riskStatus}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Top Deficit Item:</span>
                    <strong className="text-[#B91C1C]">{hoveredFacility.topDeficitMedicine}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Days Supply:</span>
                    <strong className="font-mono">{hoveredFacility.minDoi} days</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-3 border-t border-slate-100 mt-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#15803D]" />
                <span>Adequate (&gt;14d)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#B45309]" />
                <span>Low Stock (4-14d)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#B91C1C]" />
                <span>Critical Stockout (&le;4d)</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Click any pin to inspect specific batch records
            </div>
          </div>
        </div>

        {/* Facility Risk Distribution Bar Chart (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Facility Vulnerability Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Risk classification across {filteredFacilities.length} public centers
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {selectedQuickMed}
              </span>
            </div>

            <div className="h-60 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskCounts} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="count" name="Centers" radius={[4, 4, 0, 0]}>
                    {riskCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1 mt-4">
            <div className="font-semibold text-slate-800">Operational Priority Directive</div>
            <div className="text-slate-600 leading-relaxed text-[11px]">
              Centers identified under <strong>Critical (&le;4d)</strong> are eligible for immediate FEFO inter-facility rebalancing from secondary CHC depots without awaiting quarterly state tender release.
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card: Facility Inventory Status Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Facility Inventory Status Matrix (Vectorized Batch Ledger)
            </h3>
            <p className="text-xs text-slate-500">
              Showing {displayedInventory.length} active batches across {filteredFacilities.length} public health centers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search facility, medicine, batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-600 w-56"
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedMapFacilityId(null);
                }}
                className="text-xs text-sky-700 hover:text-sky-900 underline font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Tabular View */}
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Facility</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Essential Medicine</th>
                <th className="py-2.5 px-3 text-right">Stock (Units)</th>
                <th className="py-2.5 px-3 text-right">Daily Burn</th>
                <th className="py-2.5 px-3 text-right">Days of Supply (DOI)</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {displayedInventory.map((item) => (
                <tr key={item.batch_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div>{item.facility_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{item.facility_id}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{item.district}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {item.facility_id.startsWith('PHC_002') || item.facility_id.startsWith('PHC_003') || item.facility_id.startsWith('PHC_006') || item.facility_id.startsWith('PHC_007') || item.facility_id.startsWith('PHC_011') || item.facility_id.startsWith('PHC_012') ? 'CHC' : 'PHC'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div>{item.medicine_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Batch: {item.batch_id}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {item.current_stock_units.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {item.daily_avg_consumption} /day
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span
                      className={
                        (item.days_of_stock || 0) <= 4
                          ? 'text-[#B91C1C]'
                          : (item.days_of_stock || 0) <= 14
                          ? 'text-[#B45309]'
                          : 'text-[#15803D]'
                      }
                    >
                      {item.days_of_stock}d
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono text-slate-700">{item.expiry_date}</div>
                    {item.is_near_expiry && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-[#B45309] border border-amber-300">
                        &lt;30d Expiry
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {(item.days_of_stock || 0) <= 4 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-[#B91C1C] border border-red-300">
                        Critical Deficit
                      </span>
                    ) : (item.days_of_stock || 0) <= 14 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-[#B45309] border border-amber-300">
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-[#15803D] border border-emerald-300">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedInventory.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    No medicine records matched the specified filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
