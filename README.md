# MediPulse AI: Autonomous Last-Mile Clinical Supply Chain & Ghost Stock Sentinel

> **A Sovereign Digital Public Good (DPG) engineered to eradicate drug stockouts, eliminate phantom inventory, and automate life-saving FEFO redistributions across primary healthcare networks using Google Cloud & Gemini 2.5.**

[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-Deployed-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.40.2-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io)
[![Gemini 2.5 Flash](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Digital Public Good](https://img.shields.io/badge/DPG_Standard-Compliant-00875A)](https://digitalpublicgoods.net/)

---

## 🎯 Executive Abstract & Core Value Proposition
Across 160,000+ public healthcare facilities in rural and peri-urban districts, public medicine supply chains operate under an insidious paradox: **catastrophic stockouts co-exist with systemic expiration waste**. Central portals (such as e-Aushadhi / DVDMS) report high paper stock availability, while ground facilities have zero physical units—a phenomenon known as **Ghost Inventory**. 

**MediPulse AI** transforms passive ledger portals into a proactive, closed-loop clinical logistics intelligence engine. By pairing multimodal **Gemini 2.5 Flash** with localized epidemiological machine learning and Operations Research (FEFO linear solver), MediPulse AI detects stockouts days before they strike, audits phantom records from vernacular voice notes sent by frontline ASHA workers, and prescribes optimal, cold-chain-compliant inter-facility transfers.

---

## 🏛️ Autonomous Architecture Flowchart

```mermaid
flowchart TD
    subgraph S1["1. FRONTLINE GROUND TRUTH"]
        ASHA["ASHA Community Workers / ANMs"]
        VOICE["WhatsApp Vernacular Audio Dispatches\n(Hindi / Dialect Recordings)"]
        ASHA -->|Field Observations| VOICE
    end

    subgraph S2["2. MULTIMODAL PERCEPTION & GHOST AUDIT"]
        VOICE -->|Raw Audio (WAV/MP3/M4A)| GEMINI["Google Gemini 2.5 Flash Engine"]
        GEMINI -->|Structured JSON Extraction| ENTITY["Clinical Entity Extraction\n(Facility, Drug, Stock=0, Patient Surge)"]
        ENTITY -->|Zero-Ground vs Portal Check| GHOST_CHECK{"Discrepancy Engine\n(Ghost Stock Check)"}
        GHOST_CHECK -->|Discrepancy >= 50 units| AUDIT["🚨 Automated Ghost Audit Mandate\nQuarantine Ledger Record"]
    end

    subgraph S3["3. DATA & EPIDEMIOLOGICAL FORECASTING"]
        LEDGER["Enterprise Relational Pipeline\n(Facilities, Batches, Consumption)"]
        WEATHER["Met Driver & Epidemic Multipliers\n(Monsoon Lag, Disease Vector Surge)"]
        ML["Ridge Regression ML Horizon\n(7-Day Rolling District Forecaster)"]
        
        LEDGER --> ML
        WEATHER --> ML
        GHOST_CHECK -->|Calibrated Stock Level| ML
    end

    subgraph S4["4. PRESCRIPTIVE REDISTRIBUTION SOLVER"]
        ML -->|7-Day Deficit / Surplus Matrix| FEFO_SOLVER["Constrained FEFO Redistribution Solver\n(Min Distance km, Maximize Shelf-Life)"]
        FEFO_SOLVER -->|Optimized Route Matrix| TRANSFER["Prescriptive Transfer Orders\n(Source CHC -> Deficit PHC)"]
    end

    subgraph S5["5. DISTRICT COMMAND & GOVERNANCE"]
        TRANSFER --> UI["Executive District Command Center\n(Interactive Map, SVI Heatmap, One-Click Approval)"]
        AUDIT --> UI
        UI -->|Cryptographic Event Log| AUDIT_TRAIL["Append-Only SRE Audit Trail\n(CSV Export, CMHO Mandates)"]
        UI -->|What-If Policy Simulator| GEMINI_POLICY["Gemini Executive Policy Memo Generator"]
    end
```

---

## ⚖️ Core Differentiators: Legacy Portals vs. MediPulse AI

| Architectural Dimension | Legacy Government Portals (e-Aushadhi / DVDMS) | MediPulse AI (Autonomous Digital Public Good) |
| :--- | :--- | :--- |
| **Data Ingestion Method** | Desktop data-entry clerks; delayed batch updates (7–21 days lag). | Real-time vernacular voice audio dispatches (Hindi/English) via Gemini 2.5 Flash. |
| **Ground Reality Validation** | Blind trust in portal balance; phantom/theft stock hidden indefinitely. | Instant **Ghost Stock Sentinel**: flags ledger-vs-physical discrepancies in seconds. |
| **Demand Forecasting** | Static historical averages or min-max inventory reorder thresholds. | Dynamic ML forecasting incorporating disease season and monsoon-induced surges. |
| **Expiration Governance** | FIFO/LIFO warehouse routing; medicines expire on peripheral shelves. | **Prescriptive FEFO**: transfers near-expiry surpluses to high-burn deficit centers. |
| **Actionability** | Passive reporting; requires manual procurement tenders (months). | Active prescriptive dispatch: 1-click inter-facility vehicle route authorizations. |
| **Crisis Responsiveness** | Reactive to crisis escalations; no simulation or scenario capability. | **What-If Epidemic Simulator**: models shock waves, lead-time freezes, and policy memos. |

---

## 🌐 Live Access & Demonstration Assets

- **Production URL**: [Launch MediPulse AI Live App](https://ais-dev-ke536zx6vvududwoai4nuj-750243678968.asia-southeast1.run.app)
- **Shared Production Link**: [https://ais-pre-ke536zx6vvududwoai4nuj-750243678968.asia-southeast1.run.app](https://ais-pre-ke536zx6vvududwoai4nuj-750243678968.asia-southeast1.run.app)
- **Video Walkthrough (3-Min Demo)**: [Watch YouTube Demo Video](#-3-minute-video-screenplay-walkthrough)
- **Developer Documentation**: Included inline within the codebase (`app.py`, `src/`).

---

## 🚀 Quickstart Local Setup Guide

### Prerequisites
- Python 3.10, 3.11, or 3.12
- Node.js 18+ (for client-side applet interface)
- Google Gemini API Key ([Get an API Key on Google AI Studio](https://aistudio.google.com))

### 1. Clone & Enter Repository
```bash
git clone https://github.com/itspayalrana/medipulse-ai.git
cd medipulse-ai
```

### 2. Configure Environment Variables
Create a local `.env` file from the provided `.env.example`:
```bash
cp .env.example .env
```
Edit `.env` and configure your credentials:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### 3. Install Dependencies & Launch Python Engine
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```

### 4. Optional: Run Containerized via Docker
```bash
docker build -t medipulse-ai .
docker run -p 8501:8501 -e GEMINI_API_KEY="your_api_key" medipulse-ai
```

---

## 🛠️ Technology Stack & Google Cloud Synergy

- **Multimodal AI Foundation**: Google Gemini 2.5 Flash (`@google/genai` v0.3.0) with zero-shot audio transcription, Hindi dialect parsing, and JSON schema enforcement.
- **Predictive ML Core**: Scikit-Learn Ridge Regression with multi-lag time-series forecasting, epidemic wave multipliers, and monsoon climate weighting.
- **Optimization Algorithms**: First-Expired, First-Out (FEFO) linear programming heuristic prioritizing shortest haul transit distances ($\le 35\text{ km}$).
- **Spatial & Interactive Analytics**: Plotly Graph Objects & Express, Folium GIS Geo-JSON boundary mappings, Streamlit v1.40.2 enterprise layout.
- **Enterprise Governance**: Append-only cryptographic audit logging tracking all administrative dispatches with CSV export.

---

## 🔒 Responsible AI & Data Privacy Disclosure
MediPulse AI processes anonymized voice notes and aggregated health facility inventory ledgers. No personally identifiable patient health information (PHI) is persisted or transmitted to third-party endpoints, ensuring compliance with global healthcare privacy standards (HIPAA/DISHA) and Digital Public Goods Alliance principles.
