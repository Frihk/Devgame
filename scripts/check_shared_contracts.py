#!/usr/bin/env python3
"""
check_shared_contracts.py

Verifies that the enum string values in shared/enums/*.js match the
corresponding Go constants in backend/internal/models/*.go. This is the
automated check docs/ARCHITECTURE.md Section 5 calls for -- run it as part
of CI or before any PR that touches shared/ or internal/models/.

Usage:
    python3 scripts/check_shared_contracts.py

Exits non-zero and prints a diff-style report if anything is out of sync.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def extract_js_enum_values(path):
    """Pull 'KEY: 'value'' pairs out of an Object.freeze({...}) block."""
    text = path.read_text()
    values = set()
    for m in re.finditer(r"""['"]([a-z0-9_]+)['"]\s*,?\s*(?://.*)?$""", text, re.MULTILINE):
        values.add(m.group(1))
    return values

def extract_go_const_values(path):
    """Pull string literals assigned to typed consts."""
    text = path.read_text()
    values = set()
    for m in re.finditer(r"""=\s*['"]([a-z0-9_]+)['"]""", text):
        values.add(m.group(1))
    return values

PAIRS = [
    ("shared/enums/gameStatus.js", "backend/internal/models/game.go"),
    ("shared/enums/playerActions.js", "backend/internal/models/actions.go"),
]

def main():
    ok = True
    for js_rel, go_rel in PAIRS:
        js_path = ROOT / js_rel
        go_path = ROOT / go_rel
        if not js_path.exists() or not go_path.exists():
            print(f"SKIP  {js_rel} <-> {go_rel} (one or both files missing)")
            continue

        js_values = extract_js_enum_values(js_path)
        go_values = extract_go_const_values(go_path)

        only_js = js_values - go_values
        only_go = go_values - js_values

        if only_js or only_go:
            ok = False
            print(f"MISMATCH  {js_rel} <-> {go_rel}")
            if only_js:
                print(f"  in JS but not Go: {sorted(only_js)}")
            if only_go:
                print(f"  in Go but not JS: {sorted(only_go)}")
        else:
            print(f"OK    {js_rel} <-> {go_rel}  ({len(js_values)} values match)")

    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
    