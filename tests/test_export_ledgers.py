import json
import subprocess
from pathlib import Path


def test_export_ledgers_tool(tmp_path):
    snap = {
        'groups': {
            'all': {
                'day_ledger': [{'date': '2026-01-01', 'symbol': 'AAA'}],
                'lot_ledger': [{'date': '2026-01-01', 'event': 'BUY'}]
            }
        }
    }
    snap_path = tmp_path / 'snapshot.json'
    snap_path.write_text(json.dumps(snap))

    outdir = tmp_path / 'out'
    subprocess.check_call(['python', 'tools/export_ledgers.py', str(snap_path), '--outdir', str(outdir)])

    assert (outdir / 'all_day_ledger.json').exists()
    assert (outdir / 'all_lot_ledger.json').exists()
