# HawkTrace 24/7 Detection Worker

The web app is the console; **this worker is the source of truth** for
continuous, headless face recognition. Deploy it on any always-on host
(edge box, on-prem server, or cloud VM). It:

1. Pulls each camera's `rtsp_url` from Supabase (`public.cameras`).
2. Grabs frames with `ffmpeg` / OpenCV.
3. Runs `insightface` (buffalo_l) to detect + embed faces.
4. Matches embeddings against enrolled subjects (cosine >= threshold).
5. POSTs a signed alert to `/api/public/detector` on the HawkTrace app.
6. Tails `audit_logs` where `module = 'dev-terminal'` for control signals
   (`worker.restart`, `worker.reload-model`, `worker.resync-cameras`).

## Configure

Copy `.env.example` → `.env` and fill in:

```
HAWKTRACE_BASE_URL=https://<your-app>.lovable.app
DETECTOR_WEBHOOK_SECRET=<same value as the server secret>
SUPABASE_URL=<from lovable cloud>
SUPABASE_SERVICE_ROLE_KEY=<from lovable cloud>
MATCH_THRESHOLD=0.42
FRAME_STRIDE=5
```

## Run

```bash
docker compose up -d --build
docker compose logs -f worker
```

## ONVIF auto-discovery

Set `ONVIF_DISCOVERY=1` and the worker will WS-Discover cameras on the LAN
every 60s and upsert them into `public.cameras`. Discovery requires the
worker be on the same L2 network as the cameras — that's why it lives here
and not in the browser.

## Uploaded video processing

The web app posts clips to `/api/public/detector/clip` (todo route); the
worker consumes the signed URL, runs the same pipeline on the file, and
emits one alert per match.

## Sample match payload

```json
{
  "external_id": "match-01HZX...",
  "title": "Match: John Doe",
  "priority": "Critical",
  "camera_id": "b26f...",
  "camera_name": "Gate 4 East",
  "location": "Perimeter Zone 2",
  "latitude": -17.8252,
  "longitude": 31.0335,
  "subject_id": "sub_...",
  "subject_name": "John Doe",
  "subject_category": "Wanted",
  "match_confidence": 0.87,
  "thumbnail": "data:image/jpeg;base64,...",
  "source": "worker-1"
}
```

Sign the raw body with HMAC-SHA256 using `DETECTOR_WEBHOOK_SECRET`, hex
encoded, in header `x-hawktrace-signature`. Unsigned or mis-signed
requests are rejected with 401.
