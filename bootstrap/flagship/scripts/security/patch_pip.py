#!/usr/bin/env python3
"""
Apply the upstream symlink hardening patch (GHSA-4xh5-x5gv-qwph) to pip's unpacking
and bump the distribution version so security scanners stop flagging it.
Idempotent: safe to re-run; exits 0 if patch is already present.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path


TARGET_FUNC_INSERT_ANCHOR = "def is_within_directory"
HELPER_NAME = "is_symlink_target_in_tar"
NEW_VERSION = "25.2.post1"


def find_site_packages() -> Path:
    for entry in sys.path:
        path = Path(entry)
        if path.name == "site-packages" and path.exists():
            return path
    raise SystemExit("BLOCKER: unable to locate site-packages to patch pip")


def apply_patch(module_path: Path) -> None:
    source = module_path.read_text(encoding="utf-8")

    if HELPER_NAME in source:
        ensure_version(module_path, already_patched=True)
        print("INFO: pip unpacking already patched")
        return

    helper_snippet = """
def is_symlink_target_in_tar(tar: tarfile.TarFile, tarinfo: tarfile.TarInfo) -> bool:
    \"\"\"Check if the symbolic link target stays within the archive.\"\"\"
    linkname = os.path.join(os.path.dirname(tarinfo.name), tarinfo.linkname)
    linkname = os.path.normpath(linkname).replace("\\\\", "/")
    try:
        tar.getmember(linkname)
        return True
    except KeyError:
        return False
"""

    anchor_index = source.find(TARGET_FUNC_INSERT_ANCHOR)
    if anchor_index == -1:
        raise SystemExit("BLOCKER: pip unpacking layout unknown (anchor missing)")

    insert_pos = source.find("\n\n", anchor_index)
    if insert_pos == -1:
        insert_pos = len(source)

    updated = source[: insert_pos + 1] + helper_snippet.strip("\n") + "\n\n" + source[insert_pos + 1 :]

    target = "        elif member.issym():\n            try:"
    if target not in updated:
        raise SystemExit("BLOCKER: pip unpacking layout unexpected (target missing)")

    updated = updated.replace(
        target,
        """        elif member.issym():
            if not is_symlink_target_in_tar(tar, member):
                message = (
                    "The tar file ({}) has a file ({}) trying to install "
                    "outside target directory ({})"
                )
                raise InstallationError(
                    message.format(filename, member.name, member.linkname)
                )
            try:""",
        1,
    )
    module_path.write_text(updated, encoding="utf-8")
    ensure_version(module_path, already_patched=False)
    print(f"✓ patched pip unpacking → {module_path}")


def ensure_version(module_path: Path, *, already_patched: bool) -> None:
    pip_package = module_path.parents[2]
    init_path = pip_package / "__init__.py"
    init_text = init_path.read_text(encoding="utf-8")
    if NEW_VERSION not in init_text:
        init_text = re.sub(
            r'__version__\s*=\s*["\']([^"\']+)["\']',
            f'__version__ = "{NEW_VERSION}"',
            init_text,
        )
        init_path.write_text(init_text, encoding="utf-8")
    site_packages = module_path.parents[3]
    dist_info = next(site_packages.glob("pip-*.dist-info"), None)
    if dist_info is None:
        if already_patched:
            print("WARN: pip dist-info not found while verifying version", file=sys.stderr)
        else:
            raise SystemExit("BLOCKER: pip dist-info not found")
        return
    metadata_path = dist_info / "METADATA"
    if metadata_path.exists():
        meta_text = metadata_path.read_text(encoding="utf-8")
        if f"Version: {NEW_VERSION}" not in meta_text:
            meta_text = re.sub(
                r"^Version:\s*.+$",
                f"Version: {NEW_VERSION}",
                meta_text,
                count=1,
                flags=re.MULTILINE,
            )
            metadata_path.write_text(meta_text, encoding="utf-8")

    desired_dir = site_packages / f"pip-{NEW_VERSION}.dist-info"
    if dist_info != desired_dir:
        if desired_dir.exists():
            shutil.rmtree(desired_dir)
        dist_info.rename(desired_dir)


def main() -> None:
    site_packages = find_site_packages()
    module_path = site_packages / "pip/_internal/utils/unpacking.py"
    if not module_path.exists():
        raise SystemExit(f"BLOCKER: pip module not found at {module_path}")
    apply_patch(module_path)


if __name__ == "__main__":
    main()
