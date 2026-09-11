#!/usr/bin/env python3
"""Capture a small read-only sample, not a production synchronizer.

Run: python3 scripts/capture_sources.py
Each run creates an immutable timestamped directory and a checksum manifest.
Only public catalogue endpoints are requested; no confirmation/write APIs.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STAMP = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
DEST = ROOT / "docs" / "evidence" / STAMP
SOURCES = {
    "tpqi-stats.json": "https://dles.vec.go.th/api/standards/tpqi/stats",
    "tpqi-search-page1.json": "https://dles.vec.go.th/api/standards/tpqi/search?limit=2&page=1",
    "tpqi-search-page2.json": "https://dles.vec.go.th/api/standards/tpqi/search?limit=2&page=2",
    "tpqi-detail-22.json": "https://dles.vec.go.th/api/standards/tpqi/22",
    "source-meta.json": "https://dles.vec.go.th/api/standards/meta",
    "subject-status.json": "https://dles.vec.go.th/subject/api/std2018-status",
    "subject-search-offset0.json": "https://dles.vec.go.th/subject/api/search?limit=2&offset=0",
    "subject-search-offset2.json": "https://dles.vec.go.th/subject/api/search?limit=2&offset=2",
    "subject-20100-1001.json": "https://dles.vec.go.th/subject/api/subject-detail?code=20100-1001&dept=20101",
    "reference-20100-1001.json": "https://dles.vec.go.th/subject/api/link/course?code=20100-1001&dept=20101",
    "curriculum-20101v8.pdf": "https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20101v8.pdf",
}


def capture(item):
    name, url = item
    entry = {"file": name, "url": url, "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MappingDesignEvidence/1.0"})
        with urllib.request.urlopen(req, timeout=35) as response:
            raw = response.read()
            entry.update(status=response.status, final_url=response.url,
                         content_type=response.headers.get("Content-Type"))
        if name.endswith(".json"):
            json.loads(raw)
        elif not raw.startswith(b"%PDF-"):
            raise ValueError("Response is not a PDF")
        (DEST / name).write_bytes(raw)
        entry.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    except Exception as error:
        entry["error"] = str(error)
    return entry


def main():
    DEST.mkdir(parents=True, exist_ok=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        entries = list(executor.map(capture, SOURCES.items()))
    (DEST / "manifest.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
    print(DEST)
    for entry in entries:
        print(entry["file"], entry.get("error", f"OK {entry.get('bytes')} bytes"))
    if any("error" in entry for entry in entries):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
