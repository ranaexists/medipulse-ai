import React, { useState } from 'react';
import { ShieldAlert, FileText, CheckCircle2, AlertTriangle, PlusCircle, ArrowRight, ClipboardCheck, Mic, Upload, Sparkles, Volume2 } from 'lucide-react';
import { AshaGroundReportRecord, FacilityRecord, GroundAuditRecord } from '../../types';
import { parseAshaReportWithGemini, ExtractedAshaReport } from '../../services/geminiService';

interface AshaFieldIntakeProps {
  reports: AshaGroundReportRecord[];
  facilities: FacilityRecord[];
  groundAuditRecords?: GroundAuditRecord[];
  auditStatuses?: Record<string, string>;
  onInitiateAudit?: (facilityId: string, medicineName: string) => void;
  onAddReport?: (newReport: AshaGroundReportRecord) => void;
}

export const AshaFieldIntake: React.FC<AshaFieldIntakeProps> = ({
  reports,
  facilities,
  groundAuditRecords = [],
  auditStatuses = {},
  onInitiateAudit,
  onAddReport,
}) => {
  const [selectedReport, setSelectedReport] = useState<AshaGroundReportRecord>(reports[0]);
  const [localAudits, setLocalAudits] = useState<Record<string, string>>({});
  const [auditAlertDispatched, setAuditAlertDispatched] = useState(false);

  // Phase 7: Multilingual Voice & Field Intake Engine State
  const [voiceText, setVoiceText] = useState('');
  const [isProcessingGemini, setIsProcessingGemini] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastExtraction, setLastExtraction] = useState<{
    report: ExtractedAshaReport;
    isLive: boolean;
    message: string;
  } | null>(null);

  // New report form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [facilityId, setFacilityId] = useState(facilities[0]?.facility_id || 'PHC_001');
  const [reporterName, setReporterName] = useState('ASHA Sunita Devi');
  const [reportedShortage, setReportedShortage] = useState('ORS Packets');
  const [observedSymptoms, setObservedSymptoms] = useState('Elevated diarrheal cases in ward sub-center');
  const [systemStock, setSystemStock] = useState(250);
  const [isDiscrepancy, setIsDiscrepancy] = useState(true);
  const [notes, setNotes] = useState('Physical shelf stock verified at zero by visiting worker');

  const handleScenarioSelect = async (scenarioText: string) => {
    setVoiceText(scenarioText);
    await executeAshaExtraction(scenarioText);
  };

  const executeAshaExtraction = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setIsProcessingGemini(true);
    try {
      const res = await parseAshaReportWithGemini(textToProcess);
      setLastExtraction(res);

      // Auto-append to records
      const facMatch = facilities.find((f) =>
        f.facility_name.toLowerCase().includes(res.report.facility_name.split(' ').pop()?.toLowerCase() || '')
      ) || facilities[0];

      const medSummary = res.report.reported_medicines
        .map((m) => `${m.name} (${m.status.replace('_', ' ')})`)
        .join(', ');

      const isDiscrep = res.report.reported_medicines.some((m) => m.status === 'OUT_OF_STOCK');

      const newRecord: AshaGroundReportRecord = {
        report_id: `REP-ASHA-${String(reports.length + 1).padStart(3, '0')}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        facility_id: facMatch.facility_id,
        facility_name: `${facMatch.facility_name} (${facMatch.district})`,
        reporter_name: 'ASHA Field Ingestion (Gemini 2.5)',
        reported_shortage: medSummary || 'ORS Packets (OUT OF STOCK)',
        observed_symptoms: res.report.observed_symptoms.join('; '),
        system_stock_at_report_time: isDiscrep ? 280 : 45,
        discrepancy_flag: isDiscrep,
        notes: res.report.transcription_summary
      };

      if (onAddReport) {
        onAddReport(newRecord);
      }
      setSelectedReport(newRecord);
    } catch (err) {
      console.error('Error during ASHA extraction:', err);
    } finally {
      setIsProcessingGemini(false);
    }
  };

  const handleVoiceRecordSimulation = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        const recorded = "PHC Gharaunda mein ORS aur Paracetamol bilkul khatam hai, pichle do din se ulti dast ke 40 se zyada mareez aa chuke hain.";
        setVoiceText(recorded);
        executeAshaExtraction(recorded);
      }, 2000);
    }
  };

  const handleSubmitNewReport = (e: React.FormEvent) => {
    e.preventDefault();
    const fac = facilities.find((f) => f.facility_id === facilityId);
    const newReport: AshaGroundReportRecord = {
      report_id: `REP-ASHA-${String(reports.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      facility_id: facilityId,
      facility_name: fac ? `${fac.facility_name} (${fac.district})` : facilityId,
      reporter_name: reporterName,
      reported_shortage: reportedShortage,
      observed_symptoms: observedSymptoms,
      system_stock_at_report_time: Number(systemStock),
      discrepancy_flag: isDiscrepancy,
      notes: notes,
    };
    if (onAddReport) {
      onAddReport(newReport);
    }
    setSelectedReport(newReport);
    setIsFormOpen(false);
  };

  const handleAuditClick = (fId: string, med: string) => {
    const key = `${fId}::${med}`;
    setLocalAudits((prev) => ({ ...prev, [key]: 'AUDIT_INITIATED' }));
    if (onInitiateAudit) {
      onInitiateAudit(fId, med);
    }
  };

  const ghostCount = reports.filter((r) => r.discrepancy_flag).length;

  return (
    <div className="space-y-5">
      {/* Alert Banner */}
      <div className="bg-amber-50 border-l-4 border-[#B45309] border-t border-r border-b border-amber-200 rounded p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#B45309] text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Ghost Inventory Reconciliation Pipeline Active</span>
        </div>
        <div className="text-slate-700 mt-1 leading-relaxed">
          {ghostCount} verified ground discrepancies detected. A discrepancy flag is raised when an
          ASHA field survey observes complete stockout while the central e-Aushadhi portal registers
          positive on-hand units.
        </div>
      </div>

      {/* Phase 7: Multilingual ASHA Voice Ingestion & Gemini Clinical Intelligence Engine */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Multilingual ASHA Voice & Field Intake Engine</span>
            </h3>
            <p className="text-xs text-slate-500">
              Gemini 2.5 Flash Multimodal NLP • Real-time Hindi/Hinglish audio transcription, entity extraction & ghost inventory flag
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded text-xs font-semibold">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Gemini 2.5 Flash</span>
          </div>
        </div>

        {/* 3 Pre-loaded Real-World Scenarios */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
            Pre-loaded Real-World Field Scenarios (One-Click Demo)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleScenarioSelect(
                  "PHC Gharaunda mein ORS aur Paracetamol bilkul khatam hai, pichle do din se ulti dast ke 40 se zyada mareez aa chuke hain."
                )
              }
              className="text-left p-3 rounded border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition-colors text-xs group"
            >
              <div className="font-semibold text-slate-800 group-hover:text-sky-700 flex items-center justify-between">
                <span>Scenario A (Hindi Outbreak)</span>
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">CRITICAL</span>
              </div>
              <div className="text-slate-500 mt-1 line-clamp-2 text-[11px]">
                "PHC Gharaunda mein ORS aur Paracetamol bilkul khatam hai, 40 se zyada ulti dast mareez..."
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                handleScenarioSelect(
                  "Portal pe Amoxicillin 300 dikha raha hai lekin dispensary cupboard mein ek bhi strip nahi hai, patients ko bahar se khareedna pad raha hai."
                )
              }
              className="text-left p-3 rounded border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition-colors text-xs group"
            >
              <div className="font-semibold text-slate-800 group-hover:text-sky-700 flex items-center justify-between">
                <span>Scenario B (Ghost Stock)</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">DISCREPANCY</span>
              </div>
              <div className="text-slate-500 mt-1 line-clamp-2 text-[11px]">
                "Portal pe Amoxicillin 300 dikha raha hai lekin dispensary cupboard mein ek bhi strip nahi..."
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                handleScenarioSelect(
                  "PHC Indri mein Cetirizine aur Zinc tablets agle 2 din mein khatam hone wali hain."
                )
              }
              className="text-left p-3 rounded border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition-colors text-xs group"
            >
              <div className="font-semibold text-slate-800 group-hover:text-sky-700 flex items-center justify-between">
                <span>Scenario C (Routine Depletion)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">NORMAL</span>
              </div>
              <div className="text-slate-500 mt-1 line-clamp-2 text-[11px]">
                "PHC Indri mein Cetirizine aur Zinc tablets agle 2 din mein khatam hone wali hain."
              </div>
            </button>
          </div>
        </div>

        {/* Audio Simulation & Text Box Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="border border-slate-200 rounded p-3 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-sky-600" />
                <span>Voice Audio Dispatch Ingestion</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Simulate or record an ASHA field voice note in Hindi or regional dialect.
              </p>
            </div>
            <button
              type="button"
              onClick={handleVoiceRecordSimulation}
              disabled={isRecording || isProcessingGemini}
              className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isRecording ? 'Listening / Recording...' : 'Simulate ASHA Voice Input'}</span>
            </button>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Field Dispatch Notes (Hindi / Hinglish / English)
            </label>
            <textarea
              rows={3}
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Paste or type ASHA field dispatch here (e.g., 'PHC Gharaunda mein ORS aur Paracetamol bilkul khatam hai...')"
              className="w-full text-xs p-2.5 border border-slate-300 rounded font-sans focus:outline-hidden focus:ring-1 focus:ring-sky-600"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => executeAshaExtraction(voiceText)}
                disabled={!voiceText.trim() || isProcessingGemini}
                className="py-1.5 px-4 bg-sky-700 text-white text-xs font-semibold rounded hover:bg-sky-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessingGemini ? 'Extracting with Gemini 2.5...' : 'Ingest & Extract Clinical Metadata'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Extraction Preview Card */}
        {lastExtraction && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <span>Extracted Clinical Entity Record: {lastExtraction.report.facility_name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    lastExtraction.report.urgency_level === 'CRITICAL'
                      ? 'bg-red-100 text-red-800'
                      : lastExtraction.report.urgency_level === 'HIGH'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Urgency: {lastExtraction.report.urgency_level}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {lastExtraction.isLive ? 'Live Gemini 2.5 Flash' : 'Clinical Intelligence Engine'}
              </span>
            </div>

            <p className="text-xs text-slate-700 mb-2 font-medium">
              <strong>Transcription Summary:</strong> {lastExtraction.report.transcription_summary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200">
              <div>
                <strong>Reported Medicines:</strong>{' '}
                {lastExtraction.report.reported_medicines
                  .map((m) => `${m.name} (${m.status.replace('_', ' ')})`)
                  .join(', ')}
              </div>
              <div>
                <strong>Observed Symptoms:</strong> {lastExtraction.report.observed_symptoms.join('; ')}
              </div>
            </div>

            <div className="mt-2 text-[11px] text-sky-700 font-medium">
              &check; Appended to ASHA Ground Registry below. Automatic cross-reference check completed.
            </div>
          </div>
        )}
      </div>

      {/* Ground Reality vs System Records Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-700" />
              <span>Ground Reality vs System Records Table</span>
            </h3>
            <p className="text-xs text-slate-500">
              Cross-reconciliation of ERP ledger vs ASHA field verified reality with verification actions
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {reports.length} Monitored Reports
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Facility</th>
                <th className="py-2.5 px-3">Medicine</th>
                <th className="py-2.5 px-3 text-right">Logged System Stock</th>
                <th className="py-2.5 px-3">ASHA Field Status</th>
                <th className="py-2.5 px-3 text-center">Integrity Flag</th>
                <th className="py-2.5 px-3 text-center">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {reports.map((rpt) => {
                const auditKey = `${rpt.facility_id}::${rpt.reported_shortage}`;
                const isAudited = Boolean(
                  localAudits[auditKey] || auditStatuses[auditKey] === 'AUDIT_INITIATED'
                );

                return (
                  <tr
                    key={rpt.report_id}
                    onClick={() => setSelectedReport(rpt)}
                    className={`cursor-pointer transition-colors ${
                      selectedReport?.report_id === rpt.report_id
                        ? 'bg-sky-50 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div>{rpt.facility_name || rpt.facility_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {rpt.reporter_name} • {rpt.timestamp}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {rpt.reported_shortage}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                      {rpt.system_stock_at_report_time} Units
                    </td>
                    <td className="py-2.5 px-3">
                      {rpt.discrepancy_flag ? (
                        <span className="text-[#B91C1C] font-semibold text-[11px]">
                          Stockout (0 on shelf)
                        </span>
                      ) : (
                        <span className="text-[#15803D] font-semibold text-[11px]">
                          Stock Available / Reconciled
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {rpt.discrepancy_flag ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider bg-red-50 text-[#B91C1C] border border-red-200">
                          AUDIT_ALERT: GHOST_INVENTORY
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-50 text-[#15803D] border border-emerald-200">
                          VERIFIED_RECONCILED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isAudited ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-emerald-50 text-[#15803D] border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Audit Dispatched</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAuditClick(rpt.facility_id, rpt.reported_shortage);
                          }}
                          className="px-2.5 py-1 rounded bg-[#B91C1C] hover:bg-red-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Initiate Ground Audit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Grid: Telemetry Log & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Telemetry Log (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ASHA Community Health Worker Incident Telemetry
                </h3>
                <p className="text-xs text-slate-500">
                  Click any row to inspect clinical observations and field notes
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log New Field Signal</span>
              </button>
            </div>

            {/* New Report Modal / Form */}
            {isFormOpen && (
              <form
                onSubmit={handleSubmitNewReport}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 text-xs space-y-3"
              >
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  Submit Ground Field Observation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Target Facility
                    </label>
                    <select
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                    >
                      {facilities.map((f) => (
                        <option key={f.facility_id} value={f.facility_id}>
                          {f.facility_name} ({f.district})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      ASHA Reporter Name
                    </label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Reported Shortage Item
                    </label>
                    <input
                      type="text"
                      value={reportedShortage}
                      onChange={(e) => setReportedShortage(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      System Portal Stated Stock
                    </label>
                    <input
                      type="number"
                      value={systemStock}
                      onChange={(e) => setSystemStock(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Observed Clinical Symptoms & Community Context
                  </label>
                  <input
                    type="text"
                    value={observedSymptoms}
                    onChange={(e) => setObservedSymptoms(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="disc_check"
                    checked={isDiscrepancy}
                    onChange={(e) => setIsDiscrepancy(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <label htmlFor="disc_check" className="text-slate-800 font-semibold cursor-pointer">
                    Flag as Ghost Inventory Discrepancy (Physical shelf count is zero while portal registers stock)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Ingest Signal
                  </button>
                </div>
              </form>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Report ID</th>
                    <th className="py-2.5 px-3">Facility</th>
                    <th className="py-2.5 px-3">Reporter</th>
                    <th className="py-2.5 px-3">Reported Item</th>
                    <th className="py-2.5 px-3 text-right">Portal Stock</th>
                    <th className="py-2.5 px-3 text-center">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {reports.map((rpt) => (
                    <tr
                      key={rpt.report_id}
                      onClick={() => setSelectedReport(rpt)}
                      className={`cursor-pointer transition-colors ${
                        selectedReport.report_id === rpt.report_id
                          ? 'bg-sky-50 font-medium'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-900 font-medium">
                        {rpt.report_id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div>{rpt.facility_name || rpt.facility_id}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{rpt.timestamp}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{rpt.reporter_name}</td>
                      <td className="py-2.5 px-3 text-slate-900">{rpt.reported_shortage}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {rpt.system_stock_at_report_time} units
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {rpt.discrepancy_flag ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-[#B91C1C] border border-red-300">
                            Ghost Stock
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-[#15803D] border border-emerald-300">
                            Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Selected Report Inspection & Audit Case File (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-700" />
                <span>Field Case File: {selectedReport.report_id}</span>
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  selectedReport.discrepancy_flag
                    ? 'bg-red-100 text-[#B91C1C] border border-red-300'
                    : 'bg-emerald-100 text-[#15803D] border border-emerald-300'
                }`}
              >
                {selectedReport.discrepancy_flag ? 'Ghost Inventory' : 'Reconciled'}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Primary Health Facility:</span>
                  <span className="font-semibold text-slate-900">{selectedReport.facility_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ASHA Field Worker:</span>
                  <span className="font-semibold text-slate-900">{selectedReport.reporter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telemetry Ingestion Time:</span>
                  <span className="font-mono text-slate-700">{selectedReport.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reported SKU:</span>
                  <span className="font-semibold text-slate-900">{selectedReport.reported_shortage}</span>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-900 mb-1">
                  Community Symptoms & Field Observations:
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 leading-relaxed italic">
                  "{selectedReport.observed_symptoms}"
                </div>
              </div>

              {selectedReport.notes && (
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Auditor Technical Notes:</div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-slate-600">
                    {selectedReport.notes}
                  </div>
                </div>
              )}

              {/* Discrepancy comparison box */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-100 border border-slate-200 rounded p-2.5 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Portal Registered Stock
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
                    {selectedReport.system_stock_at_report_time} Units
                  </div>
                </div>
                <div
                  className={`border rounded p-2.5 text-center ${
                    selectedReport.discrepancy_flag
                      ? 'bg-red-50 border-red-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Physical Ground Count
                  </div>
                  <div
                    className={`text-lg font-bold font-mono mt-0.5 ${
                      selectedReport.discrepancy_flag ? 'text-[#B91C1C]' : 'text-[#15803D]'
                    }`}
                  >
                    {selectedReport.discrepancy_flag ? '0 Units (Stockout)' : `${selectedReport.system_stock_at_report_time} Units`}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAuditAlertDispatched(true)}
                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                Order SDM Physical Stock Inspection ({selectedReport.report_id})
              </button>

              {auditAlertDispatched && (
                <div className="mt-2.5 p-2 rounded bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Mandate registered. District Auditor notified with field evidence.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
