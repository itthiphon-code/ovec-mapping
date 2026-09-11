#!/usr/bin/env python3
"""Offline validation of the latest captured sample and design regression case."""
import hashlib
import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    snapshots = sorted((root / "docs" / "evidence").glob("*/manifest.json"))
    if not snapshots:
        raise SystemExit("No evidence snapshot. Run capture_sources.py first.")
    manifest_path = snapshots[-1]
    base = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())
    for entry in manifest:
        if "error" in entry:
            raise ValueError(f"Capture failed: {entry['file']}: {entry['error']}")
        data = (base / entry["file"]).read_bytes()
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Checksum/size mismatch: {entry['file']}")
        if entry["status"] != 200:
            raise ValueError(f"Unexpected status: {entry['file']}")
        if entry["file"].endswith(".json"):
            json.loads(data)
        elif not data.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF signature")

    def read(name):
        return json.loads((base / name).read_text())

    for first, second, collection, identity in [
        ("tpqi-search-page1.json", "tpqi-search-page2.json", "results", lambda r: r["id"]),
        ("subject-search-offset0.json", "subject-search-offset2.json", "subjects",
         lambda r: (r["code"], r["deptCode"])),
    ]:
        a, b = read(first)[collection], read(second)[collection]
        if len(a) != 2 or len(b) != 2 or set(map(identity, a)) & set(map(identity, b)):
            raise ValueError("Sample pagination did not advance cleanly")

    standard = read("tpqi-detail-22.json")
    unit = standard["levels"][0]["units"][0]
    element = unit["elements"][0]
    if not all(key in element for key in ("eoc_code", "eoc_desc", "pc_items", "assess_items")):
        raise ValueError("Standard schema changed; review adapter design")
    course = read("subject-20100-1001.json")
    if not course["success"] or "CIP-NPEC-103B" not in course["standardRef"]:
        raise ValueError("Sample reference changed; update source audit after review")
    reference = read("reference-20100-1001.json")["refs"][0]
    if reference["library"]["levelExact"] is not False or reference["levels"] != [3]:
        raise ValueError("Observed mismatch case changed; re-inspect, do not assume defect remains")
    if reference["library"]["levelNo"] != 4:
        raise ValueError("Suggested level changed; re-inspect audit")
    if course["pdfPage"] != 57:
        raise ValueError("Source PDF locator changed")
    print(f"PASS: {len(manifest)} file checksums, JSON/PDF signatures, two pagination samples,")
    print("standard schema and documented reference mismatch regression case.")
    print("Snapshot:", base)
    print("Scope: sample integrity only; not full source completeness or expert approval.")


if __name__ == "__main__":
    main()
