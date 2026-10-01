import React, { useState, useMemo } from 'react';
import {
  Truck,
  CheckCircle,
  Clock,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  Search,
  Layers,
  MapPin,
  ShieldAlert,
  Building2,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import {
  RedistributionTransferOrder,
  RedistributionEscalation,
  RedistributionMetrics,
  FacilityRecord,
} from '../../types';
import { generateClinicalBrief, ClinicalBrief } from '../../services/geminiService';

interface InterFacilityRedistributionProps {
  transferOrders: RedistributionTransferOrder[];
  escalations: RedistributionEscalation[];
  metrics: RedistributionMetrics;
  facilities: FacilityRecord[];
  onApproveTransfer: (transferId: string) => void;
  onAuthorizeAll: () => void;
}

export const InterFacilityRedistribution: React.FC<InterFacilityRedistributionProps> = ({
  transferOrders,
  escalations,
  metrics,
  facilities,
  onApproveTransfer,
  onAuthorizeAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All Districts');
  const [hoveredTransfer, setHoveredTransfer] = useState<RedistributionTransferOrder | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<RedistributionTransferOrder | null>(null);
  const [lastDispatchedId, setLastDispatchedId] = useState<string | null>(null);

  // Phase 7: Gemini Clinical Brief State
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [clinicalBrief, setClinicalBrief] = useState<{
    brief: ClinicalBrief;
    isLive: boolean;
    message: string;
  } | null>(null);
  const [copiedBrief, setCopiedBrief] = useState(false);

  // Filtered transfer orders
  const filteredOrders = useMemo(() => {
    return transferOrders.filter((order) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        order.medicine_name.toLowerCase().includes(q) ||
        order.source_facility_name.toLowerCase().includes(q) ||
        order.target_facility_name.toLowerCase().includes(q) ||
        order.transfer_id.toLowerCase().includes(q);

      const matchDistrict =
        districtFilter === 'All Districts' ||
        order.source_district === districtFilter ||
        order.target_district === districtFilter;

      return matchQuery && matchDistrict;
    });
  }, [transferOrders, searchQuery, districtFilter]);

  const handleApprove = (transferId: string) => {
    setLastDispatchedId(transferId);
    onApproveTransfer(transferId);
  };

  // Map projections for geospatial view (Haryana cluster: lat 29.35 - 30.20, lon 76.70 - 77.15)
  const minLat = 29.35;
  const maxLat = 30.22;
  const minLon = 76.70;
  const maxLon = 77.15;
  const svgWidth = 720;
  const svgHeight = 420;

  const projectCoord = (lat: number, lon: number) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * (svgWidth - 100) + 50;
    const y = svgHeight - (((lat - minLat) / (maxLat - minLat)) * (svgHeight - 80) + 40);
    return { x, y };
  };

  // Unique donors and recipients
  const donorFacilities = useMemo(() => {
    const map = new Map<string, { id: string; name: string; district: string; lat: number; lon: number; ordersCount: number }>();
    transferOrders.forEach((o) => {
      if (o.source_lat && o.source_lon) {
        if (!map.has(o.source_facility_id)) {
          map.set(o.source_facility_id, {
            id: o.source_facility_id,
            name: o.source_facility_name,
            district: o.source_district || 'District Hub',
            lat: o.source_lat,
            lon: o.source_lon,
            ordersCount: 1,
          });
        } else {
          const item = map.get(o.source_facility_id)!;
          item.ordersCount += 1;
        }
      }
    });
    return Array.from(map.values());
  }, [transferOrders]);

  const recipientFacilities = useMemo(() => {
    const map = new Map<string, { id: string; name: string; district: string; lat: number; lon: number; ordersCount: number }>();
    transferOrders.forEach((o) => {
      if (o.target_lat && o.target_lon) {
        if (!map.has(o.target_facility_id)) {
          map.set(o.target_facility_id, {
            id: o.target_facility_id,
            name: o.target_facility_name,
            district: o.target_district || 'District Hub',
            lat: o.target_lat,
            lon: o.target_lon,
            ordersCount: 1,
          });
        } else {
          const item = map.get(o.target_facility_id)!;
          item.ordersCount += 1;
        }
      }
    });
    return Array.from(map.values());
  }, [transferOrders]);

  return (
    <div className="space-y-5">
      {/* 1. Executive Transfer Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Pending Inter-PHC Transfers
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics.pending_transfers_count}
            <span className="text-xs font-normal text-slate-500 ml-1.5">orders</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Awaiting DHO Authorization</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Rebalancing Volume
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics.total_units_recommended.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1.5">units</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Targeting Critical Deficit Nodes</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Expiring Stock Saved (FEFO)
          </div>
          <div className="text-2xl font-bold text-[#15803D]">
            {metrics.expiring_stock_saved_units.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1.5">units</span>
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            ₹{metrics.expiring_stock_saved_inr.toLocaleString()} Protected (&le;45d Expiry)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Avg. Inter-Facility Transit
          </div>
          <div className="text-2xl font-bold text-sky-700">
            {metrics.average_transit_distance_km.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 ml-1.5">km</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Constrained to &le;35 km Cluster Boundary</div>
        </div>
      </div>

      {/* Phase 7: Clinical & Rebalancing Intelligence Brief (Gemini 2.5 Flash) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-700" />
              <span>Clinical & Rebalancing Intelligence Brief</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Powered by Gemini 2.5 Flash • Epidemiological validation and supply chain feasibility audit of proposed transfers
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setIsBriefLoading(true);
              try {
                const transfersSummary = transferOrders
                  .slice(0, 4)
                  .map((t) => `${t.quantity_units}u of ${t.medicine_name} from ${t.source_facility_name} to ${t.target_facility_name} (${t.distance_km}km)`)
                  .join('; ');
                const res = await generateClinicalBrief(
                  'Redistribution Plan Validation',
                  districtFilter,
                  'ORS Packets, Paracetamol, Amoxicillin',
                  transfersSummary
                );
                setClinicalBrief(res);
              } finally {
                setIsBriefLoading(false);
              }
            }}
            disabled={isBriefLoading}
            className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{isBriefLoading ? 'Analyzing Corridors...' : 'Ask Gemini: Generate Executive Clinical Brief'}</span>
          </button>
        </div>

        {clinicalBrief && (
          <div className="p-4 bg-[#0F172A] text-slate-100 rounded-lg border border-slate-800 shadow-sm text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  Executive Clinical Brief — {districtFilter}
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
                  3. Prescriptive Validation (FEFO Rebalancing Audit)
                </div>
                <p className="text-emerald-200/90 leading-relaxed text-[11px]">
                  {clinicalBrief.brief.prescriptive_validation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Geospatial Transfer Flow Map Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Geospatial Transfer Flow Map
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing directed rebalancing arcs connecting Surplus Donor facilities to Deficit Recipient health centers (&le;35 km operational limit)
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#15803D] inline-block"></span>
              <span className="text-slate-600 font-medium">Donor Facility (Surplus)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#B91C1C] inline-block"></span>
              <span className="text-slate-600 font-medium">Deficit Facility (Stockout Risk)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-sky-600 inline-block"></span>
              <span className="text-slate-600 font-medium">Transfer Corridor</span>
            </div>
          </div>
        </div>

        {/* SVG Map Canvas */}
        <div className="relative w-full overflow-hidden bg-slate-50 border border-slate-200 rounded-md">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-[380px] select-none"
          >
            {/* Grid Pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

            {/* Region boundary approximations */}
            <text x="70" y="70" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              KURUKSHETRA DISTRICT
            </text>
            <text x="260" y="210" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              KARNAL DISTRICT
            </text>
            <text x="440" y="360" fill="#94A3B8" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              PANIPAT DISTRICT
            </text>

            {/* Transfer Corridors (Lines/Arcs) */}
            {transferOrders.map((t) => {
              if (!t.source_lat || !t.source_lon || !t.target_lat || !t.target_lon) return null;
              const p1 = projectCoord(t.source_lat, t.source_lon);
              const p2 = projectCoord(t.target_lat, t.target_lon);
              const isHovered = hoveredTransfer?.transfer_id === t.transfer_id;
              const isDispatched = t.approval_status === 'Dispatched';

              // Midpoint for curve and label
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2 - 15;

              return (
                <g
                  key={t.transfer_id}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredTransfer(t)}
                  onMouseLeave={() => setHoveredTransfer(null)}
                  onClick={() => setSelectedTransfer(t)}
                >
                  {/* Outer glow line on hover */}
                  {isHovered && (
                    <path
                      d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="6"
                      strokeOpacity="0.25"
                    />
                  )}
                  {/* Main Route Arc */}
                  <path
                    d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke={isDispatched ? '#15803D' : '#0284C7'}
                    strokeWidth={isHovered ? 3 : 2}
                    strokeDasharray={isDispatched ? 'none' : '4 3'}
                  />

                  {/* Route midpoint badge */}
                  <rect
                    x={midX - 32}
                    y={midY - 9}
                    width="64"
                    height="18"
                    rx="3"
                    fill="#FFFFFF"
                    stroke={isHovered ? '#0284C7' : '#CBD5E1'}
                    strokeWidth="1"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {t.transit_distance_km} km
                  </text>
                </g>
              );
            })}

            {/* Recipient Nodes (Red) */}
            {recipientFacilities.map((fac) => {
              const p = projectCoord(fac.lat, fac.lon);
              return (
                <g key={`recip-${fac.id}`}>
                  <circle cx={p.x} cy={p.y} r="8" fill="#B91C1C" opacity="0.9" />
                  <circle cx={p.x} cy={p.y} r="3" fill="#FFFFFF" />
                  <text
                    x={p.x + 12}
                    y={p.y + 4}
                    fontSize="10"
                    fontWeight="700"
                    fill="#991B1B"
                  >
                    {fac.name.split(' (')[0]}
                  </text>
                </g>
              );
            })}

            {/* Donor Nodes (Green) */}
            {donorFacilities.map((fac) => {
              const p = projectCoord(fac.lat, fac.lon);
              return (
                <g key={`donor-${fac.id}`}>
                  <circle cx={p.x} cy={p.y} r="9" fill="#15803D" opacity="0.95" />
                  <circle cx={p.x} cy={p.y} r="3.5" fill="#FFFFFF" />
                  <text
                    x={p.x - 12}
                    y={p.y - 12}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#166534"
                  >
                    {fac.name.split(' (')[0]}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Overlay Card */}
          {hoveredTransfer && (
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded p-3 text-xs shadow-md max-w-xs space-y-1.5 pointer-events-none">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                <span className="font-mono font-bold text-slate-900">{hoveredTransfer.transfer_id}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    hoveredTransfer.approval_status === 'Dispatched'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {hoveredTransfer.approval_status}
                </span>
              </div>
              <div className="text-slate-700">
                <strong>Medicine:</strong> {hoveredTransfer.medicine_name} ({hoveredTransfer.transfer_quantity_units} units)
              </div>
              <div className="text-slate-600 text-[11px]">
                <div className="text-emerald-800 font-semibold">From: {hoveredTransfer.source_facility_name}</div>
                <div className="text-red-800 font-semibold">To: {hoveredTransfer.target_facility_name}</div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>Distance: <strong>{hoveredTransfer.transit_distance_km} km</strong></span>
                <span>Batch: {hoveredTransfer.batch_id}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Route Matrix & Transfer Action Table Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Route Matrix & Transfer Action Table
            </h3>
            <p className="text-xs text-slate-500">
              Direct mathematical pairing of surplus donor health centers to immediate deficit centers (&le;35 km)
            </p>
          </div>

          <button
            type="button"
            onClick={onAuthorizeAll}
            className="bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Authorize All Pending Transfers</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by medicine, donor facility, recipient facility, or Transfer ID..."
              className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-sky-600 focus:bg-white"
            />
          </div>

          <div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-sky-600 focus:bg-white cursor-pointer"
            >
              <option value="All Districts">All Districts</option>
              <option value="Karnal">Karnal</option>
              <option value="Kurukshetra">Kurukshetra</option>
              <option value="Panipat">Panipat</option>
            </select>
          </div>
        </div>

        {/* Action Table */}
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Medicine SKU & ID</th>
                <th className="py-2.5 px-3">From (Donor CHC/PHC)</th>
                <th className="py-2.5 px-3">To (Deficit PHC)</th>
                <th className="py-2.5 px-3 text-right">Transfer Units</th>
                <th className="py-2.5 px-3">Batch Expiry</th>
                <th className="py-2.5 px-3 text-right">Distance</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredOrders.map((order) => {
                const isDispatched = order.approval_status === 'Dispatched';
                return (
                  <tr
                    key={order.transfer_id}
                    className={`hover:bg-slate-50 ${isDispatched ? 'bg-emerald-50/30' : ''}`}
                  >
                    <td className="py-2.5 px-3">
                      {order.priority_level === 'HIGH' ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#B91C1C] border border-red-200">
                          HIGH
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-[#B45309] border border-amber-200">
                          MED
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{order.medicine_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{order.transfer_id}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{order.source_facility_name}</div>
                      <div className="text-[10px] text-slate-500">{order.source_district}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{order.target_facility_name}</div>
                      <div className="text-[10px] text-[#B91C1C] font-semibold">Stockout Imminent (&le;48h)</div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {order.transfer_quantity_units.toLocaleString()} u
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-mono text-slate-700 text-[11px] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                        <span>{order.batch_expiry_date}</span>
                      </div>
                      {order.is_near_expiry && (
                        <span className="text-[10px] font-semibold text-[#B45309] bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                          FEFO &le;45d
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800">
                      {order.transit_distance_km} km
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {isDispatched ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-[#15803D] font-bold text-[10px] border border-emerald-300">
                          <CheckCircle className="w-3 h-3" />
                          <span>Dispatched</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApprove(order.transfer_id)}
                          className="bg-sky-700 hover:bg-sky-800 text-white font-semibold px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          Approve & Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-500 text-xs">
                    No transfer orders match the specified filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Escalation Notice: District Central Warehouse Replenishment Required */}
      {escalations.length > 0 && (
        <div className="space-y-3">
          <div className="bg-red-50 border-l-4 border-[#B91C1C] border-t border-r border-b border-red-200 rounded p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#B91C1C] text-sm">
              <ShieldAlert className="w-4 h-4 text-[#B91C1C]" />
              <span>District Central Warehouse Replenishment Required ({escalations.length} Unmet Deficit Nodes)</span>
            </div>
            <div className="text-slate-700 mt-1 leading-relaxed">
              The following health centers exhibit critical stock depletion where <strong>no eligible donor facility exists within the 35 km operational radius</strong>. To prevent catastrophic stockouts without violating transport feasibility, central buffer stock must be expedited from the HMSCL Central Depot.
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Central Warehouse Escalation Register
              </h4>
              <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Emergency Priority Tier
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {escalations.map((esc) => (
                <div
                  key={`${esc.facility_id}-${esc.medicine_name}`}
                  className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{esc.facility_name}</div>
                      <div className="text-[11px] text-slate-500">District: {esc.district}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-red-100 text-[#B91C1C] font-bold rounded text-[10px]">
                      {esc.medicine_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-500">Unmet Deficit:</span>{' '}
                      <strong className="text-slate-900">{esc.deficit_units} units</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Stock Left:</span>{' '}
                      <strong className="text-[#B91C1C]">{esc.days_left} days</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Nearest Center:</span>{' '}
                      <strong className="text-amber-800">{esc.nearest_donor_km} km</strong> (&gt;35 km operational constraint)
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-amber-50/60 p-2 rounded border border-amber-200/60">
                    <strong>Protocol Action:</strong> {esc.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
