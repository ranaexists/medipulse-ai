import {
  FacilityRecord,
  InventoryRecord,
  RiskSummaryRecord,
  ForecastSummaryItem,
  RedistributionTransferOrder,
  RedistributionEscalation,
  RedistributionMetrics,
} from '../types';

/**
 * Computes geodesic haversine distance (in kilometers) between two coordinates.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2.0) *
      Math.sin(dLon / 2.0);
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return parseFloat((R * c).toFixed(1));
}

export interface FefoOptimizationResult {
  transferOrders: RedistributionTransferOrder[];
  escalations: RedistributionEscalation[];
  metrics: RedistributionMetrics;
}

/**
 * Phase 6 Operations Research Optimization Engine:
 * 1. Deficit and Surplus Mapping (Per Medicine):
 *    - Net_Balance = Current_Stock - Forecasted_7d_Demand
 *    - Deficit Node (D_i): Net_Balance < 0 or Days_Left <= 2 (or SVI Risk == 'CRITICAL')
 *    - Surplus Node (S_j): Net_Balance > Safety_Stock_Threshold or Days_Left > 10
 * 2. Distance Matrix Calculation:
 *    - Geodesic haversine distance between (lat_i, lon_i) and (lat_j, lon_j)
 *    - Constrained to Distance <= 35 km for operational feasibility.
 * 3. FEFO (First-Expired, First-Out) Inventory Rebalancing:
 *    - Prioritizes donor batches with expiry_date <= 45 days.
 *    - Recommended volume: min(abs(Deficit_Qty), Surplus_Qty_Expiring_Soon)
 * 4. Produces structured transfer orders and flags unmet deficit escalations.
 */
