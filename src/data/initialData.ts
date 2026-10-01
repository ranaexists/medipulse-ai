import { InventoryItem, AshaReport, ForecastResults, RedistributionItem } from '../types';

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    phc_id: "PHC-KAR-01",
    phc_name: "Gharaunda Community Health Centre",
    district: "Karnal",
    medicine: "Amoxicillin 500mg",
    stock: 140,
    min_thresh: 500,
    status: "Critical",
    days_left: 2,
    batch: "AMX-2024-B1"
  },
  {
    phc_id: "PHC-KAR-02",
    phc_name: "Indri Primary Health Centre",
    district: "Karnal",
    medicine: "ORS Packets (WHO Formula)",
    stock: 40,
    min_thresh: 300,
    status: "Stockout Imminent",
    days_left: 1,
    batch: "ORS-24-99"
  },
  {
    phc_id: "PHC-KUR-01",
    phc_name: "Pehowa Civil Hospital Annex",
    district: "Kurukshetra",
    medicine: "Paracetamol 500mg",
    stock: 1200,
    min_thresh: 400,
    status: "Adequate",
    days_left: 24,
    batch: "PCM-2023-A9"
  },
  {
    phc_id: "PHC-KUR-02",
    phc_name: "Thanesar Rural Health Centre",
    district: "Kurukshetra",
    medicine: "Metformin 500mg",
    stock: 25,
    min_thresh: 200,
    status: "Critical",
    days_left: 2,
    batch: "MET-24-K2"
  },
  {
    phc_id: "PHC-PAN-01",
    phc_name: "Samalkha Sub-District Hospital",
    district: "Panipat",
    medicine: "Artemether-Lumefantrine",
    stock: 15,
    min_thresh: 120,
    status: "Ghost Stock Flagged",
    days_left: 1,
    batch: "ALU-24-03"
  },
  {
    phc_id: "PHC-PAN-02",
    phc_name: "Israna Community Health Centre",
    district: "Panipat",
    medicine: "Oxytocin Injection 10 IU",
    stock: 350,
    min_thresh: 100,
    status: "Adequate (Near Expiry)",
    days_left: 45,
    batch: "OXY-23-EX"
  }
];

export const INITIAL_ASHA_REPORTS: AshaReport[] = [
  {
    id: "ASHA-RPT-1042",
    timestamp: "2026-09-17 06:45 AM",
    asha_name: "Sunita Devi (Worker #408)",
    phc_id: "PHC-KAR-02",
    medicine: "ORS Packets",
    reported_issue: "Stockout reported at Indri Sub-centre. 14 diarrheal fever pediatric patients turned away empty-handed this morning.",
    audio_file: "voice_note_1042_indri.wav",
    ground_vs_system_status: "Discrepancy (Portal shows 300, Ground is 0)",
    urgency: "High"
  },
  {
    id: "ASHA-RPT-1041",
    timestamp: "2026-09-16 04:30 PM",
    asha_name: "Rekha Sharma (Worker #312)",
    phc_id: "PHC-PAN-01",
    medicine: "Artemether-Lumefantrine",
    reported_issue: "Sub-centre pharmacy locked; emergency stock for malaria fever exhausted. Patient count surged 40% after weekend rains.",
    audio_file: "voice_note_1041_panipat.wav",
    ground_vs_system_status: "Ghost Inventory Alert",
    urgency: "Critical"
  }
];

export const INITIAL_FORECAST: ForecastResults = {
  model_version: "v1.4-NHM-EarlyWarning",
  district_scope: "Haryana Pilot (Karnal, Kurukshetra, Panipat)",
  projected_7d_stockout_risk: 18.4,
  peak_disease_vector: "Acute Diarrheal Outbreak + Viral Pyrexia",
  lead_time_buffer_days: 4.5
};

export const INITIAL_REDISTRIBUTION: RedistributionItem[] = [
  {
    transfer_id: "TRF-2026-001",
    donor_facility: "Pehowa Civil Hospital Annex (Kurukshetra)",
    recipient_facility: "Gharaunda CHC (Karnal)",
    medicine: "Amoxicillin 500mg",
    units_to_transfer: 350,
    fefo_expiry: "2026-11-30 (74 days remaining)",
    transit_km: 42.6,
    status: "Awaiting DHO Authorization"
  },
  {
    transfer_id: "TRF-2026-002",
    donor_facility: "Israna CHC (Panipat)",
    recipient_facility: "Samalkha Sub-District Hospital (Panipat)",
    medicine: "Oxytocin Injection 10 IU",
    units_to_transfer: 120,
    fefo_expiry: "2026-10-15 (28 days remaining)",
    transit_km: 19.1,
    status: "Awaiting DHO Authorization"
  },
  {
    transfer_id: "TRF-2026-003",
    donor_facility: "Thanesar Central Stores (Kurukshetra)",
    recipient_facility: "Indri PHC (Karnal)",
    medicine: "ORS Packets (WHO Formula)",
    units_to_transfer: 200,
    fefo_expiry: "2027-02-15",
    transit_km: 31.4,
    status: "In-Transit (Logistics Dispatched)"
  }
];
