import os
import io
from typing import List, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import pytesseract
import os

# Load environment variables from .env if available (non-fatal if missing)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Optional: Ollama config for LLM summaries (used only if summary_mode='llm')
OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")

# Configure Tesseract executable on Windows if available
_DEFAULT_TESSERACT = r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
TESSERACT_CMD = os.getenv("TESSERACT_CMD", _DEFAULT_TESSERACT)
try:
    if os.path.exists(TESSERACT_CMD):
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
except Exception:
    # Non-fatal; pytesseract will try PATH
    pass

app = FastAPI(title="Medical Report Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health():
    # Device isn't relevant for Tesseract; keep key for continuity
    return {"status": "ok", "device": "cpu", "ocr_engine": "tesseract"}


# -------------------- OCR (Step 1) -------------------- #

def _pil_to_cv(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _preprocess_for_ocr(pil_img: Image.Image) -> Image.Image:
    img = _pil_to_cv(pil_img)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # deskew via moments
    m = cv2.moments(gray)
    if abs(m['mu02']) > 1e-3:
        skew = m['mu11'] / m['mu02']
        angle = np.arctan(skew) * (180.0 / np.pi)
        h, w = gray.shape
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    # denoise and sharpen
    gray = cv2.bilateralFilter(gray, 5, 50, 50)
    # adaptive threshold
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 31, 10)
    # upscale if small
    h, w = thresh.shape
    if w < 1600:
        scale = 1600.0 / w
        thresh = cv2.resize(thresh, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    # slight morphology to close gaps
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    return Image.fromarray(thresh)


def _pdf_bytes_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """Render PDF pages to PIL images using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
    except Exception as e:
        raise RuntimeError("PyMuPDF (fitz) is required for PDF OCR. Install with: pip install pymupdf") from e

    images: List[Image.Image] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page_idx in range(len(doc)):
            page = doc.load_page(page_idx)
            # Render at 2.0x for better OCR
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
    finally:
        doc.close()
    return images


def _pdf_bytes_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """Render PDF pages to PIL images using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
    except Exception as e:
        raise RuntimeError("PyMuPDF (fitz) is required for PDF OCR. Install with: pip install pymupdf") from e

    images: List[Image.Image] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page_idx in range(len(doc)):
            page = doc.load_page(page_idx)
            # Render at 2.0x for better OCR
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
    finally:
        doc.close()
    return images


def _heuristic_confidence(text: str) -> float:
    txt = (text or "").strip()
    if not txt:
        return 0.0
    # simple heuristic: ratio of letters/digits and length
    alnum = sum(ch.isalnum() for ch in txt)
    ratio = alnum / max(1, len(txt))
    length_factor = min(1.0, len(txt) / 200.0)
    return round(0.5 * ratio + 0.5 * length_factor, 2)


def _extract_tests_raw(text: str) -> List[str]:
    import re
    txt = (text or "")
    # Join lines where a standalone status like (Low) or (Normal) follows a value line
    merged_lines: List[str] = []
    status_only = re.compile(r"^\s*\((Low|High|Normal)\)\s*$", re.I)
    for raw in txt.split("\n"):
        if merged_lines and status_only.match(raw):
            merged_lines[-1] = merged_lines[-1].rstrip() + f" {raw.strip()}"
        else:
            merged_lines.append(raw)

    # Normalize common OCR quirks
    norm_lines: List[str] = []
    for raw in merged_lines:
        s = raw
        # Remove commas within numbers (e.g., 11,200 -> 11200; 130,000 -> 130000)
        s = re.sub(r"(?<=\d),(?=\d)", "", s)
        # Unify micro/liter variants and fix pL typo used for Platelets
        s = s.replace("µ", "u").replace("μ", "u").replace("/pL", "/uL").replace("/Pl", "/uL")
        norm_lines.append(s)

    # Now split by commas to catch multi-test lines
    lines: List[str] = []
    for raw in norm_lines:
        parts = [p.strip() for p in raw.split(',') if p.strip()]
        lines.extend(parts)

    # Extract tests
    tests: List[str] = []
    # Allow units like x10^3/uL, 10^6/uL, %, mg/dL, mmol/L, /uL, fL, pg, g/dL, etc.
    unit_rx = r"[%A-Za-z/xX\^0-9·]+"
    pattern = re.compile(rf"([A-Za-z][A-Za-z \-/]+)\s+([0-9]+(?:\.[0-9]+)?)\s*({unit_rx})(?:\s*\((Low|High|Normal)\))?", re.I)
    for ln in lines:
        m = pattern.search(ln)
        if m:
            name = m.group(1).strip()
            val = m.group(2)
            unit = m.group(3)
            status = m.group(4)
            base = f"{name} {val} {unit}"
            tests.append(base + (f" ({status.capitalize()})" if status else ""))
    return tests


class OCRTextIn(BaseModel):
    text: str


class OCRResultModel(BaseModel):
    tests_raw: List[str]
    confidence: float
    extracted_text: str
    error: str | None = None


class NormalizedTestsModel(BaseModel):
    tests: List[dict]
    normalization_confidence: float


class SummaryModel(BaseModel):
    summary: str
    explanations: List[str]


class ProcessedReportModel(BaseModel):
    tests: List[dict] | None = None
    summary: str | None = None
    explanations: List[str] | None = None
    status: str
    reason: str | None = None
    ocr_confidence: float | None = None
    normalization_confidence: float | None = None
    extracted_text: str | None = None


@app.post("/ocr")
async def ocr(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    extracted_text = ""
    try:
        if file is not None:
            data = await file.read()
            filename = (file.filename or '').lower()
            config = "--oem 3 --psm 6"

            if filename.endswith('.pdf') or (file.content_type or '').lower() == 'application/pdf':
                # PDF: render pages, OCR each, concatenate
                images = _pdf_bytes_to_images(data)
                page_texts: List[str] = []
                conf_accum: List[float] = []
                from pytesseract import Output
                for pil in images:
                    processed = _preprocess_for_ocr(pil)
                    page_texts.append(pytesseract.image_to_string(processed, config=config))
                    try:
                        dd = pytesseract.image_to_data(processed, config=config, output_type=Output.DICT)
                        confs = [int(c) for c in dd.get("conf", []) if isinstance(c, (int, str)) and str(c).isdigit() and int(c) >= 0]
                        if confs:
                            conf_accum.append(sum(confs) / max(1, len(confs)))
                    except Exception:
                        pass
                extracted_text = "\n".join(t.strip() for t in page_texts if t and t.strip())
                avg_conf = (sum(conf_accum) / len(conf_accum)) if conf_accum else 50.0
                # Use first page for any internal preview if needed in future (no debug exposed)
            else:
                image = Image.open(io.BytesIO(data)).convert("RGB")
                processed = _preprocess_for_ocr(image)
                extracted_text = pytesseract.image_to_string(processed, config=config)
                # Compute confidence from word-level data (0-100 → 0-1)
                try:
                    from pytesseract import Output
                    dd = pytesseract.image_to_data(processed, config=config, output_type=Output.DICT)
                    confs = [int(c) for c in dd.get("conf", []) if isinstance(c, (int, str)) and str(c).isdigit() and int(c) >= 0]
                    if confs:
                        avg_conf = sum(confs) / max(1, len(confs))
                    else:
                        avg_conf = 50.0
                except Exception:
                    avg_conf = 50.0
        elif text is not None:
            extracted_text = text
        else:
            return {"tests_raw": [], "confidence": 0.0, "extracted_text": "", "error": "no file or text provided"}
    except Exception as e:
        # Return graceful response instead of 500
        return {"tests_raw": [], "confidence": 0.0, "extracted_text": "", "error": f"ocr_failed: {str(e)}"}

    tests_raw = _extract_tests_raw(extracted_text)
    # Prefer Tesseract avg conf if computed; otherwise heuristic
    conf = round((avg_conf / 100.0), 2) if 'avg_conf' in locals() else _heuristic_confidence(extracted_text)

    return {"tests_raw": tests_raw, "confidence": conf, "extracted_text": extracted_text}


# -------------------- Normalization (Step 2) -------------------- #

class NormalizeIn(BaseModel):
    tests_raw: List[str]


def _normalize_tests(tests_raw: List[str]) -> Tuple[List[dict], float]:
    aliases = {
        "hemglobin": "Hemoglobin",
        "hb": "Hemoglobin",
        "wbc": "WBC",
        "white blood cell count": "WBC",
        "totl cholesterol": "Total Cholesterol",
        "cholesterol": "Total Cholesterol",
        "sodum": "Sodium",
        "potasium": "Potassium",
        "plt": "Platelets",
        "platelet": "Platelets",
        "platelet count": "Platelets",
        "rbc": "RBC",
        "red blood cell count": "RBC",
        "mean corpuscular volume": "MCV",
        "mean corpuscular hemoglobin": "MCH",
        "mean corpuscular hemoglobin concentration": "MCHC",
        "fasting glucose": "Glucose",
        "blood glucose": "Glucose",
    }
    # reference ranges (example set)
    ranges = {
        ("Hemoglobin", "g/dL"): (12.0, 15.0),
        ("WBC", "/uL"): (4000, 11000),
        ("Sodium", "mmol/L"): (135, 145),
        ("Potassium", "mmol/L"): (3.5, 5.1),
        ("Creatinine", "mg/dL"): (0.6, 1.3),
        ("HDL", "mg/dL"): (40, 60),
        ("Total Cholesterol", "mg/dL"): (0, 200),
        ("Platelets", "/uL"): (150000, 450000),
        ("RBC", "/uL"): (4.2e6, 5.9e6),
        ("MCV", "fL"): (80, 100),
        ("MCH", "pg"): (27, 33),
        ("MCHC", "g/dL"): (32, 36),
        ("Glucose", "mg/dL"): (70, 99),
        ("Glucose", "mmol/L"): (3.9, 5.5),
    }

    # Optional ontology codes (example LOINC where applicable)
    loinc = {
        "Hemoglobin": "718-7",
        "WBC": "6690-2",
        "Sodium": "2951-2",
        "Potassium": "2823-3",
        "Creatinine": "2160-0",
        "HDL": "2085-9",
        "Total Cholesterol": "2093-3",
        "Platelets": "777-3",
        "RBC": "789-8",
        "MCV": "787-2",
        "MCH": "785-6",
        "MCHC": "786-4",
    }

    out: List[dict] = []
    import re
    unit_rx2 = r"[%A-Za-z/µμxX\^0-9·]+"
    rx = re.compile(rf"^([A-Za-z][A-Za-z \-/]+)\s+([0-9]+(?:\.[0-9]+)?)\s*({unit_rx2})(?:\s*\((Low|High|Normal)\))?$", re.I)
    hits = 0
    for raw in tests_raw:
        m = rx.search(raw.strip())
        if not m:
            continue
        name = m.group(1).strip()
        lname = name.lower()
        for k, v in aliases.items():
            if lname == k:
                name = v
        value = float(m.group(2))
        unit = m.group(3).replace("µ", "u").replace("μ", "u").replace("×", "x").replace("·", "x")

        # Normalize scientific count units, e.g., x10^3/uL or 10^6/uL
        unit_lower = unit.lower()
        if "+/ul" in unit_lower:
            unit_lower = unit_lower.replace("+/ul", "/ul")
        if "10^3/ul" in unit_lower or "x10^3/ul" in unit_lower:
            value *= 1000.0
            unit = "/uL"
        elif "10^6/ul" in unit_lower or "x10^6/ul" in unit_lower:
            value *= 1_000_000.0
            unit = "/uL"
        status = (m.group(4) or "").lower() or None

        ref = ranges.get((name, unit))
        if ref:
            low, high = ref
            if status is None:
                if value < low:
                    status_calc = "low"
                elif value > high:
                    status_calc = "high"
                else:
                    status_calc = "normal"
            else:
                status_calc = status
        else:
            low, high, status_calc = None, None, status or "normal"

        out.append({
            "name": name,
            "value": value,
            "unit": unit,
            "status": status_calc,
            "ref_range": {"low": low, "high": high} if ref else {"low": None, "high": None},
            "code": loinc.get(name)
        })
        hits += 1

    norm_conf = round(0.6 + 0.4 * min(1.0, hits / max(1, len(tests_raw) or 1)), 2)
    return out, norm_conf


@app.post("/normalize")
def normalize(body: NormalizeIn):
    tests, conf = _normalize_tests(body.tests_raw)
    return {"tests": tests, "normalization_confidence": conf}


# -------------------- Summary (Step 3) -------------------- #

class SummaryIn(BaseModel):
    tests: List[dict]


def _summarize(tests: List[dict]) -> Tuple[str, List[str]]:
    explanations: List[str] = []
    flags = []
    for t in tests:
        name = t.get("name")
        status = (t.get("status") or "").lower()
        if status == "low":
            if name == "Hemoglobin":
                explanations.append("Low hemoglobin may relate to anemia.")
            else:
                explanations.append(f"Low {name} noted.")
            flags.append(f"low {name}")
        elif status == "high":
            if name == "WBC":
                explanations.append("High WBC can occur with infections.")
            else:
                explanations.append(f"High {name} noted.")
            flags.append(f"high {name}")

    if flags:
        summary = ", ".join(flags).capitalize() + "."
    else:
        summary = "Most values appear within normal limits based on the provided ranges."
    return summary, explanations


def _summarize_llm(tests: List[dict]) -> Tuple[str, List[str]]:
    """Attempt an LLM summary via Ollama; fall back to rule-based on any error."""
    try:
        import requests
    except Exception:
        return _summarize(tests)

    prompt = (
    "You are a helpful medical assistant. Given the following normalized lab tests, "
    "produce a concise, patient-friendly summary. Follow these rules: "
    "1) Use 1-2 sentences per test. "
    "2) Do not invent any tests or diagnoses. Only describe what is high/low/normal. " 
    "3) Keep a neutral, patient-friendly tone. " 
    "4) Do not include introductory phrases like 'Here is...' or quotes. " 
    "5) Use a bullet for each test. " 
    "Tests as JSON: " + str(tests)
)
    try:
        resp = requests.post(
            f"{OLLAMA_BASE}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            text = (data.get("response") or "").strip()
            if text:
                return text, []
    except Exception:
        pass
    return _summarize(tests)


@app.post("/summary")
def summary(body: SummaryIn):
    s, expl = _summarize(body.tests)
    return {"summary": s, "explanations": expl}


# -------------------- Process (Step 4) -------------------- #

from fastapi import UploadFile

@app.post("/process")
async def process(
    mode: str = Form(...),
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    summary_mode: str | None = Form(default=None),
):
    # Step 1: OCR/Text
    # Allow text simulation even when mode='image' (frontend may send sample text without a file)
    ocr_resp = await ocr(file=file, text=text)
    tests_raw: List[str] = ocr_resp["tests_raw"]
    if not tests_raw:
        return {"status": "unprocessed", "reason": "hallucinated tests not present in input", "ocr_confidence": ocr_resp["confidence"], "extracted_text": ocr_resp.get("extracted_text", "")}

    # Step 2: Normalize
    norm_resp = normalize(NormalizeIn(tests_raw=tests_raw))
    tests = norm_resp["tests"]
    if not tests:
        return {"status": "unprocessed", "reason": "hallucinated tests not present in input", "ocr_confidence": ocr_resp["confidence"], "extracted_text": ocr_resp.get("extracted_text", "")}

    # Step 3: Summary (rule-based by default; optional LLM)
    if (summary_mode or "rule").lower() == "llm":
        s, expl = _summarize_llm(tests)
        sum_resp = {"summary": s, "explanations": expl}
    else:
        sum_resp = summary(SummaryIn(tests=tests))

    # Step 4: Combine
    return {
        "tests": tests,
        "summary": sum_resp["summary"],
        "explanations": sum_resp["explanations"],
        "status": "ok",
        "ocr_confidence": ocr_resp["confidence"],
        "normalization_confidence": norm_resp["normalization_confidence"],
        "extracted_text": ocr_resp.get("extracted_text", "")
    }


@app.get("/schema")
def schema():
    return {
        "ocr": OCRResultModel.model_json_schema(),
        "normalize": NormalizedTestsModel.model_json_schema(),
        "summary": SummaryModel.model_json_schema(),
        "process": ProcessedReportModel.model_json_schema(),
    }
