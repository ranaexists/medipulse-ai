import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { GlobalMetrics } from './components/GlobalMetrics';
import { Sidebar } from './components/Sidebar';
import { DistrictCommandCenter } from './components/tabs/DistrictCommandCenter';
import { AshaFieldIntake } from './components/tabs/AshaFieldIntake';
import { DemandForecasting } from './components/tabs/DemandForecasting';
import { InterFacilityRedistribution } from './components/tabs/InterFacilityRedistribution';
import { PolicySimulator } from './components/tabs/PolicySimulator';
import { PythonCodeModal } from './components/PythonCodeModal';
import { SessionStateViewer } from './components/SessionStateViewer';
import { generate_relational_pipeline, generateAllForecastSummaries } from './data/relationalDataEngine';
import { computeStockoutRiskEngine } from './data/riskEngine';
import { computeFefoRedistributionPlan } from './data/redistributionEngine';
import {
  RoleType,
  DistrictFilterType,
  FacilityTypeFilter,
  DateRangeFilter,
  SystemModeType,
  FacilityRecord,
  InventoryRecord,
  HistoricalConsumptionRecord,
  AshaGroundReportRecord,
  RedistributionItem,
} from './types';
import { Menu, Layers } from 'lucide-react';

export default function App() {
  const initialPipeline = useMemo(() => generate_relational_pipeline(), []);

  const [facilities, setFacilities] = useState<FacilityRecord[]>(initialPipeline.facilities_df);
  const [inventory, setInventory] = useState<InventoryRecord[]>(initialPipeline.inventory_df);
  const [historicalConsumption, setHistoricalConsumption] = useState<HistoricalConsumptionRecord[]>(
    initialPipeline.historical_consumption_df
  );
  const [ashaReports, setAshaReports] = useState<AshaGroundReportRecord[]>(
    initialPipeline.asha_ground_reports_df
  );
  const [redistribution, setRedistribution] = useState<RedistributionItem[]>(
    initialPipeline.redistribution_plan
  );
  const [auditStatuses, setAuditStatuses] = useState<Record<string, 'PENDING' | 'AUDIT_INITIATED' | 'VERIFIED'>>({});
  const [approvedTransferIds, setApprovedTransferIds] = useState<Set<string>>(new Set());
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now (Deterministic Seed)');

  // Sidebar Controls
  const [selectedRole, setSelectedRole] = useState<RoleType>('District Health Officer (DHO)');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictFilterType>('All Districts');
  const [selectedFacilityType, setSelectedFacilityType] = useState<FacilityTypeFilter>('All Types');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>('Past 90 Days');
  const [systemMode, setSystemMode] = useState<SystemModeType>('Real-time Simulation');
  const [surgeFactor, setSurgeFactor] = useState<number>(35);
  const [delayDays, setDelayDays] = useState<number>(4);

  // Navigation Tabs (0: Command Center, 1: ASHA Intake, 2: EDA Analytics, 3: Redistribution, 4: Policy Simulator)
  const [activeTab, setActiveTab] = useState<number>(0);

  // Mobile sidebar drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Utility modals
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [isStateInspectorOpen, setIsStateInspectorOpen] = useState<boolean>(false);

  // Data Pipeline Re-seed Action
  const handleReseedData = () => {
    const refreshed = generate_relational_pipeline();
    setFacilities(refreshed.facilities_df);
    setInventory(refreshed.inventory_df);
    setHistoricalConsumption(refreshed.historical_consumption_df);
    setAshaReports(refreshed.asha_ground_reports_df);
    setRedistribution(refreshed.redistribution_plan);
    setApprovedTransferIds(new Set());
    setLastSyncTime(new Date().toLocaleTimeString());
  };

  // Add new ASHA report to state
  const handleAddAshaReport = (newReport: AshaGroundReportRecord) => {
    setAshaReports((prev) => [newReport, ...prev]);
  };

  const handleAuthorizeAll = () => {
    setRedistribution((prev) => prev.map((item) => ({ ...item, status: 'Authorized' })));
  };

  const handleInitiateAudit = (facilityId: string, medicineName: string) => {
    const key = `${facilityId}::${medicineName}`;
    setAuditStatuses((prev) => ({
      ...prev,
      [key]: 'AUDIT_INITIATED',
    }));
  };

  const handleDispatchAction = (facilityId: string, medicineName: string, actionType: string) => {
    const key = `${facilityId}::${medicineName}`;
    setAuditStatuses((prev) => ({
      ...prev,
      [key]: 'AUDIT_INITIATED',
    }));
  };

  // Filtered scopes based on sidebar settings (District & Tier)
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

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => validFacilityIds.has(item.facility_id));
  }, [inventory, validFacilityIds]);

  const filteredAshaReports = useMemo(() => {
    return ashaReports.filter((item) => validFacilityIds.has(item.facility_id));
  }, [ashaReports, validFacilityIds]);

  // Phase 4: Demand Forecast Summaries across facilities
  const forecastSummaries = useMemo(() => {
    return generateAllForecastSummaries(historicalConsumption, facilities, inventory);
  }, [historicalConsumption, facilities, inventory]);

  // Phase 5: Stockout-Risk Engine & Ghost Inventory Detector
  const riskEngineResult = useMemo(() => {
    return computeStockoutRiskEngine(
      filteredInventory,
      filteredFacilities,
      forecastSummaries,
      filteredAshaReports,
      auditStatuses
    );
  }, [filteredInventory, filteredFacilities, forecastSummaries, filteredAshaReports, auditStatuses]);

  // Phase 6: Inter-Facility Redistribution & FEFO Optimization Engine
  const fefoEngineResult = useMemo(() => {
    return computeFefoRedistributionPlan(
      inventory,
      facilities,
      riskEngineResult.riskSummary,
      forecastSummaries,
      35.0,
      '2026-09-17',
      approvedTransferIds
    );
  }, [inventory, facilities, riskEngineResult.riskSummary, forecastSummaries, approvedTransferIds]);

  const handleApproveTransfer = (transferId: string) => {
    setApprovedTransferIds((prev) => {
      const next = new Set(prev);
      next.add(transferId);
      return next;
    });

    const order = fefoEngineResult.transferOrders.find((t) => t.transfer_id === transferId);
    if (order) {
      setInventory((prev) =>
        prev.map((item) => {
          if (
            item.facility_id === order.source_facility_id &&
            item.batch_id === order.batch_id
          ) {
            return {
              ...item,
              current_stock_units: Math.max(0, item.current_stock_units - order.transfer_quantity_units),
            };
          }
          if (
            item.facility_id === order.target_facility_id &&
            item.medicine_name === order.medicine_name
          ) {
            return {
              ...item,
              current_stock_units: item.current_stock_units + order.transfer_quantity_units,
            };
          }
          return item;
        })
      );
    }
  };

  const handleAuthorizeAllTransfers = () => {
    const pending = fefoEngineResult.transferOrders.filter((t) => t.approval_status === 'Pending');
    if (pending.length === 0) return;

    setApprovedTransferIds((prev) => {
      const next = new Set(prev);
      pending.forEach((p) => next.add(p.transfer_id));
      return next;
    });

    setInventory((prev) => {
      let updated = [...prev];
      pending.forEach((order) => {
        updated = updated.map((item) => {
          if (
            item.facility_id === order.source_facility_id &&
            item.batch_id === order.batch_id
          ) {
            return {
              ...item,
              current_stock_units: Math.max(0, item.current_stock_units - order.transfer_quantity_units),
            };
          }
          if (
            item.facility_id === order.target_facility_id &&
            item.medicine_name === order.medicine_name
          ) {
            return {
              ...item,
              current_stock_units: item.current_stock_units + order.transfer_quantity_units,
            };
          }
          return item;
        });
      });
      return updated;
    });
  };

  const tabList = [
    { id: 0, label: 'District Command Center', ref: 'Geospatial Map & Stock Matrix' },
    { id: 1, label: 'ASHA Ground Intake & Ghost Audits', ref: 'asha_ground_reports_df' },
    { id: 2, label: 'Analytics & Clinical EDA Hub', ref: 'DOI, Weather & Elasticity' },
    { id: 3, label: 'Inter-Facility Redistribution (FEFO)', ref: 'redistribution_plan' },
    { id: 4, label: 'Policy & Stress Simulator', ref: 'Epidemic & Logistics Stress' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-slate-800 font-sans">
      {/* 1. Sidebar Navigation & Controls */}
      <Sidebar
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
        selectedDistrict={selectedDistrict}
        onSelectDistrict={setSelectedDistrict}
        selectedFacilityType={selectedFacilityType}
        onSelectFacilityType={setSelectedFacilityType}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
        systemMode={systemMode}
        onSelectSystemMode={setSystemMode}
        onReseedData={handleReseedData}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Main Content Area (Wide Layout) */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0 bg-[#F8FAFC]">
        <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
          {/* Mobile Top Navigation Trigger */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-200">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded bg-white border border-slate-300 text-slate-700 hover:text-slate-900 flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Menu className="w-4 h-4 text-sky-700" />
              <span>Control Console</span>
            </button>
            <div className="text-xs font-semibold text-slate-700">
              {selectedRole.split(' ')[0]} ({selectedDistrict} • {selectedFacilityType})
            </div>
          </div>

          {/* Header & Badges */}
          <Header
            onOpenPythonModal={() => setIsPythonModalOpen(true)}
            onOpenStateInspector={() => setIsStateInspectorOpen(true)}
            activeDistrict={selectedDistrict}
            activeRole={selectedRole}
          />

          {/* Global Metric KPI Cards (Phase 5 Live Risk Engine Aggregates) */}
          <GlobalMetrics
            aggregates={riskEngineResult.aggregates}
            totalFacilities={filteredFacilities.length}
          />

          {/* Main Multi-Tab Navigation Bar */}
          <div className="border-b border-slate-200">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-1">
              {tabList.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap px-4 py-2 rounded-t-md text-xs sm:text-sm font-semibold transition-all cursor-pointer
                    ${
                      activeTab === tab.id
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-b-0 border-slate-200 hover:bg-slate-50'
                    }
                  `}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab View Rendering */}
          <div className="min-h-[500px] transition-all">
            {activeTab === 0 && (
              <DistrictCommandCenter
                inventory={inventory}
                facilities={facilities}
                selectedDistrict={selectedDistrict}
                selectedFacilityType={selectedFacilityType}
                riskSummary={riskEngineResult.riskSummary}
                aggregates={riskEngineResult.aggregates}
                actionDrawerItems={riskEngineResult.actionDrawerItems}
                onInitiateAudit={handleInitiateAudit}
                onDispatchAction={handleDispatchAction}
              />
            )}

            {activeTab === 1 && (
              <AshaFieldIntake
                reports={filteredAshaReports}
                facilities={facilities}
                groundAuditRecords={riskEngineResult.groundAuditRecords}
                auditStatuses={auditStatuses}
                onInitiateAudit={handleInitiateAudit}
                onAddReport={handleAddAshaReport}
              />
            )}

            {activeTab === 2 && (
              <DemandForecasting
                historicalConsumption={historicalConsumption}
                facilities={facilities}
                inventory={inventory}
                selectedDistrict={selectedDistrict}
                selectedFacilityType={selectedFacilityType}
                selectedDateRange={selectedDateRange}
              />
            )}

            {activeTab === 3 && (
              <InterFacilityRedistribution
                transferOrders={fefoEngineResult.transferOrders}
                escalations={fefoEngineResult.escalations}
                metrics={fefoEngineResult.metrics}
                facilities={facilities}
                onApproveTransfer={handleApproveTransfer}
                onAuthorizeAll={handleAuthorizeAllTransfers}
              />
            )}

            {activeTab === 4 && (
              <PolicySimulator
                surgeFactor={surgeFactor}
                onChangeSurgeFactor={setSurgeFactor}
                delayDays={delayDays}
                onChangeDelayDays={setDelayDays}
              />
            )}
          </div>

          {/* Footer Metadata */}
          <footer className="pt-6 pb-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1">
            <div className="flex items-center justify-center gap-2 text-slate-700 font-semibold">
              <Layers className="w-4 h-4 text-sky-700" />
              <span>MediPulse AI: National Medicine Stockout Early-Warning & Optimization System</span>
            </div>
            <div>
              National Health Mission (NHM) • Digital Public Goods Architecture • Haryana State Health Cluster (Karnal, Kurukshetra, Panipat)
            </div>
            <div className="text-[11px] text-slate-500 pt-0.5 font-mono">
              Phase 3: Exploratory Data Analysis & Interactive Health Analytics Engine • Self-contained Streamlit application available at <code className="text-sky-700 font-semibold">/app.py</code>
            </div>
          </footer>
        </div>
      </main>

      {/* Python Code Viewer Modal */}
      <PythonCodeModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />

      {/* Session State Live Inspector Modal */}
      <SessionStateViewer
        isOpen={isStateInspectorOpen}
        onClose={() => setIsStateInspectorOpen(false)}
        facilities={facilities}
        inventory={inventory}
        historicalConsumption={historicalConsumption}
        ashaReports={ashaReports}
        redistribution={fefoEngineResult.transferOrders}
        escalations={fefoEngineResult.escalations}
      />
    </div>
  );
}
