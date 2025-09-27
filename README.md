# AI-Powered Medical Report Simplifier

A comprehensive medical report processing system that transforms complex medical reports into patient-friendly explanations using AI-powered OCR, normalization, and summarization.

## Live Demo (ngrok)

- Base URL: https://ceaseless-theo-mystical.ngrok-free.dev
- Swagger UI: https://ceaseless-theo-mystical.ngrok-free.dev/docs
- Health Check: https://ceaseless-theo-mystical.ngrok-free.dev/health


## Table of Contents

- [Features](#features)
- [Processing Pipeline (Flow)](#processing-pipeline-flow)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Setup Instructions](#setup-instructions)
- [Example Pipeline](#example-pipeline)
- [Safety & Validation](#safety--validation)
- [Backend API](#backend-api)
- [PowerShell-friendly curl examples](#powershell-friendly-curl-examples)
- [Ngrok demo (public URL)](#ngrok-demo-public-url)
- [Submission Checklist](#submission-checklist)
- [License](#license)

## Features

### OCR / Text Extraction
- **OCR Engine**: Tesseract (via `pytesseract`) with OpenCV preprocessing  
- **PDF Support**: Renders PDFs with PyMuPDF before OCR  
- **Formats**: JPEG, PNG, PDF  
- **Confidence Scoring**: Returns OCR confidence estimate  

### Test Normalization
- **Rule-Based Normalization**: Regex parsing + aliases for common tests  
- **Reference Ranges**: Built-in ranges for Hemoglobin, WBC, Sodium, Potassium, Creatinine, HDL, Total Cholesterol, Platelets, RBC, MCV, MCH, MCHC, Glucose (mg/dL, mmol/L)  
- **Units**: Normalizes variants like `x10^3/µL` to `/uL` with proper scaling  
- **Status**: Flags each test as low / normal / high  

### Patient-Friendly Summaries
- **Default**: Deterministic rule-based summary and explanations  
- **Optional LLM**: Local Ollama (e.g., `llama3:8b`) for free-form summary, with automatic fallback to rule-based on errors/timeouts  
- **Safety**: No diagnosis or treatment recommendations  

### Hallucination Prevention
- Input validation ensures all extracted tests exist in original input  
- Confidence thresholds reject low-confidence results  
- Cross-validation layers prevent false results  
- Rule-based fallbacks when AI processing fails  

---
## Processing Pipeline (Flow)

```mermaid
flowchart TD
    A[Input Report (Text/Image/PDF)] --> B[OCR Extraction]
    B --> C[Test Normalization (Regex + Aliases)]
    C --> D{Summary Mode?}
    D -->|Rule-based| E[Rule-based Summary]
    D -->|LLM| F[LLM Summary via Ollama]
    E --> G[Final Output]
    F --> G[Final Output]
```

## System Architecture

```mermaid
flowchart LR
    subgraph Frontend[Frontend - React + Tailwind]
        UI[User Interface]
    end

    subgraph Backend[Backend - FastAPI]
        API[REST API]
        OCR[OCR Module - Tesseract + OpenCV]
        NORMALIZE[Normalization (Regex + Ranges)]
        SUMMARIZER[Summarizer (Rule-based / LLM)]
    end

    subgraph LLM[Local LLM - Ollama]
        MODEL[llama3:8b]
    end

    UI -->|HTTP Requests| API
    API --> OCR
    API --> NORMALIZE
    NORMALIZE --> SUMMARIZER
    SUMMARIZER -->|Optional| MODEL
    MODEL --> SUMMARIZER
    SUMMARIZER --> API
    API --> UI
```

## Sequence Diagram (Step-by-Step Interaction)

```mermaid
sequenceDiagram
    participant U as User (Frontend UI)
    participant B as Backend (FastAPI)
    participant O as OCR (Tesseract+OpenCV)
    participant N as Normalizer (Regex + Aliases)
    participant S as Summarizer (Rule-based / LLM)
    participant L as LLM (Ollama)

    U->>B: Upload Report (Text/Image/PDF)
    B->>O: Perform OCR (if Image/PDF)
    O-->>B: Extracted Text + Confidence
    B->>N: Normalize tests (units, ranges, statuses)
    N-->>B: Normalized JSON
    B->>S: Generate Summary
    alt Rule-based
        S-->>B: Patient-friendly summary
    else LLM mode
        S->>L: Prompt with normalized JSON
        L-->>S: Generated summary
        S-->>B: Patient-friendly summary
    end
    B-->>U: Final JSON (tests + summary + confidence)


## Technology Stack

- Backend: FastAPI (Python), Uvicorn
- OCR: Tesseract via `pytesseract`, OpenCV preprocessing, PyMuPDF for PDFs
- Summarization: Rule-based (default), optional LLM (Ollama `llama3:8b`)
- Frontend: React 18 + TypeScript + Tailwind CSS (Vite)
- Configuration: `python-dotenv` for backend, Vite env for frontend

## Setup Instructions

### Backend

- Create `.env` at project root:

```env
OLLAMA_BASE=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:8b
VITE_API_BASE_URL=http://127.0.0.1:8001
# If Tesseract is not in default path on Windows
TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
# Tesseract (if not installed in default path)
TESSERACT_CMD=C:\\Path\\To\\tesseract.exe
```

- Install and run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn server.main:app --host 127.0.0.1 --port 8001
```

- Optional LLM test (Ollama):

```powershell
ollama pull llama3:8b
$headers = @{ "Content-Type" = "application/json" }; $body = @{ model = "llama3:8b"; prompt = "Say hello"; stream = $false } | ConvertTo-Json; Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/generate" -Method Post -Headers $headers -Body $body
```

### Frontend (optional UI)

```powershell
npm install
npm run dev
```

## Example Pipeline

### Step 1. OCR / Text Extraction

```json
{
  "tests_raw": ["Hemoglobin 10.2 g/dL (low)", "WBC 11200 /uL (High)"],
  "confidence": 0.80
}
```

### Step 2. Normalization

```json
{
  "tests": [
    {"name": "Hemoglobin", "value": 10.2, "unit": "g/dL", "status": "low", "ref_range": {"low": 12.0, "high": 15.0}}
  ],
  "normalization_confidence": 0.84
}
```

### Step 3. Patient Summary

```json
{
  "summary": "Low hemoglobin and high white blood cell count.",
  "explanations": ["low hemoglobin may relate to anemia.", "High WBC can occur with infections."]
}
```

### Step 4. Final Output

```json
{
  "tests": [...],
  "summary": "Low hemoglobin and high white blood cell count.",
  "status": "ok",
  "ocr_confidence": 0.80,
  "normalization_confidence": 0.84
}
```

## Safety & Validation

- No diagnoses or treatment recommendations
- Encourages consulting healthcare providers
- Confidence scoring at each step
- Fallback to rule-based summaries if AI fails

## Backend API

- Base URL (local): http://127.0.0.1:8001
- Swagger UI: http://127.0.0.1:8001/docs
- OpenAPI JSON: http://127.0.0.1:8001/openapi.json
- POST /ocr – OCR for PNG/JPG/PDF
- POST /process – End-to-end pipeline
  - mode: text | image
  - text: input text (if mode=text)
  - file: uploaded file (if mode=image)
  - summary_mode: rule | llm

## PowerShell-friendly curl examples

```powershell
& "C:\\Windows\\System32\\curl.exe" "http://127.0.0.1:8001/health"
& "C:\\Windows\\System32\\curl.exe" "http://127.0.0.1:8001/openapi.json"

& "C:\\Windows\\System32\\curl.exe" -s -X POST "http://127.0.0.1:8001/process" -F "mode=text" -F "text=Hemoglobin 10.2 g/dL (low), WBC 11200 /uL (High)"
& "C:\\Windows\\System32\\curl.exe" -s -X POST "http://127.0.0.1:8001/process" -F "mode=text" -F "text=Hemoglobin 10.2 g/dL (low), WBC 11200 /uL (High)" -F "summary_mode=llm"

& "C:\\Windows\\System32\\curl.exe" -s -X POST "http://127.0.0.1:8001/ocr" -F "file=@C:\\path\\report.png"
& "C:\\Windows\\System32\\curl.exe" -s -X POST "http://127.0.0.1:8001/process" -F "mode=image" -F "file=@C:\\path\\report.pdf"
```

## Ngrok demo (public URL)

```powershell
& "C:\\Users\\msi\\Downloads\\ngrok-v3-stable-windows-amd64\\ngrok.exe" http http://127.0.0.1:8001
# Then replace base URLs above with: https://ceaseless-theo-mystical.ngrok-free.dev