"""HawkTrace 24/7 detection worker (reference implementation).

Pulls cameras from Supabase, grabs frames via OpenCV/ffmpeg, runs
insightface embeddings, matches enrolled subjects, and POSTs signed
alerts to the HawkTrace app.

Intentionally single-file so you can drop it on an edge box and read
the whole pipeline top-to-bottom. Production deployments should split
this into modules and add: process supervisor, per-camera worker pool,
GPU support, and reconnection back-off.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import signal
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any

import cv2
import httpx
import numpy as np
from insightface.app import FaceAnalysis
from supabase import Client, create_client

BASE_URL = os.environ["HAWKTRACE_BASE_URL"].rstrip("/")
WEBHOOK_SECRET = os.environ["DETECTOR_WEBHOOK_SECRET"].encode()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MATCH_THRESHOLD = float(os.environ.get("MATCH_THRESHOLD", "0.42"))
FRAME_STRIDE = int(os.environ.get("FRAME_STRIDE", "5"))

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
face = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face.prepare(ctx_id=0, det_size=(640, 640))

_stop = threading.Event()


def log(msg: str) -> None:
    print(f"[hawktrace-worker] {msg}", flush=True)


def sign_and_post(payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(WEBHOOK_SECRET, body, hashlib.sha256).hexdigest()
    try:
        r = httpx.post(
            f"{BASE_URL}/api/public/detector",
            content=body,
            headers={
                "content-type": "application/json",
                "x-hawktrace-signature": signature,
            },
            timeout=10.0,
        )
        r.raise_for_status()
        log(f"posted alert ({payload.get('priority')}): {r.status_code}")
    except Exception as e:  # pragma: no cover
        log(f"post failed: {e}")


@dataclass
class Enrollment:
    subject_id: str
    subject_name: str
    category: str | None
    embedding: np.ndarray


def load_enrollments() -> list[Enrollment]:
    rows = (
        sb.table("face_enrollments")
        .select("personnel_id,personnel_name,descriptor")
        .execute()
        .data
        or []
    )
    subjects = {
        r["id"]: r
        for r in (
            sb.table("subjects")
            .select("id,category")
            .execute()
            .data
            or []
        )
    }
    out: list[Enrollment] = []
    for r in rows:
        d = r["descriptor"]
        if not isinstance(d, list):
            continue
        emb = np.asarray(d, dtype=np.float32)
        emb /= np.linalg.norm(emb) + 1e-9
        subj = subjects.get(r["personnel_id"], {})
        out.append(
            Enrollment(
                subject_id=r["personnel_id"],
                subject_name=r["personnel_name"],
                category=subj.get("category"),
                embedding=emb,
            )
        )
    log(f"loaded {len(out)} enrollments")
    return out


def load_cameras() -> list[dict[str, Any]]:
    return (
        sb.table("cameras")
        .select("id,name,rtsp_url,location,latitude,longitude,status")
        .neq("rtsp_url", "")
        .execute()
        .data
        or []
    )


def match(embedding: np.ndarray, enrollments: list[Enrollment]) -> tuple[Enrollment | None, float]:
    if not enrollments:
        return None, 0.0
    embedding = embedding / (np.linalg.norm(embedding) + 1e-9)
    stacked = np.stack([e.embedding for e in enrollments])
    scores = stacked @ embedding
    idx = int(np.argmax(scores))
    return enrollments[idx], float(scores[idx])


def priority_for(score: float, category: str | None) -> str:
    if (category or "").lower() in {"wanted", "high-risk", "critical"} and score >= 0.55:
        return "Critical"
    if score >= 0.6:
        return "High"
    if score >= 0.5:
        return "Medium"
    return "Low"


def process_camera(cam: dict[str, Any], enrollments: list[Enrollment]) -> None:
    log(f"opening {cam['name']} ({cam['rtsp_url']})")
    cap = cv2.VideoCapture(cam["rtsp_url"])
    if not cap.isOpened():
        log(f"cannot open {cam['name']}")
        return
    frame_idx = 0
    while not _stop.is_set():
        ok, frame = cap.read()
        if not ok:
            time.sleep(1)
            continue
        frame_idx += 1
        if frame_idx % FRAME_STRIDE != 0:
            continue
        faces = face.get(frame)
        for f in faces:
            best, score = match(f.embedding, enrollments)
            if not best or score < MATCH_THRESHOLD:
                continue
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            thumb = "data:image/jpeg;base64," + buf.tobytes().hex()[:0]  # placeholder to keep payload small
            sign_and_post(
                {
                    "external_id": f"m-{int(time.time() * 1000)}",
                    "title": f"Match: {best.subject_name}",
                    "priority": priority_for(score, best.category),
                    "camera_id": cam["id"],
                    "camera_name": cam["name"],
                    "location": cam.get("location"),
                    "latitude": cam.get("latitude"),
                    "longitude": cam.get("longitude"),
                    "subject_id": best.subject_id,
                    "subject_name": best.subject_name,
                    "subject_category": best.category,
                    "match_confidence": round(score, 3),
                    "source": "worker-1",
                }
            )
    cap.release()


def main() -> None:
    signal.signal(signal.SIGTERM, lambda *_: _stop.set())
    signal.signal(signal.SIGINT, lambda *_: _stop.set())

    enrollments = load_enrollments()
    cams = load_cameras()
    log(f"starting {len(cams)} camera threads")
    threads = [threading.Thread(target=process_camera, args=(c, enrollments), daemon=True) for c in cams]
    for t in threads:
        t.start()

    while not _stop.is_set():
        time.sleep(1)

    log("shutting down")
    sys.exit(0)


if __name__ == "__main__":
    main()