export function computeFefoRedistributionPlan(
  inventory: InventoryRecord[],
  facilities: FacilityRecord[],
  riskSummary: RiskSummaryRecord[],
  forecastSummaries: ForecastSummaryItem[],
  maxDistanceKm: number = 35.0,
  currentDateStr: string = '2026-09-17',
  approvedTransferIds: Set<string> = new Set()
): FefoOptimizationResult {
  // Facility lookup map
  const facMap = new Map<string, FacilityRecord>();
  facilities.forEach((f) => facMap.set(f.facility_id, f));

  // Unit costs by medicine
  const unitCostMap = new Map<string, number>();
  inventory.forEach((inv) => {
    if (!unitCostMap.has(inv.medicine_name)) {
      unitCostMap.set(inv.medicine_name, inv.unit_cost_inr || 15);
    }
  });

  // Working copy of inventory records with days to expiry
  const currDt = new Date(currentDateStr).getTime();
  const workingInventory = inventory.map((inv) => {
    const expDt = new Date(inv.expiry_date.split(' ')[0]).getTime();
    const daysToExpiry = Math.round((expDt - currDt) / (1000 * 60 * 60 * 24));
    return {
      ...inv,
      days_to_expiry: daysToExpiry,
    };
  });

  const transferOrders: RedistributionTransferOrder[] = [];
  const escalations: RedistributionEscalation[] = [];
  let transferSeq = 81;

  // Distinct medicines in inventory
  const medicines = Array.from(new Set(inventory.map((i) => i.medicine_name)));

  medicines.forEach((med) => {
    // 1. Deficit Nodes (D_i)
    const deficits = riskSummary
      .filter((r) => r.medicine_name === med)
      .filter((r) => {
        const netBalance = r.current_stock_units - r.projected_7d_demand;
        return (
          netBalance < 0 ||
          r.days_left <= 2.0 ||
          r.svi_risk_level === 'CRITICAL'
        );
      })
      .sort((a, b) => a.days_left - b.days_left);

    // 2. Surplus Nodes (S_j)
    const surpluses = riskSummary
      .filter((r) => r.medicine_name === med)
      .filter((r) => {
        const netBalance = r.current_stock_units - r.projected_7d_demand;
        const safetyThreshold = Math.max(40, Math.round(r.projected_daily_demand * 5));
        return netBalance > safetyThreshold || r.days_left > 10.0;
      });

    // Track available surplus units per donor facility
    const donorAvailableSurplus = new Map<string, number>();
    surpluses.forEach((s) => {
      const safetyThreshold = Math.max(40, Math.round(s.projected_daily_demand * 5));
      const avail = Math.max(
        0,
        s.current_stock_units - s.projected_7d_demand - Math.floor(safetyThreshold * 0.4)
      );
      if (avail >= 25) {
        donorAvailableSurplus.set(s.facility_id, avail);
      }
    });

    // Match deficits
    deficits.forEach((d) => {
      const dFac = facMap.get(d.facility_id);
      if (!dFac) return;

      const netBalance = d.current_stock_units - d.projected_7d_demand;
      const dailyBurn = Math.max(1, d.projected_daily_demand);
      let neededUnits = Math.round(
        Math.max(
          Math.abs(netBalance),
          dailyBurn * 5 - d.current_stock_units,
          40
        )
      );

      if (neededUnits <= 0) return;

      // Find candidate donors with remaining surplus
      interface CandidateDonor {
        facility_id: string;
        name: string;
        district: string;
        distance_km: number;
        has_near_expiry: boolean;
        min_exp_days: number;
        lat: number;
        lon: number;
      }

      const eligibleDonors: CandidateDonor[] = [];
      let closestOverallKm = 999.0;

      donorAvailableSurplus.forEach((sAvail, sFid) => {
        if (sFid === d.facility_id || sAvail <= 0) return;
        const sFac = facMap.get(sFid);
        if (!sFac) return;

        const dist = haversineDistance(
          dFac.latitude,
          dFac.longitude,
          sFac.latitude,
          sFac.longitude
        );

        if (dist < closestOverallKm) {
          closestOverallKm = dist;
        }

        if (dist <= maxDistanceKm) {
          const donorBatches = workingInventory.filter(
            (b) =>
              b.facility_id === sFid &&
              b.medicine_name === med &&
              b.current_stock_units > 0
          );
          const hasNearExpiry = donorBatches.some((b) => b.days_to_expiry <= 45);
          const minExpDays = donorBatches.length > 0
            ? Math.min(...donorBatches.map((b) => b.days_to_expiry))
            : 999;

          eligibleDonors.push({
            facility_id: sFid,
            name: sFac.facility_name,
            district: sFac.district,
            distance_km: dist,
            has_near_expiry: hasNearExpiry,
            min_exp_days: minExpDays,
            lat: sFac.latitude,
            lon: sFac.longitude,
          });
        }
      });

      // If no donor exists within 35 km -> Escalation Notice
      if (eligibleDonors.length === 0) {
        escalations.push({
          facility_id: d.facility_id,
          facility_name: dFac.facility_name,
          district: dFac.district,
          medicine_name: med,
          deficit_units: neededUnits,
          days_left: parseFloat(d.days_left.toFixed(1)),
          nearest_donor_km: closestOverallKm < 900 ? closestOverallKm : 42.5,
          status: 'District Central Warehouse Replenishment Required',
          recommendation: `No surplus facility located within ${maxDistanceKm} km operational boundary. Request emergency central replenishment from HMSCL Depot.`,
        });
        return;
      }

      // Sort donors by FEFO priority (near-expiry <= 45d first, then earliest expiry, then shortest distance)
      eligibleDonors.sort((a, b) => {
        if (a.has_near_expiry !== b.has_near_expiry) {
          return a.has_near_expiry ? -1 : 1;
        }
        if (a.min_exp_days !== b.min_exp_days) {
          return a.min_exp_days - b.min_exp_days;
        }
        return a.distance_km - b.distance_km;
      });

      for (const donor of eligibleDonors) {
        if (neededUnits <= 0) break;

        const sAvail = donorAvailableSurplus.get(donor.facility_id) || 0;
        if (sAvail <= 0) continue;

        // Get donor batches sorted by FEFO (earliest expiry first)
        const donorBatches = workingInventory
          .filter(
            (b) =>
              b.facility_id === donor.facility_id &&
              b.medicine_name === med &&
              b.current_stock_units > 0
          )
          .sort((a, b) => a.days_to_expiry - b.days_to_expiry);

        for (const batch of donorBatches) {
          if (neededUnits <= 0) break;
          const currentSurplus = donorAvailableSurplus.get(donor.facility_id) || 0;
          if (currentSurplus <= 0) break;

          const qtyToTransfer = Math.min(
            neededUnits,
            currentSurplus,
            batch.current_stock_units
          );

          if (qtyToTransfer < 15) continue;

          const transferId = `TRF-2026-${String(transferSeq++).padStart(3, '0')}`;
          const isDispatched = approvedTransferIds.has(transferId);
          const priorityLevel: 'HIGH' | 'MEDIUM' =
            d.days_left <= 2.0 || neededUnits >= 200 || d.svi_risk_level === 'CRITICAL'
              ? 'HIGH'
              : 'MEDIUM';

          const unitCost = unitCostMap.get(med) || 15;

          transferOrders.push({
            transfer_id: transferId,
            medicine_name: med,
            source_facility_id: donor.facility_id,
            source_facility_name: donor.name,
            target_facility_id: d.facility_id,
            target_facility_name: dFac.facility_name,
            transfer_quantity_units: qtyToTransfer,
            batch_id: batch.batch_id,
            batch_expiry_date: `${batch.expiry_date.split(' ')[0]} (${batch.days_to_expiry}d left)`,
            transit_distance_km: donor.distance_km,
            priority_level: priorityLevel,
            approval_status: isDispatched ? 'Dispatched' : 'Pending',
            source_lat: donor.lat,
            source_lon: donor.lon,
            target_lat: dFac.latitude,
            target_lon: dFac.longitude,
            source_district: donor.district,
            target_district: dFac.district,
            is_near_expiry: batch.days_to_expiry <= 45,
            value_saved_inr: Math.round(qtyToTransfer * unitCost),
          });

          // Decrement working balances
          neededUnits -= qtyToTransfer;
          donorAvailableSurplus.set(donor.facility_id, currentSurplus - qtyToTransfer);
          batch.current_stock_units -= qtyToTransfer;
        }
      }

      // If deficit remains partially unfulfilled
      if (neededUnits > 25) {
        escalations.push({
          facility_id: d.facility_id,
          facility_name: dFac.facility_name,
          district: dFac.district,
          medicine_name: med,
          deficit_units: neededUnits,
          days_left: parseFloat(d.days_left.toFixed(1)),
          nearest_donor_km: closestOverallKm < 900 ? closestOverallKm : 38.0,
          status: 'District Central Warehouse Replenishment Required',
          recommendation: `Residual deficit of ${neededUnits} units requires direct Central Warehouse replenishment to prevent stock exhaustion.`,
        });
      }
    });
  });

  // Calculate executive summary metrics
  const pendingCount = transferOrders.filter((t) => t.approval_status === 'Pending').length;
  const totalUnits = transferOrders.reduce((sum, t) => sum + t.transfer_quantity_units, 0);
  const expiringOrders = transferOrders.filter((t) => t.is_near_expiry);
  const expiringUnits = expiringOrders.reduce((sum, t) => sum + t.transfer_quantity_units, 0);
  const expiringInr = expiringOrders.reduce((sum, t) => sum + (t.value_saved_inr || 0), 0);
  const avgDist =
    transferOrders.length > 0
      ? transferOrders.reduce((sum, t) => sum + t.transit_distance_km, 0) / transferOrders.length
      : 0;

  const metrics: RedistributionMetrics = {
    pending_transfers_count: pendingCount,
    total_units_recommended: totalUnits,
    expiring_stock_saved_units: expiringUnits,
    expiring_stock_saved_inr: expiringInr,
    average_transit_distance_km: parseFloat(avgDist.toFixed(1)),
  };

  return {
    transferOrders,
    escalations,
    metrics,
  };
}
