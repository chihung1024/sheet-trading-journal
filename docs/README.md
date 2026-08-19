# Documentation Map

`docs/` 保存解決實際工程問題時才需要的知識：architecture、contracts、runbooks、RCA、closeouts、acceptance evidence 與歷史紀錄。它不是第二套治理系統。

## Active work

目前工作只需要依序取得：

`AGENTS.md → to_do_update_list.md → relevant code/contracts/docs → current Git/PR/CI/runtime truth`

- `../AGENTS.md` — 唯一 Active Governance。
- `../to_do_update_list.md` — 唯一持續執行記憶：CURRENT / NEXT / ROADMAP / durable decisions-risks。
- `../README.md` — 產品、架構、開發與測試導覽。
- `DEPLOYMENT.md` — deployment / production 操作需要時才讀的 runbook。

Remote/runtime truth 與 machine-readable contracts 高於 stale prose。Historical PASS 只證明當時綁定的 candidate/evidence，不自動代表現在狀態。

## Directory roles

- `engineering/` — architecture decisions、長期有價值的 RCA、active/closed engineering plans 與 closeouts。
- `governance/`、`governance/evidence/` — 歷史 acceptance/recovery/audit evidence 與仍被 code/tests 使用的 machine-readable controls；不是 Active Governance。
- `audits/` — 歷史稽核證據。
- `archive/` — 已退出 current execution 的歷史資料。

舊文件中的 Playbook、Gate、V3、Execution Lock 等名稱只是歷史脈絡，不再具有 current execution authority。

## Machine-readable controls

不要因為簡化 prose governance 而移除真正的系統保護。需要時以實際 code/tests/config 為準，例如：

- `../worker-manifest.json`
- `../config/deployment-environments.json`
- `../config/production-activation-authority.json`
- `../config/recovery-evidence-gate.json`
- `governance/github-actions-pins.json`
- `governance/python-coverage-baseline.json`
- current `.github/workflows/*.yml`
- current verifier/test code under `tools/` and `tests/`

## Documentation rule

優先更新既有權威文件。只有內容具有獨立長期價值時才新增 durable document，例如 contract/specification、architecture decision、reusable runbook、material RCA 或重要 closeout evidence。

不要為 transient hypothesis、單次 CI、每個 shell command、一般 formatting 或重複摘要建立新文件。

歷史紀錄保留其當時事實，不為了配合現在架構而重寫；current execution state 應回到 `to_do_update_list.md`，即時事實回到 Git/PR/CI/runtime。
