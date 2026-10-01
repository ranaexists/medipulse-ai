export interface FacilityRecord {
  facility_id: string;
  facility_name: string;
  facility_type: 'PHC' | 'CHC';
  district: 'Karnal' | 'Kurukshetra' | 'Panipat';
  latitude: number;
  longitude: number;
  catchment_population: number;
}

export interface InventoryRecord {
  batch_id: string;
  facility_id: string;
  facility_name?: string;
  district?: string;
  medicine_name:
    | 'Paracetamol'
    | 'Amoxicillin'
    | 'ORS Packets'
    | 'Zinc Sulfate'
    | 'Cetirizine'
    | 'Metformin'
    | 'Azithromycin'
    | 'Rabies Vaccine';
  current_stock_units: number;
  daily_avg_consumption: number;
  safety_stock_threshold: number;
  expiry_date: string;
  unit_cost_inr: number;
  // Computed fields
  days_of_stock?: number;
  stock_status?: 'Normal' | 'Low Stock' | 'Critical Deficit';
  is_near_expiry?: boolean; // < 30 days
}

export interface HistoricalConsumptionRecord {
  date: string;
  facility_id: string;
  medicine_name: string;
  units_consumed: number;
  outpatient_count: number;
  rainfall_mm: number;
}

export interface AshaGroundReportRecord {
  report_id: string;
  timestamp: string;
  facility_id: string;
  facility_name?: string;
  reporter_name: string;
  reported_shortage: string;
  observed_symptoms: string;
  system_stock_at_report_time: number;
  discrepancy_flag: boolean;
  notes?: string;
}

export interface RedistributionRecord {
  transfer_id: string;
  donor_facility_id: string;
  donor_facility_name: string;
  donor_district: string;
  recipient_facility_id: string;
  recipient_facility_name: string;
  recipient_district: string;
  medicine_name: string;
  batch_id: string;
  units_to_transfer: number;
  expiry_date: string;
  transit_distance_km: number;
  status: 'Awaiting Authorization' | 'Authorized' | 'In-Transit';
}

export interface RedistributionTransferOrder {
  transfer_id: string;
  medicine_name: string;
  source_facility_id: string;
  source_facility_name: string;
  target_facility_id: string;
  target_facility_name: string;
  transfer_quantity_units: number;
  batch_id: string;
  batch_expiry_date: string;
  transit_distance_km: number;
  priority_level: 'HIGH' | 'MEDIUM';
  approval_status: 'Pending' | 'Dispatched';
  source_lat?: number;
  source_lon?: number;
  target_lat?: number;
  target_lon?: number;
  source_district?: string;
  target_district?: string;
  is_near_expiry?: boolean;
  value_saved_inr?: number;
}

export interface RedistributionEscalation {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_name: string;
  deficit_units: number;
  days_left: number;
  nearest_donor_km: number;
  status: string;
  recommendation: string;
}

export interface RedistributionMetrics {
  pending_transfers_count: number;
  total_units_recommended: number;
  expiring_stock_saved_units: number;
  expiring_stock_saved_inr: number;
  average_transit_distance_km: number;
}

export interface RedistributionItem {
  transfer_id: string;
  donor_facility: string;
  recipient_facility: string;
  medicine: string;
  units_to_transfer: number;
  fefo_expiry: string;
  transit_km: number;
  status: string;
}

// Legacy Phase 1 Types for backward compatibility
export interface InventoryItem {
  phc_id: string;
  phc_name: string;
  district: string;
  medicine: string;
  stock: number;
  min_thresh: number;
  status: string;
  days_left: number;
  batch: string;
}

export interface AshaReport {
  id: string;
  timestamp: string;
  asha_name: string;
  phc_id: string;
  medicine: string;
  reported_issue: string;
  audio_file: string;
  ground_vs_system_status: string;
  urgency: string;
}

export interface ForecastResults {
  model_version: string;
  district_scope: string;
  projected_7d_stockout_risk: number;
  peak_disease_vector: string;
  lead_time_buffer_days: number;
}

