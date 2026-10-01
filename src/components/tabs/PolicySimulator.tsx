import React, { useState, useMemo } from 'react';
import {
  Sliders,
  ShieldAlert,
  BarChart2,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Building2,
  TrendingDown,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { generatePolicyMemoWithGemini, PolicyMemo } from '../../services/geminiService';

interface PolicySimulatorProps {
  surgeFactor: number;
  onChangeSurgeFactor: (val: number) => void;
  delayDays: number;
  onChangeDelayDays: (val: number) => void;
  apiKey?: string;
}

const CLUSTERS = [
  { id: 'all', name: 'All Districts & Facilities (Statewide Shock)' },
  { id: 'gharaunda', name: 'Gharaunda Rural Outbreak Cluster (CHC Gharaunda, Taraori)' },
  { id: 'indri', name: 'Indri Riverine Belt (CHC Indri)' },
  { id: 'karnal_urban', name: 'Karnal Urban & Semi-Urban (PHC Nissing, PHC Nilokheri)' },
  { id: 'kurukshetra_agro', name: 'Kurukshetra Agro Belt (CHC Pehowa, CHC Shahbad, Ladwa)' },
  { id: 'kurukshetra_rural', name: 'Kurukshetra Rural Cluster (Thanesar, Babain)' },
  { id: 'panipat_ind', name: 'Panipat Industrial Corridor (CHC Samalkha, CHC Israna)' },
  { id: 'panipat_river', name: 'Panipat Riverine Belt (Madlauda, Bapoli, Sanauli Khurd)' },
];

const MONITORED_MEDS = [
  { name: 'ORS Packets', baseDemand: 1840, isOutbreak: true, unitCost: 4.2 },
  { name: 'Paracetamol', baseDemand: 3420, isOutbreak: true, unitCost: 0.45 },
  { name: 'Amoxicillin', baseDemand: 1250, isOutbreak: true, unitCost: 2.8 },
  { name: 'Zinc Sulfate', baseDemand: 1560, isOutbreak: true, unitCost: 0.85 },
  { name: 'Azithromycin', baseDemand: 740, isOutbreak: true, unitCost: 8.5 },
  { name: 'Cetirizine', baseDemand: 980, isOutbreak: false, unitCost: 0.6 },
  { name: 'Metformin', baseDemand: 2200, isOutbreak: false, unitCost: 1.1 },
  { name: 'Rabies Vaccine', baseDemand: 110, isOutbreak: false, unitCost: 340.0 },
];

const FACILITIES_LIST = [
  { id: 'PHC_002', name: 'PHC Gharaunda', district: 'Karnal', baseStock: 120, baselineDOI: 1.8 },
  { id: 'PHC_003', name: 'PHC Indri', district: 'Karnal', baseStock: 140, baselineDOI: 2.1 },
  { id: 'PHC_005', name: 'PHC Taraori', district: 'Karnal', baseStock: 180, baselineDOI: 2.8 },
  { id: 'PHC_008', name: 'PHC Ladwa', district: 'Kurukshetra', baseStock: 210, baselineDOI: 3.2 },
  { id: 'PHC_013', name: 'PHC Madlauda', district: 'Panipat', baseStock: 230, baselineDOI: 3.5 },
  { id: 'PHC_014', name: 'PHC Bapoli', district: 'Panipat', baseStock: 260, baselineDOI: 3.9 },
  { id: 'PHC_001', name: 'PHC Nissing', district: 'Karnal', baseStock: 340, baselineDOI: 5.2 },
  { id: 'PHC_009', name: 'PHC Thanesar Rural', district: 'Kurukshetra', baseStock: 380, baselineDOI: 5.8 },
  { id: 'PHC_010', name: 'PHC Babain', district: 'Kurukshetra', baseStock: 410, baselineDOI: 6.2 },
  { id: 'PHC_015', name: 'PHC Sanauli Khurd', district: 'Panipat', baseStock: 430, baselineDOI: 6.5 },
  { id: 'PHC_004', name: 'PHC Nilokheri', district: 'Karnal', baseStock: 490, baselineDOI: 7.4 },
  { id: 'PHC_006', name: 'CHC Pehowa', district: 'Kurukshetra', baseStock: 820, baselineDOI: 12.4 },
  { id: 'PHC_007', name: 'CHC Shahbad', district: 'Kurukshetra', baseStock: 950, baselineDOI: 14.1 },
  { id: 'PHC_011', name: 'CHC Samalkha', district: 'Panipat', baseStock: 1100, baselineDOI: 16.5 },
  { id: 'PHC_012', name: 'CHC Israna', district: 'Panipat', baseStock: 890, baselineDOI: 13.2 },
];

export const PolicySimulator: React.FC<PolicySimulatorProps> = ({
  surgeFactor,
  onChangeSurgeFactor,
  delayDays,
  onChangeDelayDays,
  apiKey = '',
}) => {
  const [selectedCluster, setSelectedCluster] = useState<string>('all');
  const [medicineScope, setMedicineScope] = useState<'outbreak' | 'all'>('outbreak');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationTimestamp, setSimulationTimestamp] = useState<string | null>(null);

  // Gemini Memo State
  const [isMemoLoading, setIsMemoLoading] = useState(false);
  const [policyMemo, setPolicyMemo] = useState<{
    memo: PolicyMemo;
    isLive: boolean;
    message: string;
  } | null>(null);
  const [copiedMemo, setCopiedMemo] = useState(false);

  // Active surge multiplier applied to calculations
  const surgeMultiplier = surgeFactor / 100;

  // Compute transient simulated metrics dynamically
  const simulationMetrics = useMemo(() => {
    const totalFacilities = FACILITIES_LIST.length;
    const baseCriticalCount = 3;

    // Simulated critical facilities count (<4d DOI under stress)
    const shockMultiplier = 1 + surgeMultiplier * 1.4 + (delayDays / 21) * 0.8;
    const simulatedCriticalCount = Math.min(
      totalFacilities,
      Math.max(baseCriticalCount, Math.round(baseCriticalCount * shockMultiplier))
    );
    const criticalDelta = simulatedCriticalCount - baseCriticalCount;

    // DOI Horizon Shift
    const baselineDOI = 6.4;
    const simulatedDOI = Math.max(
      1.2,
      Number((baselineDOI / (1 + surgeMultiplier * 1.5 + delayDays * 0.08)).toFixed(1))
    );
    const doiDelta = Number((simulatedDOI - baselineDOI).toFixed(1));

    // Deficit Volume & Budget
    const baseDemandSum = MONITORED_MEDS.reduce((acc, m) => acc + m.baseDemand, 0);
    const surgeUnits = Math.round(baseDemandSum * surgeMultiplier * (1 + delayDays / 15));
    const intraAbsorbable = Math.round(surgeUnits * 0.28);
    const emergencyDeficitUnits = Math.max(0, surgeUnits - intraAbsorbable);
    const avgCostPerUnit = 28.5;
    const emergencyBudgetInr = Math.round(emergencyDeficitUnits * avgCostPerUnit);

    // Network Resilience & Fragility
    const fragilityIndex = Math.min(100, Math.round((simulatedCriticalCount / totalFacilities) * 100));
    const resilienceScore = Math.max(0, 100 - fragilityIndex);
    const baselineResilience = 85;

    // Medicine Demand Comparison
    const medComparison = MONITORED_MEDS.map((med) => {
      const isTargeted = medicineScope === 'all' || med.isOutbreak;
      const mult = isTargeted ? 1 + surgeMultiplier : 1.0;
      const simDemand = Math.round(med.baseDemand * mult);
      return {
        name: med.name,
        baseDemand: med.baseDemand,
        simDemand,
        unitCost: med.unitCost,
        isTargeted,
      };
    });

    // Facility Day-by-Day (t+1 to t+7) Cascade Heatmap Matrix
    const cascadeMatrix = FACILITIES_LIST.map((fac) => {
      // Determine day status (0=Secure, 1=Breach, 2=Zero Stock)
      const dailyBurn = (fac.baseStock / fac.baselineDOI) * (1 + surgeMultiplier * 1.3);
      let running = fac.baseStock;
      const days = [0, 0, 0, 0, 0, 0, 0];
      let zeroStockDay: number | null = null;

      for (let d = 0; d < 7; d++) {
        running -= dailyBurn;
        if (running <= 0) {
          days[d] = 2; // Zero-stock
          if (zeroStockDay === null) zeroStockDay = d + 1;
        } else if (running < fac.baseStock * 0.35) {
          days[d] = 1; // Safety threshold breach
        } else {
          days[d] = 0; // Secure
        }
      }

      return {
        facility_id: fac.id,
        facility_name: fac.name,
        district: fac.district,
        baseStock: fac.baseStock,
        zeroStockDay,
        days,
      };
    }).sort((a, b) => {
      if (a.zeroStockDay !== null && b.zeroStockDay !== null) {
        return a.zeroStockDay - b.zeroStockDay;
      }
      if (a.zeroStockDay !== null) return -1;
      if (b.zeroStockDay !== null) return 1;
      return a.facility_name.localeCompare(b.facility_name);
    });

    return {
      totalFacilities,
      baseCriticalCount,
      simulatedCriticalCount,
      criticalDelta,
      baselineDOI,
      simulatedDOI,
      doiDelta,
      emergencyDeficitUnits,
      emergencyBudgetInr,
      intraAbsorbable,
      fragilityIndex,
      resilienceScore,
      baselineResilience,
      medComparison,
      cascadeMatrix,
    };
  }, [surgeMultiplier, delayDays, medicineScope]);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setSimulationTimestamp(new Date().toLocaleTimeString());
    }, 250);
  };

  const handleResetToBaseline = () => {
    onChangeSurgeFactor(0);
    onChangeDelayDays(0);
    setSelectedCluster('all');
    setMedicineScope('outbreak');
    setPolicyMemo(null);
  };

  const handleGenerateMemo = async () => {
    setIsMemoLoading(true);
    try {
      const clusterObj = CLUSTERS.find((c) => c.id === selectedCluster);
      const res = await generatePolicyMemoWithGemini(
        {
          surgePct: surgeFactor,
          delayDays: delayDays,
          critBase: simulationMetrics.baseCriticalCount,
          critSim: simulationMetrics.simulatedCriticalCount,
          doiBase: simulationMetrics.baselineDOI,
          doiSim: simulationMetrics.simulatedDOI,
          defUnits: simulationMetrics.emergencyDeficitUnits,
          defInr: simulationMetrics.emergencyBudgetInr,
          absorbUnits: simulationMetrics.intraAbsorbable,
          fragility: simulationMetrics.fragilityIndex,
          resilience: simulationMetrics.resilienceScore,
          clusters: [clusterObj?.name || 'All Districts'],
        },
        apiKey
      );
      setPolicyMemo(res);
    } finally {
      setIsMemoLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-sky-50 border-l-4 border-sky-700 border-t border-r border-b border-sky-200 rounded p-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-bold text-sky-900 text-sm">
              <Sliders className="w-4 h-4 text-sky-700" />
              <span>Phase 8: What-If Policy & Epidemic Shock Simulator</span>
            </div>
            <div className="text-slate-700 mt-1 leading-relaxed">
              Reactive multi-horizon simulation sandbox evaluating epidemic demand spikes, replenishment lag shocks, and facility vulnerability cascades without altering baseline records.
            </div>
          </div>
          <span className="self-start sm:self-center px-2.5 py-1 bg-white border border-sky-300 rounded text-[11px] font-mono font-bold text-sky-900 shadow-xs">
            NHM RESILIENCE STANDARD V8.2
          </span>
        </div>
      </div>

      {/* 1. Simulation Control Panel (Top Card) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Dynamic Shock Injection & Stress-Test Controls
            </h3>
            <p className="text-[11px] text-slate-500">
              Isolate and stress-test target formulary categories, regional clusters, and transit lead-time delays
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToBaseline}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Baseline</span>
            </button>
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 px-3.5 py-1.5 rounded transition-colors shadow-xs disabled:opacity-50"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>{isSimulating ? 'Recalculating...' : 'Run Stress-Test Simulation'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
          {/* Slider 1: Epidemic Surge */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">
                Epidemic Demand Surge Multiplier
              </label>
              <span className="font-mono font-bold text-[#B91C1C] px-2 py-0.5 bg-red-50 rounded border border-red-200">
                +{surgeFactor}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="10"
              value={surgeFactor}
              onChange={(e) => onChangeSurgeFactor(Number(e.target.value))}
              className="w-full accent-red-700 cursor-pointer h-1.5 bg-slate-200 rounded"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>+0% (Baseline)</span>
              <span>+50% (Surge)</span>
              <span>+150% (Epidemic)</span>
            </div>
          </div>

          {/* Slider 2: Supply Delay */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">
                Central Depot Lead-Time Shock
              </label>
              <span className="font-mono font-bold text-sky-800 px-2 py-0.5 bg-sky-50 rounded border border-sky-200">
                +{delayDays} Days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="21"
              step="1"
              value={delayDays}
              onChange={(e) => onChangeDelayDays(Number(e.target.value))}
              className="w-full accent-sky-700 cursor-pointer h-1.5 bg-slate-200 rounded"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0d (Normal)</span>
              <span>7d (Transit Lag)</span>
              <span>21d (Blockade)</span>
            </div>
          </div>

          {/* Controls: Cluster & Scope */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Regional Epidemic Cluster
              </label>
              <select
                value={selectedCluster}
                onChange={(e) => setSelectedCluster(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-700"
              >
                {CLUSTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Formulary Stress Scope
              </label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="medScope"
                    checked={medicineScope === 'outbreak'}
                    onChange={() => setMedicineScope('outbreak')}
                    className="text-sky-700 cursor-pointer"
                  />
                  <span>Outbreak Formulary</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="medScope"
                    checked={medicineScope === 'all'}
                    onChange={() => setMedicineScope('all')}
                    className="text-sky-700 cursor-pointer"
                  />
                  <span>All 8 Monitored Medicines</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Comparative Impact Dashboard (Delta KPI Cards) */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          2. Comparative Resilience & Fragility Impact Dashboard
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Critical Facilities */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500">
              Critical Facilities at Risk
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-[#DC2626]">
                {simulationMetrics.simulatedCriticalCount}
              </span>
              <span className="text-xs text-slate-500">
                / {simulationMetrics.totalFacilities} Total
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
              <span>Baseline: <b>{simulationMetrics.baseCriticalCount}</b></span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                +{simulationMetrics.criticalDelta} (+{Math.round((simulationMetrics.criticalDelta / simulationMetrics.baseCriticalCount) * 100)}%)
              </span>
            </div>
          </div>

          {/* KPI 2: Stockout Horizon */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500">
              Expected Stockout Horizon
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-[#B45309]">
                {simulationMetrics.simulatedDOI}d
              </span>
              <span className="text-xs text-slate-500">Mean Remaining</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
              <span>Baseline: <b>{simulationMetrics.baselineDOI}d</b></span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {simulationMetrics.doiDelta}d Compression
              </span>
            </div>
          </div>

          {/* KPI 3: Deficit Volume */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500">
              Emergency Deficit Volume
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {simulationMetrics.emergencyDeficitUnits.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">Units Net</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Req: <b className="text-sky-700">₹{simulationMetrics.emergencyBudgetInr.toLocaleString()}</b></span>
              <span className="text-emerald-700 font-semibold">{simulationMetrics.intraAbsorbable.toLocaleString()} u Absorbed</span>
            </div>
          </div>

          {/* KPI 4: Resilience Score */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500">
              Network Resilience Score
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-bold font-mono ${
                  simulationMetrics.resilienceScore >= 70 ? 'text-emerald-600' : 'text-[#DC2626]'
                }`}
              >
                {simulationMetrics.resilienceScore}%
              </span>
              <span className="text-xs text-slate-500">
                ({simulationMetrics.fragilityIndex}% Fragility)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
              <span>Baseline: <b>{simulationMetrics.baselineResilience}%</b></span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  simulationMetrics.fragilityIndex >= 50
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {simulationMetrics.resilienceScore - simulationMetrics.baselineResilience}% Shift
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Dual-Bar Sensitivity Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-sky-700" />
              <span>Baseline vs Surge Demand Sensitivity</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">7-Day Horizon</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {simulationMetrics.medComparison.map((m) => {
              const maxDemand = 5000;
              const baseWidth = Math.min(100, Math.round((m.baseDemand / maxDemand) * 100));
              const simWidth = Math.min(100, Math.round((m.simDemand / maxDemand) * 100));

              return (
                <div key={m.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{m.name}</span>
                    <span className="font-mono text-[11px]">
                      <span className="text-sky-700">{m.baseDemand.toLocaleString()}</span>
                      <span className="text-slate-400"> → </span>
                      <span className="text-red-700 font-bold">{m.simDemand.toLocaleString()} u</span>
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {/* Baseline Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${baseWidth}%` }}
                      />
                    </div>
                    {/* Surge Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-red-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${simWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-sky-600 inline-block" />
                <span>Baseline 7d Demand</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
                <span>Simulated Surge (+{surgeFactor}%)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Vulnerability Cascade Matrix Heatmap */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Facility Vulnerability Cascade Matrix (t+1 to t+7)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Ordered by Earliest Depletion
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-100">
                  <th className="text-left py-1 px-2 font-semibold">Facility</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 1</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 2</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 3</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 4</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 5</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 6</th>
                  <th className="text-center py-1 px-1 font-semibold">Day 7</th>
                  <th className="text-right py-1 px-2 font-semibold">Depletion Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {simulationMetrics.cascadeMatrix.map((row) => (
                  <tr key={row.facility_id} className="hover:bg-slate-50">
                    <td className="py-1 px-2 font-sans font-medium text-slate-900 whitespace-nowrap">
                      {row.facility_name}
                      <span className="text-[10px] text-slate-400 ml-1">({row.district})</span>
                    </td>
                    {row.days.map((status, dIdx) => (
                      <td key={dIdx} className="py-1 px-1 text-center">
                        <span
                          className={`inline-block w-4 h-4 rounded text-[9px] font-bold leading-4 ${
                            status === 2
                              ? 'bg-red-600 text-white'
                              : status === 1
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {status === 2 ? '0' : status === 1 ? '!' : '✓'}
                        </span>
                      </td>
                    ))}
                    <td className="py-1 px-2 text-right whitespace-nowrap">
                      {row.zeroStockDay ? (
                        <span className="text-red-700 font-bold">
                          Day {row.zeroStockDay} ({row.zeroStockDay <= 2 ? '<48h' : '<96h'})
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">No Stockout</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span>Secure (&gt;Safety)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                <span>Safety Breach</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
                <span>Zero-Stock Event</span>
              </span>
            </div>
            <div className="font-sans text-slate-700">
              Intra-district CHC absorption: <b>{simulationMetrics.intraAbsorbable.toLocaleString()} units</b>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Gemini Policy Advisory Integration */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-700" />
              <span>4. Executive Policy Action Memo (Powered by Gemini 2.5 Flash)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Transmit simulated stress-test delta telemetry to Gemini 2.5 Flash to draft an administrative directive
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateMemo}
            disabled={isMemoLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 px-3.5 py-1.5 rounded transition-colors shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {isMemoLoading ? 'Drafting Policy Memo...' : 'Generate Policy Action Memo for Health Ministry'}
            </span>
          </button>
        </div>

        {policyMemo && (
          <div className="bg-[#0F172A] text-slate-100 rounded-lg p-4 border border-slate-800 text-xs space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  Executive Policy Action Directive — Epidemic Preparedness
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    policyMemo.isLive
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-sky-950 text-sky-300 border border-sky-800'
                  }`}
                >
                  {policyMemo.isLive ? 'LIVE GEMINI 2.5 FLASH' : 'POLICY ADVISORY ENGINE'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(policyMemo.memo.full_text);
                  setCopiedMemo(true);
                  setTimeout(() => setCopiedMemo(false), 2500);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                {copiedMemo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMemo ? 'Copied to Clipboard' : 'Copy Directive for Health Ministry'}</span>
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                  1. Vulnerability Assessment (Localized Health Collapse Risk)
                </div>
                <p className="text-slate-300 text-[11px]">
                  {policyMemo.memo.vulnerability_assessment}
                </p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                  2. Strategic Buffering (Immediate Central Depot Release & Funding)
                </div>
                <p className="text-slate-300 text-[11px]">
                  {policyMemo.memo.strategic_buffering}
                </p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  3. Cross-District Re-Routing Directive (Mutual Aid Logistics)
                </div>
                <p className="text-slate-300 text-[11px]">
                  {policyMemo.memo.cross_district_rerouting}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
