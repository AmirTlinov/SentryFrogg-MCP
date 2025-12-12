#!/usr/bin/env python3
import importlib
import inspect
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

PIP_VULN_ID = "GHSA-4xh5-x5gv-qwph"


def load(path: Path, default: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def npm_severity(data: Dict[str, Any]) -> Tuple[int, int]:
    metadata = data.get("metadata", {}) if isinstance(data, dict) else {}
    vulns = metadata.get("vulnerabilities", {}) if isinstance(metadata, dict) else {}
    return int(vulns.get("high", 0)), int(vulns.get("critical", 0))


def pip_patch_applied() -> bool:
    try:
        module = importlib.import_module("pip._internal.utils.unpacking")
    except Exception:
        return False

    if not hasattr(module, "is_symlink_target_in_tar"):
        return False

    if hasattr(module, "_untar_without_filter"):
        try:
            source = inspect.getsource(module._untar_without_filter)
        except (TypeError, OSError, AttributeError):
            return False
        return (
            "is_symlink_target_in_tar" in source
            and "raise InstallationError" in source
            and "linkname" in source
        )

    try:
        untar_src = inspect.getsource(module.untar_file)
    except (TypeError, OSError, AttributeError):
        return False

    return (
        "is_symlink_target_in_tar" in untar_src
        and "raise InstallationError" in untar_src
        and "member.linkname" in untar_src
    )


def summarise_pip(
    pip_data: Any,
) -> Tuple[int, int, List[Dict[str, Any]], List[Dict[str, str]], Any]:
    high = crit = 0
    skipped: List[Dict[str, Any]] = []
    mitigations: List[Dict[str, str]] = []

    if isinstance(pip_data, dict):
        deps = pip_data.get("dependencies", [])
        high, crit, skipped, mitigations, sanitized_deps = summarise_pip(deps)
        sanitized = dict(pip_data)
        sanitized["dependencies"] = sanitized_deps
        return high, crit, skipped, mitigations, sanitized

    if isinstance(pip_data, list):
        sanitized: List[Dict[str, Any]] = []
        patch_present = pip_patch_applied()
        for package in pip_data:
            entry: Dict[str, Any] = {k: v for k, v in package.items() if k != "vulns"}

            skip_reason = package.get("skip_reason")
            if skip_reason:
                if (
                    package.get("name") == "pip"
                    and patch_present
                    and "Dependency not found on PyPI" in skip_reason
                ):
                    mitigations.append(
                        {
                            "package": "pip",
                            "vulnerability": PIP_VULN_ID,
                            "status": "local patched build (pip-audit skip)",
                        }
                    )
                    entry["vulns"] = []
                    sanitized.append(entry)
                    continue
                skipped.append({"name": package.get("name"), "reason": skip_reason})
                entry["vulns"] = package.get("vulns", [])
                sanitized.append(entry)
                continue

            vulns_out: List[Dict[str, Any]] = []
            for vuln in package.get("vulns", []):
                vuln_entry = dict(vuln)
                vuln_id = vuln_entry.get("id")

                if (
                    package.get("name") == "pip"
                    and vuln_id == PIP_VULN_ID
                    and patch_present
                ):
                    mitigations.append(
                        {
                            "package": "pip",
                            "vulnerability": vuln_id,
                            "status": "local patch detected",
                        }
                    )
                    continue

                severity = (vuln_entry.get("severity") or "").upper()
                if severity == "CRITICAL":
                    crit += 1
                elif severity == "HIGH":
                    high += 1
                elif severity:
                    pass
                else:
                    high += 1
                    vuln_entry["severity"] = "HIGH (assumed)"
                vulns_out.append(vuln_entry)

            entry["vulns"] = vulns_out
            sanitized.append(entry)
        return high, crit, skipped, mitigations, sanitized

    return high, crit, skipped, mitigations, pip_data


def main(argv: List[str]) -> int:
    if len(argv) != 6:
        print(
            "aggregate.py usage: aggregate.py <npm_json> <npm_present> <pip_json> <pip_status> <out_json>",
            file=sys.stderr,
        )
        return 2

    npm_path = Path(argv[1])
    npm_present = argv[2] == "1"
    pip_path = Path(argv[3])
    pip_status = argv[4]
    out_path = Path(argv[5])

    npm_data = load(npm_path, {}) if npm_present else None
    pip_default: Any = [] if pip_status == "ran" else {}
    pip_data = load(pip_path, pip_default)

    npm_high, npm_crit = npm_severity(npm_data or {})
    pip_high, pip_crit, pip_skipped, mitigations, pip_sanitized = summarise_pip(pip_data)

    summary = {
        "npm": {"high": npm_high, "critical": npm_crit, "present": npm_present},
        "pip": {
            "high": pip_high,
            "critical": pip_crit,
            "skipped": pip_skipped,
            "status": pip_status,
        },
        "mitigations": mitigations,
    }

    report = {
        "npm": npm_data if npm_present else None,
        "pip": pip_sanitized,
        "summary": summary,
    }
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary_parts = [
        f"npm(high={npm_high}, critical={npm_crit})",
        f"pip(high={pip_high}, critical={pip_crit}, skipped={len(pip_skipped)}, mitigations={len(mitigations)})",
    ]
    print("Security audit summary → " + "; ".join(summary_parts))

    issues: List[str] = []
    if pip_status == "missing_tool":
        issues.append("pip-audit missing for detected Python stack")
    elif pip_status == "error":
        issues.append("pip-audit execution failed")
    elif pip_status == "ran" and pip_skipped:
        for entry in pip_skipped:
            issues.append(
                f"pip audit skipped {entry.get('name')}: {entry.get('reason')}"
            )

    total_highcrit = npm_high + npm_crit + pip_high + pip_crit
    strict = os.environ.get("CI_STRICT") == "1"

    if strict and total_highcrit > 0:
        issues.append("High/critical vulnerabilities detected")

    if strict and issues:
        for issue in issues:
            print(f"BLOCKER: {issue}", file=sys.stderr)
        return 2

    for issue in issues:
        print(f"INFO: {issue}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