export interface ForecastRecord {
  facility_id: string;
  medicine_name: string;
  forecast_date: string;
  predicted_demand: number;
  lower_bound: number;
  upper_bound: number;
  baseline_7d_total: number;
}

export interface ForecastProjectionPoint {
  date: string;
  displayDate: string;
  isHistorical: boolean;
  actualDemand?: number;
  predictedDemand?: number;
  lowerBound?: number;
  upperBound?: number;
  stockLevel?: number;
  confidenceBand?: [number, number];
  rainfall_mm?: number;
  outpatient_count?: number;
}

export interface ForecastSummaryItem {
  facility_id: string;
  facility_name: string;
  district: string;
  facility_type: string;
  medicine_name: string;
  current_stock: number;
  projected_7d_demand: number;
  projected_balance: number;
  projected_doi: number;
  depletion_status: 'Deficit Breached' | 'Imminent Deficit (<4d)' | 'Low Stock (4-14d)' | 'Sufficient Coverage (>14d)';
  depletion_days?: number;
  trend_impact_pct: number;
  rain_surge_pct: number;
}

export interface ForecastDriverMetrics {
  baseline_trend_pct: number;
  precipitation_surge_pct: number;
  expected_7d_consumption: number;
  expected_horizon_consumption: number;
  residual_sigma: number;
  r_squared: number;
  current_stock: number;
  depletion_day_intercept: number | null;
}

export type RoleType = 'District Health Officer (DHO)' | 'PHC Medical Officer' | 'ASHA Field Coordinator';
export type DistrictFilterType = 'All Districts' | 'Karnal' | 'Kurukshetra' | 'Panipat';
export type FacilityTypeFilter = 'All Types' | 'PHC' | 'CHC';
export type DateRangeFilter = 'Past 90 Days' | 'Past 60 Days' | 'Past 30 Days' | 'Past 14 Days';
export type DistrictType = 'All' | 'Karnal' | 'Kurukshetra' | 'Panipat';
export type SystemModeType = 'Historical Monitoring' | 'Real-time Simulation';

// Phase 5: Stockout-Risk Engine & Ghost Inventory Detector Types
export type SviRiskLevel = 'CRITICAL' | 'HIGH RISK' | 'MODERATE' | 'SECURE';
export type PriorityBadgeTag = 'CRITICAL DEFICIT' | 'GHOST STOCK AUDIT REQUIRED' | 'EXPIRING SURPLUS' | 'SECURE';

export interface RiskSummaryRecord {
  facility_id: string;
  facility_name: string;
  district: string;
  facility_type: string;
  medicine_name: string;
  batch_id: string;
  current_stock_units: number;
  projected_7d_demand: number;
  projected_daily_demand: number;
  days_left: number;
  svi_risk_level: SviRiskLevel;
  is_ghost_inventory: boolean;
  ghost_audit_alert: string;
  discrepancy_margin: number;
  facility_integrity_score: number;
  is_high_expiry_risk: boolean;
  expiry_date: string;
  days_to_expiry: number;
  unit_cost_inr: number;
  expiry_risk_value_inr: number;
  audit_status: 'PENDING' | 'AUDIT_INITIATED' | 'VERIFIED';
  action_priority: PriorityBadgeTag;
}

export interface RiskEngineAggregates {
  criticalFacilitiesCount: number;
  activeGhostDiscrepanciesCount: number;
  expiringStockValueInr: number;
  supplyChainResilienceScore: number;
  highPriorityActionsCount: number;
}

export interface GroundAuditRecord {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_name: string;
  logged_system_stock: number;
  asha_field_status: string;
  integrity_flag: string;
  audit_status: 'PENDING' | 'AUDIT_INITIATED' | 'VERIFIED';
  report_id?: string;
  reporter_name?: string;
  timestamp?: string;
  discrepancy_margin?: number;
}
