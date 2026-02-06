#!/usr/bin/env python3
"""Export lot/day ledgers from portfolio snapshot JSON."""

import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot', help='Path to portfolio snapshot json')
    parser.add_argument('--group', default='all')
    parser.add_argument('--outdir', default='ledger_exports')
    args = parser.parse_args()

    payload = json.loads(Path(args.snapshot).read_text())
    group = payload.get('groups', {}).get(args.group)
    if not group:
        raise SystemExit(f'group not found: {args.group}')

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    day_path = outdir / f'{args.group}_day_ledger.json'
    lot_path = outdir / f'{args.group}_lot_ledger.json'
    day_path.write_text(json.dumps(group.get('day_ledger', []), ensure_ascii=False, indent=2))
    lot_path.write_text(json.dumps(group.get('lot_ledger', []), ensure_ascii=False, indent=2))

    print(f'exported: {day_path}')
    print(f'exported: {lot_path}')


if __name__ == '__main__':
    main()
