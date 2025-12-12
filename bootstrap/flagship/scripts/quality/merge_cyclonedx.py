#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def _load(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def _dedup_append(target, items):
    if not isinstance(items, list):
        return
    if not isinstance(target, list):
        target[:] = []
    seen = {json.dumps(entry, sort_keys=True) for entry in target if isinstance(entry, dict)}
    for entry in items:
        if not isinstance(entry, dict):
            continue
        signature = json.dumps(entry, sort_keys=True)
        if signature not in seen:
            target.append(entry)
            seen.add(signature)


def merge(syft_path: Path, cargo_path: Path) -> bool:
    syft = _load(syft_path, {})
    cargo = _load(cargo_path, {})

    if not cargo:
        return False

    syft.setdefault("components", [])
    syft.setdefault("dependencies", [])

    _dedup_append(syft["components"], cargo.get("components"))
    _dedup_append(syft["dependencies"], cargo.get("dependencies"))

    with syft_path.open("w", encoding="utf-8") as fh:
        json.dump(syft, fh)
    return True


def main() -> int:
    if len(sys.argv) != 3:
        print("merge_cyclonedx.py <syft.json> <cargo.json>", file=sys.stderr)
        return 2
    syft_path = Path(sys.argv[1])
    cargo_path = Path(sys.argv[2])
    merged = merge(syft_path, cargo_path)
    if merged:
        print("Rust cargo CycloneDX merged into SBOM")
    else:
        print("INFO: cargo CycloneDX data empty → nothing merged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
