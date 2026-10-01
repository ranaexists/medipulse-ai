import {
  InventoryRecord,
  FacilityRecord,
  ForecastSummaryItem,
  AshaGroundReportRecord,
  RiskSummaryRecord,
  RiskEngineAggregates,
  GroundAuditRecord,
  SviRiskLevel,
  PriorityBadgeTag,
} from '../types';

export function computeStockoutRiskEngine(
  inventory: InventoryRecord[],
  facilities: FacilityRecord[],
  forecastSummary: ForecastSummaryItem[],
  ashaReports: AshaGroundReportRecord[],
  auditStatuses: Record<string, 'PENDING' | 'AUDIT_INITIATED' | 'VERIFIED'> = {},
  currentDateStr: string = '2026-09-17'
): {
  riskSummary: RiskSummaryRecord[];
  aggregates: RiskEngineAggregates;
  actionDrawerItems: RiskSummaryRecord[];
  groundAuditRecords: GroundAuditRecord[];
} {
  const facilityMap = new Map<string, FacilityRecord>();
  facilities.forEach((f) => facilityMap.set(f.facility_id, f));

  // Build forecast lookup: key = `${facility_id}::${medicine_name}`
  const forecastMap = new Map<string, ForecastSummaryItem>();
  forecastSummary.forEach((fc) => {
    forecastMap.set(`${fc.facility_id}::${fc.medicine_name}`, fc);
  });

  // Recent ASHA reports within 72 hours (simulation baseline: 2026-09-17)
  const recentAshaReports = ashaReports.filter((r) => {
    // Check if report has shortage signal
    return r.reported_shortage && r.reported_shortage.trim().length > 0;
  });

  // Pre-calculate ghost flags by facility + medicine
  const ghostReportMap = new Map<string, AshaGroundReportRecord>();
  recentAshaReports.forEach((r) => {
    // Normalise medicine matching
    const reportedShort = r.reported_shortage.toLowerCase();
    // check if matches any standard medicine
    const matchingItem = inventory.find(
      (inv) =>
        inv.facility_id === r.facility_id &&
        (reportedShort.includes(inv.medicine_name.toLowerCase()) ||
          inv.medicine_name.toLowerCase().includes(reportedShort.split(' ')[0]))
    );
    if (matchingItem) {
      ghostReportMap.set(`${r.facility_id}::${matchingItem.medicine_name}`, r);
    } else {
      ghostReportMap.set(`${r.facility_id}::${r.reported_shortage}`, r);
    }
  });

  // Facility-level ghost counts for integrity scoring
  const facilityItemCount = new Map<string, number>();
  const facilityGhostCount = new Map<string, number>();

  inventory.forEach((item) => {
    facilityItemCount.set(item.facility_id, (facilityItemCount.get(item.facility_id) || 0) + 1);
  });

  const currentDate = new Date(currentDateStr);

  // First pass: generate risk summary records
  const riskSummary: RiskSummaryRecord[] = inventory.map((item) => {
    const fac = facilityMap.get(item.facility_id);
    const fcKey = `${item.facility_id}::${item.medicine_name}`;
    const fc = forecastMap.get(fcKey);

    const projected7d = fc ? fc.projected_7d_demand : Math.round(item.daily_avg_consumption * 7);
    const projectedDaily = projected7d > 0 ? projected7d / 7.0 : Math.max(item.daily_avg_consumption, 1.0);

    // 1. Stockout Vulnerability Index (SVI)
    // Days_Left = Current_Stock / Projected_Daily_Demand_Mean
    const daysLeft = Number((item.current_stock_units / Math.max(projectedDaily, 0.1)).toFixed(1));

    let sviRisk: SviRiskLevel = 'SECURE';
    if (daysLeft <= 2.0) {
      sviRisk = 'CRITICAL';
    } else if (daysLeft <= 5.0) {
      sviRisk = 'HIGH RISK';
    } else if (daysLeft <= 10.0) {
      sviRisk = 'MODERATE';
    } else {
      sviRisk = 'SECURE';
    }

    // 2. Ghost Inventory Detection Engine
    // Condition: official ERP records current_stock_units >= safety_stock_threshold
    // AND ASHA ground report for that facility within 72 hrs reports shortage
    const matchedAsha =
      ghostReportMap.get(fcKey) ||
      recentAshaReports.find(
        (r) =>
          r.facility_id === item.facility_id &&
          r.reported_shortage.toLowerCase().includes(item.medicine_name.toLowerCase().split(' ')[0])
      );

    const hasGhostCondition =
      item.current_stock_units >= item.safety_stock_threshold &&
      Boolean(matchedAsha && (matchedAsha.discrepancy_flag || matchedAsha.reported_shortage));

    if (hasGhostCondition) {
      facilityGhostCount.set(item.facility_id, (facilityGhostCount.get(item.facility_id) || 0) + 1);
    }

    const ghostAlert = hasGhostCondition ? 'AUDIT_ALERT: GHOST_INVENTORY_DETECTED' : 'NORMAL';
    const discrepancyMargin = hasGhostCondition ? item.current_stock_units : 0;

    // 3. Expiration Risk Multiplier (FEFO Priority)
    // expiry_date - current_date <= 30 days AND current_stock_units > projected_7d_demand
    const expDate = new Date(item.expiry_date);
    const diffTime = expDate.getTime() - currentDate.getTime();
    const daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isHighExpiryRisk = daysToExpiry <= 30 && item.current_stock_units > projected7d;
    const expiryRiskValueInr = isHighExpiryRisk ? Math.round(item.current_stock_units * item.unit_cost_inr) : 0;

    // Determine Action Priority Tag
    let actionPriority: PriorityBadgeTag = 'SECURE';
    if (sviRisk === 'CRITICAL') {
      actionPriority = 'CRITICAL DEFICIT';
    } else if (hasGhostCondition) {
      actionPriority = 'GHOST STOCK AUDIT REQUIRED';
    } else if (isHighExpiryRisk) {
      actionPriority = 'EXPIRING SURPLUS';
    } else if (sviRisk === 'HIGH RISK') {
      actionPriority = 'CRITICAL DEFICIT';
    }

    const auditKey = `${item.facility_id}::${item.medicine_name}`;
    const auditStatus = auditStatuses[auditKey] || (hasGhostCondition ? 'PENDING' : 'VERIFIED');

    return {
      facility_id: item.facility_id,
      facility_name: fac?.facility_name || item.facility_name || item.facility_id,
      district: fac?.district || item.district || 'Karnal',
      facility_type: fac?.facility_type || 'PHC',
      medicine_name: item.medicine_name,
      batch_id: item.batch_id,
      current_stock_units: item.current_stock_units,
      projected_7d_demand: projected7d,
      projected_daily_demand: Number(projectedDaily.toFixed(1)),
      days_left: daysLeft,
      svi_risk_level: sviRisk,
      is_ghost_inventory: hasGhostCondition,
      ghost_audit_alert: ghostAlert,
      discrepancy_margin: discrepancyMargin,
      facility_integrity_score: 100, // calculated in second pass
      is_high_expiry_risk: isHighExpiryRisk,
      expiry_date: item.expiry_date,
      days_to_expiry: daysToExpiry,
      unit_cost_inr: item.unit_cost_inr,
      expiry_risk_value_inr: expiryRiskValueInr,
      audit_status: auditStatus,
      action_priority: actionPriority,
    };
  });

  // Calculate facility integrity scores
  riskSummary.forEach((r) => {
    const totalItems = facilityItemCount.get(r.facility_id) || 8;
    const ghostItems = facilityGhostCount.get(r.facility_id) || 0;
    r.facility_integrity_score = Number(Math.max(0, 100 - (ghostItems / totalItems) * 100).toFixed(1));
  });

  // High-Priority Action Drawer items (Prioritize Critical Deficits, Ghost Stock, and Expiring Surplus)
  const actionDrawerItems = riskSummary
    .filter((r) => r.action_priority !== 'SECURE')
    .sort((a, b) => {
      const priorityWeights: Record<PriorityBadgeTag, number> = {
        'CRITICAL DEFICIT': 3,
        'GHOST STOCK AUDIT REQUIRED': 2,
        'EXPIRING SURPLUS': 1,
        SECURE: 0,
      };
      const diff = priorityWeights[b.action_priority] - priorityWeights[a.action_priority];
      if (diff !== 0) return diff;
      return a.days_left - b.days_left;
    });

  // Calculate Aggregates
  const criticalFacilities = new Set(
    riskSummary.filter((r) => r.svi_risk_level === 'CRITICAL').map((r) => r.facility_id)
  );

  const activeGhostDiscrepancies = riskSummary.filter((r) => r.is_ghost_inventory).length;
  const expiringStockValueInr = riskSummary.reduce((acc, r) => acc + r.expiry_risk_value_inr, 0);

  // Supply Chain Resilience Score composite: 100 - (2.5 * critFac) - (4.0 * ghostAlerts) - (0.5 * nearExpBatches)
  const highExpBatches = riskSummary.filter((r) => r.is_high_expiry_risk).length;
  const rawScore = 100.0 - criticalFacilities.size * 2.5 - activeGhostDiscrepancies * 4.0 - highExpBatches * 0.5;
  const supplyChainResilienceScore = Number(Math.min(100.0, Math.max(0.0, rawScore)).toFixed(1));

  const aggregates: RiskEngineAggregates = {
    criticalFacilitiesCount: criticalFacilities.size,
    activeGhostDiscrepanciesCount: activeGhostDiscrepancies,
    expiringStockValueInr,
    supplyChainResilienceScore,
    highPriorityActionsCount: actionDrawerItems.length,
  };

  // Ground Reality vs System Records Table
  // Cross-join / list of all ASHA ground reports or monitored medicines with status
  const groundAuditRecords: GroundAuditRecord[] = ashaReports.map((report) => {
    const fac = facilityMap.get(report.facility_id);
    const auditKey = `${report.facility_id}::${report.reported_shortage}`;
    const auditStatus = auditStatuses[auditKey] || (report.discrepancy_flag ? 'PENDING' : 'VERIFIED');

    return {
      facility_id: report.facility_id,
      facility_name: fac?.facility_name || report.facility_name,
      district: fac?.district || 'Karnal',
      medicine_name: report.reported_shortage,
      logged_system_stock: report.system_stock_at_report_time,
      asha_field_status: report.discrepancy_flag ? 'Stockout (0 Units on shelf)' : 'Stock Available / Refilled',
      integrity_flag: report.discrepancy_flag ? 'AUDIT_ALERT: GHOST_INVENTORY' : 'VERIFIED_RECONCILED',
      audit_status: auditStatus,
      report_id: report.report_id,
      reporter_name: report.reporter_name,
      timestamp: report.timestamp,
      discrepancy_margin: report.discrepancy_flag ? report.system_stock_at_report_time : 0,
    };
  });

  return {
    riskSummary,
    aggregates,
    actionDrawerItems,
    groundAuditRecords,
  };
}
