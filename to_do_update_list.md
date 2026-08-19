# Project Execution Memory

本文件是專案的持續執行記憶。

原則：CURRENT 要精確；NEXT 要有順序；ROADMAP 可隨新證據調整；歷史持續壓縮。Git / PR / CI / runtime truth 高於本文件中的舊快照。

Last updated: **2026-08-19 Asia/Taipei**

## CURRENT

**Primary Goal**
- 完成 UX-R1 — Adaptive Workspace & Responsive Interaction，優先改善實際使用者工作空間、響應式操作與可讀性，不改變既有財務/資料 authority。

**Current Batch**
- UX-R1.3 — Responsive Navigation.

**Stable State**
- UX-R1.1 已完成，exact-head CI success。
- UX-R1.2 已完成，exact-head CI success。
- UX-R1.3 implementation 已存在於 PR #387；目前仍在驗證/除錯階段，尚未進入 R1.4。

**Branch / PR / HEAD**
- Branch: `feat/ux-r1-adaptive-workspace`
- PR: #387 — OPEN / DRAFT
- Head: `e1e73ee57abfeed07974f50943211e6d067253d1`

**Verified**
- PR #387 remote body：R1.1、R1.2 complete；R1.3 active；R1.4–R1.8 sequential。
- Current exact-head CI #1393 / run `32207671772`: FAILURE。
- 目前 CI failure 是需要解決的 active engineering work，不是 project blocker。

**Blocker**
- NONE.

**Exact Next Action**
- 取得 PR #387 current failed job 的 raw execution evidence，確認 R1.3 precise failing assertion；依 First-Principles Debug trace 到 broken invariant / Root Cause，再做 minimum correct fix、targeted regression 與 relevant CI verification。不要依 job/check 名稱猜 Root Cause，也不要重做整個 UX-R1 preflight。

## NEXT

1. [ ] UX-R1.4 — Holdings + Records adaptive work surfaces；依 current product-surface decision保留主要搜尋/篩選/分頁/refresh/Backup JSON，已退出 normal product surface 的 import/restore UI 不再投入 responsive polish。
2. [ ] UX-R1.5 — Overview + Charts workspace adaptation。
3. [ ] UX-R1.6 — Dividends + Cash + Groups adaptive layouts。
4. [ ] UX-R1.7 — accessibility / keyboard / zoom / reflow / reduced-motion / safe-area verification。
5. [ ] UX-R1.8 — exact-head validation、review、merge、Pages/deployment verification、closeout。

## ROADMAP

### Near Term
- 完成 UX-R1，不平行開另一條正式 implementation 主線。
- UX-R1 結束後，依最新產品使用價值、correctness evidence 與 current repository truth 選擇下一個 Primary Goal。

### Later
- 持續優先改善直接產品功能與 UX；只有實際阻塞產品、安全、資料/財務正確性或維護能力的技術工作才提升優先級。

### Candidates
- 舊 R3.3B Safe Ambiguous Import Retry 不再是 active/deferred roadmap；PR #367 已 CLOSED / NOT MERGED / NOT PLANNED。只有新證據或 Owner 明確重新排序時才重新評估。

## DURABLE DECISIONS / RISKS

- UX-R1 是 presentation/workspace phase：不得建立第二套 accounting/data/mutation authority；`TradeForm`、`activeView`、現有 record/holding projections 與 financial/data fail-closed semantics 仍維持單一 authority。
- Records 正常產品介面保留核心查找/篩選/分頁/refresh 與 **Backup JSON download**；IBKR/Canonical/mapped import UI、CSV template/mapping/receipt-retry entry points、Journal Restore UI 目前退出/凍結 normal product surface。既有 imported records 必須仍可讀/可 export；restore backend/migration/tests 暫保留 maintenance-only。
- `to_do_update_list.md` 不保存完整歷史、每次 tool call、每個 hypothesis 或 CI 流水帳；這些由 Git / PR / Actions / durable engineering docs 保存。
- 工作完成或狀態 materially 改變時，更新 CURRENT，將近期工作滑動前移並重新排序 NEXT / ROADMAP；不要 append 成 Project Diary。
