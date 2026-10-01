import React, { useState, useMemo } from 'react';
import {
  Activity,
  CloudRain,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Search,
  ArrowUpDown,
  Droplets,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  HistoricalConsumptionRecord,
  FacilityRecord,
  InventoryRecord,
  DistrictFilterType,
  FacilityTypeFilter,
  DateRangeFilter,
  ForecastSummaryItem,
} from '../../types';
import {
  generateDemandForecast,
  generateAllForecastSummaries,
} from '../../data/relationalDataEngine';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from 'recharts';

interface DemandForecastingProps {
  historicalConsumption: HistoricalConsumptionRecord[];
  facilities: FacilityRecord[];
  inventory: InventoryRecord[];
  selectedDistrict: DistrictFilterType;
  selectedFacilityType?: FacilityTypeFilter;
  selectedDateRange?: DateRangeFilter;
}

export const DemandForecasting: React.FC<DemandForecastingProps> = ({
  historicalConsumption,
  facilities,
  inventory,
  selectedDistrict,
  selectedFacilityType = 'All Types',
  selectedDateRange = 'Past 90 Days',
}) => {
  // Main view navigation: Phase 4 Predictive ML Forecaster vs Phase 3 Exploratory Clinical EDA
  const [mainView, setMainView] = useState<'predictive_ml' | 'clinical_eda'>('predictive_ml');

  // Forecast Selection Bar state
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('PHC_002'); // Default CHC Gharaunda
  const [selectedMedicine, setSelectedMedicine] = useState<string>('ORS Packets');
  const [forecastHorizon, setForecastHorizon] = useState<7 | 14>(7);

  // Global summary table search & filter state
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('All');
  const [tableSortColumn, setTableSortColumn] = useState<'balance' | 'demand' | 'stock' | 'doi'>('balance');
  const [tableSortAsc, setTableSortAsc] = useState<boolean>(true);

  // Clinical EDA Sub-panel tabs
  const [edaSubPanel, setEdaSubPanel] = useState<'doi' | 'weather' | 'elasticity'>('doi');
  const [selectedDoiMed, setSelectedDoiMed] = useState<string>('All Essential Medicines');
  const [isDoiAscending, setIsDoiAscending] = useState<boolean>(true);
  const [selectedWeatherMed, setSelectedWeatherMed] = useState<string>('ORS Packets');
  const [selectedFacilityScope, setSelectedFacilityScope] = useState<string>('District Aggregate');
  const [selectedScatterMeds, setSelectedScatterMeds] = useState<string[]>([
    'ORS Packets',
    'Paracetamol',
    'Amoxicillin',
  ]);

  // Scoped facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      const matchDist = selectedDistrict === 'All Districts' || f.district === selectedDistrict;
      const matchTier =
        selectedFacilityType === 'All Types' || f.facility_type === selectedFacilityType;
      return matchDist && matchTier;
    });
  }, [facilities, selectedDistrict, selectedFacilityType]);

  const validFacilityIds = useMemo(
    () => new Set(filteredFacilities.map((f) => f.facility_id)),
    [filteredFacilities]
  );

  // Scoped inventory
  const scopedInventory = useMemo(() => {
    return inventory.filter((item) => validFacilityIds.has(item.facility_id));
  }, [inventory, validFacilityIds]);

  // Unique lists for selectors
  const availableMedicines = useMemo(() => {
    return Array.from(new Set(historicalConsumption.map((h) => h.medicine_name))).sort();
  }, [historicalConsumption]);

  // Ensure selected facility exists in filtered list or fallback
  const activeFacility = useMemo(() => {
    const found = filteredFacilities.find((f) => f.facility_id === selectedFacilityId);
    return found || filteredFacilities[0] || facilities[0];
  }, [filteredFacilities, selectedFacilityId, facilities]);

  // 1. Core Forecasting Engine Output for Selected (Facility, Medicine, Horizon)
  const forecastResult = useMemo(() => {
    if (!activeFacility) return null;
    return generateDemandForecast(
      historicalConsumption,
      facilities,
      inventory,
      activeFacility.facility_id,
      selectedMedicine,
      forecastHorizon
    );
  }, [historicalConsumption, facilities, inventory, activeFacility, selectedMedicine, forecastHorizon]);

  // 2. Global District-Wide Forecast Summary Matrix across all facilities
  const allForecastSummaries = useMemo(() => {
    return generateAllForecastSummaries(historicalConsumption, filteredFacilities, scopedInventory);
  }, [historicalConsumption, filteredFacilities, scopedInventory]);

  // Filtered & Sorted Summary Table Data
  const filteredSummaries = useMemo(() => {
    let list = allForecastSummaries;

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.facility_name.toLowerCase().includes(q) ||
          item.medicine_name.toLowerCase().includes(q) ||
          item.district.toLowerCase().includes(q)
      );
    }

    if (tableStatusFilter !== 'All') {
      list = list.filter((item) => item.depletion_status === tableStatusFilter);
    }

    return [...list].sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (tableSortColumn === 'balance') {
        valA = a.projected_balance;
        valB = b.projected_balance;
      } else if (tableSortColumn === 'demand') {
        valA = a.projected_7d_demand;
        valB = b.projected_7d_demand;
      } else if (tableSortColumn === 'stock') {
        valA = a.current_stock;
        valB = b.current_stock;
      } else if (tableSortColumn === 'doi') {
        valA = a.projected_doi;
        valB = b.projected_doi;
      }
      return tableSortAsc ? valA - valB : valB - valA;
    });
  }, [allForecastSummaries, tableSearch, tableStatusFilter, tableSortColumn, tableSortAsc]);

  // Counts for quick KPI badges
  const deficitCount = useMemo(
    () => allForecastSummaries.filter((s) => s.depletion_status === 'Deficit Breached').length,
    [allForecastSummaries]
  );
  const imminentCount = useMemo(
    () => allForecastSummaries.filter((s) => s.depletion_status === 'Imminent Deficit (<4d)').length,
    [allForecastSummaries]
  );
  const lowCount = useMemo(
    () => allForecastSummaries.filter((s) => s.depletion_status === 'Low Stock (4-14d)').length,
    [allForecastSummaries]
  );

  // Handler for quick row load into canvas
  const handleLoadInCanvas = (item: ForecastSummaryItem) => {
    setSelectedFacilityId(item.facility_id);
    setSelectedMedicine(item.medicine_name);
    setMainView('predictive_ml');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div id="demand-forecasting-hub" className="space-y-6">
      {/* Top Banner & Phase 4 Architecture Callout */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Phase 4: Multi-Horizon Predictive ML Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">Scikit-Learn Ridge &amp; AR-Exogenous Core</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Clinical Demand Forecasting &amp; Epidemiological Intercept Station
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Projects forward consumption ($t+1$ to $t+14$) using 7-day autoregressive rolling features,
              day-of-week seasonality, and Yamuna River basin precipitation lags (+1d &amp; +3d incubation).
              Visualizes run-out intercepts where projected demand overtakes on-hand buffer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800/80 px-3 py-2 rounded border border-slate-700 text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">District Stockout Risk</div>
              <div className="text-sm font-bold text-amber-400">
                {deficitCount + imminentCount} Formularies at Risk
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-3 mt-4">
          <button
            id="tab-btn-predictive-ml"
            onClick={() => setMainView('predictive_ml')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              mainView === 'predictive_ml'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            1. Predictive ML Forecaster &amp; Projections
          </button>
          <button
            id="tab-btn-clinical-eda"
            onClick={() => setMainView('clinical_eda')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              mainView === 'clinical_eda'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            2. Exploratory Clinical Telemetry (Phase 3 EDA)
          </button>
        </div>
      </div>

      {/* VIEW 1: PREDICTIVE ML DEMAND FORECASTER */}
      {mainView === 'predictive_ml' && (
        <div className="space-y-6">
          {/* 1. FORECAST SELECTION BAR */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 flex-1">
                {/* Facility Selector */}
                <div className="min-w-[240px]">
                  <label htmlFor="forecast-facility-select" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select Target Facility
                  </label>
                  <select
                    id="forecast-facility-select"
                    value={activeFacility?.facility_id}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  >
                    {filteredFacilities.map((f) => (
                      <option key={f.facility_id} value={f.facility_id}>
                        {f.facility_name} ({f.district} • {f.facility_type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Medicine Selector */}
                <div className="min-w-[200px]">
                  <label htmlFor="forecast-medicine-select" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Target Essential Medicine
                  </label>
                  <select
                    id="forecast-medicine-select"
                    value={selectedMedicine}
                    onChange={(e) => setSelectedMedicine(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  >
                    {availableMedicines.map((med) => (
                      <option key={med} value={med}>
                        {med}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-Horizon Toggle */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Forecasting Horizon
                  </span>
                  <div className="flex items-center rounded border border-slate-300 bg-slate-100 p-0.5 text-xs font-medium">
                    <button
                      id="btn-horizon-7d"
                      type="button"
                      onClick={() => setForecastHorizon(7)}
                      className={`px-3 py-1 rounded transition-colors ${
                        forecastHorizon === 7
                          ? 'bg-white text-teal-800 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      7-Day Operational Forecast
                    </button>
                    <button
                      id="btn-horizon-14d"
                      type="button"
                      onClick={() => setForecastHorizon(14)}
                      className={`px-3 py-1 rounded transition-colors ${
                        forecastHorizon === 14
                          ? 'bg-white text-teal-800 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      14-Day Tactical Projection
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Badges on Active Selection */}
              <div className="flex items-center gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">On-Hand Stock</div>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {forecastResult?.driverMetrics.current_stock.toLocaleString() || 0} Units
                  </div>
                </div>
                <div
                  className={`px-3 py-2 rounded border text-right ${
                    forecastResult?.driverMetrics.depletion_day_intercept !== null
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase">Projected Depletion</div>
                  <div className="text-sm font-bold font-mono">
                    {forecastResult?.driverMetrics.depletion_day_intercept !== null
                      ? `Day ${forecastResult?.driverMetrics.depletion_day_intercept} Intercept`
                      : 'No Intercept (>14d)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. VISUAL PROJECTION CANVAS */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Visual Projection Canvas: {activeFacility?.facility_name} — {selectedMedicine}
                </h3>
                <p className="text-xs text-slate-500">
                  Observed historical run-rate (past 30 days) transitioning into multi-horizon forward ML demand with 95% epidemiological uncertainty intervals.
                </p>
              </div>

              {/* Canvas Legend Guide */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-sky-700 font-medium">
                  <span className="w-3 h-0.5 bg-sky-600 inline-block"></span>
                  Solid Blue: Past 30D Actuals
                </span>
                <span className="flex items-center gap-1.5 text-teal-700 font-medium">
                  <span className="w-3 h-0.5 border-t-2 border-dotted border-teal-600 inline-block"></span>
                  Dotted Teal: Next {forecastHorizon}D Predicted Demand
                </span>
                <span className="flex items-center gap-1.5 text-teal-600">
                  <span className="w-3 h-2 bg-teal-500/20 border border-teal-500/40 inline-block rounded-xs"></span>
                  95% Confidence Band (±1.96σ)
                </span>
                <span className="flex items-center gap-1.5 text-red-700 font-medium">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-red-600 inline-block"></span>
                  Flat Red: Stock Level Intercept
                </span>
              </div>
            </div>

            {/* Recharts Canvas */}
            <div className="h-[380px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={forecastResult?.projectionPoints || []}
                  margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="confidenceTealGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={{ stroke: '#CBD5E1' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    interval={Math.ceil((forecastResult?.projectionPoints.length || 37) / 10)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={{ stroke: '#CBD5E1' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    domain={[0, 'auto']}
                    label={{
                      value: 'Daily Units Consumed / Projected',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#64748B', textAnchor: 'middle' },
                      offset: -2,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      const isHist = data.isHistorical;
                      return (
                        <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded shadow-lg text-xs space-y-1.5 min-w-[210px]">
                          <div className="font-bold border-b border-slate-700 pb-1 flex justify-between items-center">
                            <span>{data.date} ({label})</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                isHist ? 'bg-sky-500/20 text-sky-300' : 'bg-teal-500/20 text-teal-300'
                              }`}
                            >
                              {isHist ? 'Historical' : 'ML Forecast'}
                            </span>
                          </div>
                          {isHist ? (
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">Actual Consumption:</span>
                              <span className="font-bold text-sky-400">{data.actualDemand} units</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between font-mono">
                                <span className="text-slate-300">Predicted Demand:</span>
                                <span className="font-bold text-teal-400">{data.predictedDemand} units</span>
                              </div>
                              <div className="flex justify-between font-mono text-[11px]">
                                <span className="text-slate-400">95% Interval:</span>
                                <span className="text-teal-200">
                                  [{data.lowerBound} - {data.upperBound}]
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between font-mono text-[11px] pt-1 border-t border-slate-800 text-slate-300">
                            <span>Facility Stock Level:</span>
                            <span className="font-bold text-red-400">{data.stockLevel} units</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px] text-slate-400">
                            <span>Yamuna Basin Rain:</span>
                            <span>{data.rainfall_mm} mm</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px] text-slate-400">
                            <span>OPD Footfall:</span>
                            <span>{data.outpatient_count} patients</span>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* 95% Confidence Band Area (for forecast period) */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#0D9488"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                    fill="url(#confidenceTealGradient)"
                    name="95% Confidence Interval"
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="#0D9488"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                    fill="#FFFFFF"
                    name="Lower Bound Baseline"
                  />

                  {/* Solid Blue Line: Past 30 Days Actuals */}
                  <Line
                    type="monotone"
                    dataKey="actualDemand"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#0284C7' }}
                    activeDot={{ r: 5, fill: '#0284C7' }}
                    name="Past 30D Actual Consumption"
                    connectNulls={false}
                  />

                  {/* Dotted Teal Line: Next 7 or 14 Days Predicted Demand */}
                  <Line
                    type="monotone"
                    dataKey="predictedDemand"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3.5, fill: '#0D9488' }}
                    activeDot={{ r: 5, fill: '#0D9488' }}
                    name="Projected Forward Demand"
                    connectNulls={false}
                  />

                  {/* Flat Red Dashed Line: Current Stock Level */}
                  {forecastResult?.driverMetrics.current_stock ? (
                    <ReferenceLine
                      y={forecastResult.driverMetrics.current_stock}
                      stroke="#B91C1C"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      label={{
                        value: `Current Stock Level: ${forecastResult.driverMetrics.current_stock} Units`,
                        position: 'top',
                        fill: '#B91C1C',
                        fontSize: 11,
                        fontWeight: 'bold',
                      }}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Run-Out Intercept Callout Box */}
            {forecastResult?.driverMetrics.depletion_day_intercept !== null ? (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <span className="font-bold">Stockout Intercept Detected: </span>
                    Cumulative demand overtakes on-hand stock on{' '}
                    <span className="font-bold font-mono underline">
                      Day {forecastResult?.driverMetrics.depletion_day_intercept}
                    </span>{' '}
                    of the forecast horizon. Stockout occurs before replenishment arrives.
                  </div>
                </div>
                <span className="font-bold px-2 py-1 bg-red-600 text-white rounded text-[10px] uppercase tracking-wider shrink-0">
                  FEFO Transfer Triggered
                </span>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Buffer Safe: </span>
                    Current stock level ({forecastResult?.driverMetrics.current_stock} units) exceeds cumulative{' '}
                    {forecastHorizon}-day projected consumption ({forecastResult?.driverMetrics.expected_horizon_consumption} units).
                  </div>
                </div>
                <span className="font-bold px-2 py-1 bg-emerald-700 text-white rounded text-[10px] uppercase tracking-wider shrink-0">
                  Buffer Surplus
                </span>
              </div>
            )}
          </div>

          {/* 3. FORECAST DRIVER BREAKDOWN (INTERPRETABILITY PANEL) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Forecast Driver Breakdown &amp; Interpretability Panel
                </h3>
                <p className="text-xs text-slate-500">
                  Decomposition of Ridge ML weights into clinical drivers, recent consumption momentum, and seasonal monsoon rainfall.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Feature Importance Weights</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: Baseline Trend Impact */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Baseline Trend Impact</span>
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div
                  className={`text-2xl font-bold font-mono mt-1 ${
                    (forecastResult?.driverMetrics.baseline_trend_pct || 0) >= 0
                      ? 'text-amber-700'
                      : 'text-sky-700'
                  }`}
                >
                  {(forecastResult?.driverMetrics.baseline_trend_pct || 0) >= 0 ? '+' : ''}
                  {forecastResult?.driverMetrics.baseline_trend_pct || 0}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Rolling 7D moving avg vs historical seasonal baseline.
                </div>
              </div>

              {/* Metric 2: Precipitation / Monsoon Surge Weight */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Precipitation Surge Weight</span>
                  <Droplets className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-teal-800 mt-1">
                  +{forecastResult?.driverMetrics.precipitation_surge_pct || 0}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Yamuna basin rainfall lag (+1d &amp; +3d incubation effect).
                </div>
              </div>

              {/* Metric 3: Expected 7-Day Net Consumption */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Expected 7-Day Net Demand</span>
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {forecastResult?.driverMetrics.expected_7d_consumption.toLocaleString() || 0}
                  <span className="text-xs font-normal text-slate-500 ml-1">units</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Projected formulary burn for active facility.
                </div>
              </div>

              {/* Metric 4: Model Confidence & Residual Standard Deviation */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Model Confidence (95% CI)</span>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
                  ±{(forecastResult?.driverMetrics.residual_sigma ? (forecastResult.driverMetrics.residual_sigma * 1.96).toFixed(1) : '6.4')}
                  <span className="text-xs font-normal text-slate-500 ml-1">u/day</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Residual error standard deviation $\sigma={forecastResult?.driverMetrics.residual_sigma}$.
                </div>
              </div>
            </div>
          </div>

          {/* 4. GLOBAL FORECAST SUMMARY TABLE */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  District-Wide Predictive Stockout &amp; Demand Balance Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Full multi-facility cross-tabulation of Current Stock vs Projected 7-Day Consumption ($Stock - Demand = Projected Balance$).
                </p>
              </div>

              {/* Quick Summary Counts */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 font-semibold border border-red-200">
                  {deficitCount} Deficits
                </span>
                <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                  {imminentCount} Imminent (&lt;4d)
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {lowCount} Low Stock
                </span>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="table-search-input"
                  type="text"
                  placeholder="Search facility, medicine, or district..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 w-full sm:w-64 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <label htmlFor="filter-depletion-status" className="font-semibold text-slate-600">Status:</label>
                <select
                  id="filter-depletion-status"
                  value={tableStatusFilter}
                  onChange={(e) => setTableStatusFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="All">All Statuses ({allForecastSummaries.length})</option>
                  <option value="Deficit Breached">Deficit Breached</option>
                  <option value="Imminent Deficit (<4d)">Imminent Deficit (&lt;4d)</option>
                  <option value="Low Stock (4-14d)">Low Stock (4-14d)</option>
                  <option value="Sufficient Coverage (>14d)">Sufficient Coverage (&gt;14d)</option>
                </select>

                <label htmlFor="sort-matrix-column" className="font-semibold text-slate-600 ml-2">Sort:</label>
                <select
                  id="sort-matrix-column"
                  value={tableSortColumn}
                  onChange={(e) => setTableSortColumn(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="balance">Projected Balance (Most Deficit First)</option>
                  <option value="demand">Projected 7D Demand (Highest First)</option>
                  <option value="stock">Current Stock Level</option>
                  <option value="doi">Days of Inventory (DOI)</option>
                </select>

                <button
                  id="btn-toggle-sort-order"
                  onClick={() => setTableSortAsc(!tableSortAsc)}
                  title="Toggle Ascending/Descending"
                  className="p-1 rounded bg-white border border-slate-300 text-slate-600 hover:text-slate-900"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sortable Table */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Health Facility</th>
                    <th className="py-2.5 px-3">District &amp; Tier</th>
                    <th className="py-2.5 px-3">Medicine Formulary</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Projected 7D Demand</th>
                    <th className="py-2.5 px-3 text-right">Projected Balance</th>
                    <th className="py-2.5 px-3 text-right">Projected DOI</th>
                    <th className="py-2.5 px-3">Depletion Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 font-normal">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500 text-xs">
                        No facilities match the search or filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.slice(0, 30).map((item, idx) => {
                      const isSelected =
                        item.facility_id === activeFacility?.facility_id &&
                        item.medicine_name === selectedMedicine;

                      return (
                        <tr
                          key={`${item.facility_id}-${item.medicine_name}-${idx}`}
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-teal-50/70 font-medium' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.facility_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-medium text-slate-800">{item.district}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({item.facility_type})</span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {item.medicine_name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.current_stock.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-teal-800 font-bold">
                            {item.projected_7d_demand.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span
                              className={
                                item.projected_balance < 0
                                  ? 'text-red-700'
                                  : item.projected_balance <= 50
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }
                            >
                              {item.projected_balance > 0 ? '+' : ''}
                              {item.projected_balance.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                            {item.projected_doi}d
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                item.depletion_status === 'Deficit Breached'
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : item.depletion_status === 'Imminent Deficit (<4d)'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : item.depletion_status === 'Low Stock (4-14d)'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {item.depletion_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              id={`btn-load-canvas-${item.facility_id}-${item.medicine_name.replace(/\s+/g, '-').toLowerCase()}`}
                              onClick={() => handleLoadInCanvas(item)}
                              className="px-2 py-1 bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 rounded text-[11px] font-semibold transition-colors border border-slate-300 hover:border-teal-600"
                            >
                              Load
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredSummaries.length > 30 && (
              <div className="text-right text-[11px] text-slate-500 font-mono">
                Showing top 30 of {filteredSummaries.length} facility-medicine combinations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: EXPLORATORY CLINICAL TELEMETRY (PHASE 3 EDA HUB) */}
      {mainView === 'clinical_eda' && (
        <div className="space-y-6">
          <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-lg">
            <button
              id="eda-tab-doi"
              onClick={() => setEdaSubPanel('doi')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                edaSubPanel === 'doi'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              1. Stock Depletion &amp; Run-Out Velocity (DOI)
            </button>
            <button
              id="eda-tab-weather"
              onClick={() => setEdaSubPanel('weather')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                edaSubPanel === 'weather'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              2. Weather &amp; Epidemiological Correlation
            </button>
            <button
              id="eda-tab-elasticity"
              onClick={() => setEdaSubPanel('elasticity')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                edaSubPanel === 'elasticity'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              3. Outpatient Footfall vs Burn-Rate Elasticity
            </button>
          </div>

          {/* Sub-Panel 1: DOI Urgency Ranking */}
          {edaSubPanel === 'doi' && (
            <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Days of Inventory (DOI) Urgency Ranking
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formula: DOI = Current Stock Units / Daily Average Consumption
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    id="doi-medicine-selector"
                    value={selectedDoiMed}
                    onChange={(e) => setSelectedDoiMed(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800"
                  >
                    <option value="All Essential Medicines">All Essential Medicines</option>
                    {availableMedicines.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    id="btn-toggle-doi-sort"
                    onClick={() => setIsDoiAscending(!isDoiAscending)}
                    className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-medium text-slate-700"
                  >
                    {isDoiAscending ? 'Most Urgent (<4d First)' : 'Highest Buffer First'}
                  </button>
                </div>
              </div>

              {/* Ranking Bar Chart */}
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredFacilities.map((f) => {
                      const facStock = scopedInventory
                        .filter(
                          (item) =>
                            item.facility_id === f.facility_id &&
                            (selectedDoiMed === 'All Essential Medicines' ||
                              item.medicine_name === selectedDoiMed)
                        )
                        .reduce((sum, item) => sum + item.current_stock_units, 0);

                      const facDaily = scopedInventory
                        .filter(
                          (item) =>
                            item.facility_id === f.facility_id &&
                            (selectedDoiMed === 'All Essential Medicines' ||
                              item.medicine_name === selectedDoiMed)
                        )
                        .reduce((sum, item) => sum + item.daily_avg_consumption, 0);

                      const doi = facDaily > 0 ? parseFloat((facStock / facDaily).toFixed(1)) : 0;
                      return {
                        facility_name: f.facility_name,
                        district: f.district,
                        doi,
                        stock: facStock,
                      };
                    }).sort((a, b) => (isDoiAscending ? a.doi - b.doi : b.doi - a.doi))}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 70, bottom: 20 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      dataKey="facility_name"
                      type="category"
                      tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 500 }}
                      width={120}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 text-white p-2.5 rounded shadow text-xs">
                            <div className="font-bold">{data.facility_name}</div>
                            <div className="text-slate-400">{data.district} District</div>
                            <div className="mt-1 font-mono text-teal-400 font-bold">
                              DOI: {data.doi} Days of Inventory
                            </div>
                            <div className="font-mono text-slate-300">Total Stock: {data.stock} units</div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={4.0} stroke="#B91C1C" strokeDasharray="3 3" label={{ value: 'Critical (4d)', fill: '#B91C1C', fontSize: 10 }} />
                    <ReferenceLine x={14.0} stroke="#B45309" strokeDasharray="3 3" label={{ value: 'Safety Buffer (14d)', fill: '#B45309', fontSize: 10 }} />
                    <Bar dataKey="doi" fill="#0284C7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sub-Panel 2: Weather & Epidemiological Correlation */}
          {edaSubPanel === 'weather' && (
            <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Dual-Axis Telemetry: Precipitation vs Consumption
                  </h3>
                  <p className="text-xs text-slate-500">
                    Evaluates rainfall spikes in the Yamuna flood basin against clinical demand for ORS and antibiotics.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    id="weather-med-selector"
                    value={selectedWeatherMed}
                    onChange={(e) => setSelectedWeatherMed(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800"
                  >
                    {availableMedicines.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dual-axis chart */}
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={historicalConsumption
                      .filter((h) => h.medicine_name === selectedWeatherMed)
                      .slice(-45)}
                    margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                  >
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} interval={6} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} label={{ value: 'Units Consumed', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} label={{ value: 'Rainfall (mm)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                    <Tooltip />
                    <Bar yAxisId="right" dataKey="rainfall_mm" fill="#93C5FD" opacity={0.6} name="Daily Rainfall (mm)" />
                    <Line yAxisId="left" type="monotone" dataKey="units_consumed" stroke="#0F172A" strokeWidth={2} dot={false} name="Daily Units Consumed" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sub-Panel 3: Outpatient Elasticity */}
          {edaSubPanel === 'elasticity' && (
            <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Outpatient Footfall Elasticity vs Medication Consumption
                </h3>
                <p className="text-xs text-slate-500">
                  Linear relationship between daily clinic consultations and formulary burn rate.
                </p>
              </div>

              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <XAxis dataKey="outpatient_count" name="OPD Consultations" tick={{ fontSize: 11, fill: '#64748B' }} label={{ value: 'Daily Outpatient Consultations', position: 'bottom', offset: 0, fontSize: 10 }} />
                    <YAxis dataKey="units_consumed" name="Units Consumed" tick={{ fontSize: 11, fill: '#64748B' }} label={{ value: 'Daily Units Consumed', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter
                      name="ORS Packets"
                      data={historicalConsumption.filter((h) => h.medicine_name === 'ORS Packets').slice(-80)}
                      fill="#0284C7"
                      opacity={0.7}
                    />
                    <Scatter
                      name="Paracetamol"
                      data={historicalConsumption.filter((h) => h.medicine_name === 'Paracetamol').slice(-80)}
                      fill="#B45309"
                      opacity={0.7}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
