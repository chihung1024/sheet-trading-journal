# AI_PROJECT_EXECUTION_LOCK.md

# AI 持續執行鐵律 — Owner-Locked Amendment V1.0

Status: **LOCKED / ACTIVE**  
Owner authorization: **2026-08-19**  
Scope: ChatGPT / Codex / AI Agents / Sub-Agents / Review Agents / automated coding workflows working on this Repository.

---

## 0. Authority and purpose

本文件是 `AI_PROJECT_PLAYBOOK.md` 的 **Owner-Locked execution-control amendment**，目的只有一個：

> **禁止 AI 把「下一步要做什麼」當成工作成果，禁止在仍可執行時用短篇狀態回報結束回合，禁止形成「使用者必須一直回覆繼續，AI 才再從頭開始」的無限迴圈。**

本文件不取代既有的 Root Cause、Risk、Scope、Testing、Git、PR、CI/CD、Rollback 與 Handoff 規範；它鎖定的是「何時可以停止執行」與「何時可以要求使用者再次介入」。

若一般流程規範與本文件衝突，在 Repository 工程治理範圍內，採 **較嚴格且能維持持續執行** 的規則。

平台 / 系統安全規則與使用者當下明確指令仍具有更高優先權。

---

# 1. Continuous Execution Rule — 持續執行為預設

當使用者已授權一個 Primary Goal、Phase、Batch 或明確要求「繼續／持續開發」時：

```text
Inspect
→ Evidence
→ Plan
→ Implement
→ Validate
→ Regression
→ Document
→ Commit
→ PR / CI / Merge / Deploy（依適用性與既有授權）
→ 下一個已核准工作
```

應持續往前執行。

以下內容 **永遠不是合法停止點**：

- 「我接下來會查看 CI」
- 「我會先取得 failing assertion」
- 「下一步要追 Root Cause」
- 「我準備修改以下檔案」
- 「接下來會跑 regression」
- 「我找到問題，下一步會修」
- 單純完成一個 micro Task
- 單純完成 evidence collection
- 單純形成 plan
- 單純寫出 next action

只要目前授權範圍內仍有可執行工作，而且工具可用，就必須 **直接執行下一個 tool / coding / verification action**，不得用 final response 取代執行。

---

# 2. Final Response Gate — Final 不是進度提示

AI 必須知道：

> **一旦送出 final response，該次執行回合即結束；不存在「final 之後仍會在背景繼續開發」這件事。**

因此，在 Continuous Development Mode 下，final response 只允許於以下情況：

## A. Requested Goal / Phase 已完成

目前使用者要求的 Primary Goal 或已授權 Phase 已完成，並形成可驗證 Stable State。

若只完成其中一個 Batch，而下一個 Batch 已在既定 Master Plan 內、已被授權、沒有 Scope Expansion 或新決策需求，則：

> **Batch completion 是 checkpoint，不是自動停止點。**

應先完成該 Batch 的驗證、Commit、Handoff，再直接進入下一個已核准 Batch。

## B. Genuine Human Action Required

確實需要使用者本人完成 AI 無法代辦的事項，例如：

- 必須由本人登入 / MFA / 授權
- AI 無法取得且不得自行產生的 secret / credential
- 外部平台只允許 owner 執行的不可替代動作
- 必須由使用者做產品 / 法務 / 風險取捨的實質決策
- 不可逆或高風險操作依既定規則必須取得 owner confirmation

## C. Hard Tool / Permission / External Blocker

已經有證據證明目前工具、權限或外部系統使工作無法繼續，且已嘗試合理替代路徑仍不能完成。

## D. User Explicitly Requests Stop / Pause / Status-Only

使用者明確要求停止、暫停，或只要求當下狀態而沒有要求繼續執行。

除此之外，不得因「方便回報」、「已經分析一段」、「工具呼叫很多次」、「下一步很明確」而自行停止。

---

# 3. No Human Continue Button — 禁止把使用者當 Continue 按鈕

已取得的一般開發授權不得每個 Task 重問一次。

禁止：

```text
AI 做一小段
→ 回覆「下一步我會做 X」
→ 等使用者說「繼續」
→ 重新 preflight
→ 再做一小段
→ 再等「繼續」
```

正確模式：

```text
一次 takeover preflight
→ 鎖定 Stable State / Current Phase / Current Batch / Current Task
→ 持續執行
→ 每批形成 checkpoint
→ 無新決策則自動進下一個已核准工作
→ Goal / Phase 完成或 Genuine Blocker 才停止
```

一般性的：

- repository read
- evidence collection
- code edit
- test
- lint / type check / build
- branch / commit
- 已授權流程中的 PR 更新
- CI 查證 / retry（非濫用）
- documentation / handoff update

不得因為只是進入下一個 Task 而再次要求一般授權。

---

# 4. Resume, Do Not Restart — 新回合不得無限重頭開始

新的 Conversation / Agent / Model 接手時，第一次 takeover 必須依既有規範完成必要 preflight：

1. `AI_PROJECT_EXECUTION_LOCK.md`
2. `AI_PROJECT_PLAYBOOK.md`
3. `README.md`
4. `to_do_update_list.md`
5. GitHub remote truth / current PR / CI / deployment truth（依工作適用性）

完成 takeover 後，應鎖定：

```text
Stable State
Current Primary Goal
Current Phase
Current Batch
Current Task
Locked Decisions
Exact Branch / PR / Head SHA
Next Executable Action
```

後續同一工作鏈不得因每一則使用者訊息而重新建立 Master Plan 或重新從 README 開始。

只有以下情況才重新做完整 baseline reconciliation：

- 新 Agent / 新 Session 真正接手
- remote head / PR / deployment truth 已明顯改變
- 使用者改變 Primary Goal
- Critical / High Impact evidence 迫使重新評估
- 既有 durable state 無法可信地恢復

即使需要重新查證 remote truth，也應以 **resume current work** 為目的，不得把查證本身變成新的停點。

---

# 5. Blocker Quality Gate — 要求使用者介入前的最低證據

若要停止並要求使用者處理，必須一次說清楚：

```text
1. Blocker 是什麼
2. Evidence 是什麼
3. 已嘗試哪些替代方法
4. 為何 AI / 現有工具確實無法自行完成
5. 使用者最少需要做什麼
6. 在哪個畫面 / 系統操作
7. 每一步按什麼 / 輸入什麼
8. 完成後應回報什麼可驗證結果
9. AI 收到結果後會從哪個 exact checkpoint 繼續
```

以下理由本身不足以要求使用者介入：

- 「我不確定」但尚未查證
- 「可能需要登入」但尚未嘗試可用 connector / API / alternate path
- 「下一步比較適合你做」
- 「需要你確認我可以繼續」但該權限早已授予
- 「我先停在這裡」

---

# 6. Root Cause / Implementation Discipline 不得被本規則削弱

持續執行不等於 shotgun execution。

仍必須遵守：

```text
Reproduce
→ Evidence
→ Hypotheses
→ Trace
→ Isolate
→ Root Cause
→ Impact Analysis
→ Minimum Correct Fix
→ Regression
→ Prevention
```

以及：

- Primary Active Batch 原則維持 1
- 每個 Batch 仍須 Scope Lock
- 每批完成後仍須形成 Stable State / Commit / Rollback Point
- 新發現仍須 NOW / NEXT / BACKLOG / REJECT 收斂
- 不得用「持續執行」當理由無限擴張 Scope
- 不得跳過必要 Review / CI / Security / Data Integrity Gate

本鐵律要求的是：

> **不中途無故停止，不是一次性亂改。**

---

# 7. Completion Evidence Rule

當最終真的可以停止時，final report 至少應明確區分：

```text
Primary Goal
Completed Scope
Root Cause（若為 Debug）
Files / Systems Changed
Verification
Regression
CI / Build
Commit / PR / Merge
Deployment（若適用）
Rollback / Recovery Point
NOT VERIFIED items
Deferred / Backlog
Actual blocker（若有）
```

如果 final report 中的 `Next Action` 仍屬目前已授權範圍、沒有 blocker、工具也可執行，則原則上：

> **該 Next Action 應先被執行，而不是只被寫出來。**

---

# 8. OWNER-LOCKED CHANGE GATE — 本規則不得自行修改

以下項目構成 **Protected Locked Rules**：

1. 本文件 `AI_PROJECT_EXECUTION_LOCK.md` 的全部規則。
2. `AGENTS.md` 中要求優先讀取本文件、承認本文件 lock status、以及 Special Approval Gate 的條款。
3. Repository 內任何其他文件中，用來實質承接、引用、保障上述規則效力的條款。

「修改」不只包含直接 edit，也包含：

- delete
- rename / move 以使其失效
- weaken
- bypass
- supersede
- 加入相反規則
- 以其他文件降低其優先級
- 改寫成 optional / advisory
- 以 refactor / cleanup 名義移除
- 以新 Model / Agent / Session 為理由重新解釋或重置

## Special Approval 必要條件

任何 Protected Locked Rules 的修改，**必須先取得 Repository Owner 新一輪、針對該具體修改的特別同意**。

在取得特別同意前，AI 必須先提供：

```text
Original Rule
Proposed Exact Change
Reason / New Evidence
Behavioral Impact
Risk
Migration / Compatibility Impact
Rollback
Why Existing Rule Is Insufficient
```

然後等待 owner 對這個具體修改明確表示特別同意。

以下 **不算** Special Approval：

- 「繼續」
- 「同意」但沒有對應已提出的 locked-rule change
- 「給你所有權限」
- 一般開發授權
- PR / merge 授權
- Debug / refactor 授權
- 新 Session 中沿用的舊授權
- 其他 Agent 自行判斷「應該可以改」

只有在 owner 已看到具體 proposed change 後，明確授權修改這些 Locked Rules，才可以執行 write。

## No Pre-Approval Write

在 Special Approval 取得之前，不得先：

- 修改 locked file
- 建立用來實質改寫 locked rule 的 commit
- 建立已包含 locked-rule change 的 PR
- 用別的 policy file 先行繞過

可以做的只有 read / analysis / proposed diff。

## Conflict Is Also A Locked-Rule Change

未直接修改本文件，但在其他文件加入與本文件衝突、削弱或繞過的規則，視同修改 Protected Locked Rules，一樣需要 Special Approval。

---

# 9. Governance Change Isolation

未來若真的取得 Special Approval 要修改本鐵律：

- 必須使用獨立 governance Batch / PR
- 不得與 feature / bugfix / refactor 混在同一 PR
- 必須保留 before / after diff
- 必須記錄 owner special approval 的來源與日期
- 必須完成適用的 governance review
- 不得用 squash / rewrite 抹除「為何修改」的可追溯性

---

# 10. Enforcement Summary

對任何 AI：

```text
Work remains executable?
YES
↓
Continue executing.
Do not final merely to describe the next action.
```

```text
Need user intervention?
YES
↓
Prove the blocker first.
Give exact minimal steps.
Resume from exact checkpoint afterward.
```

```text
Want to change these rules?
YES
↓
Read-only analysis + exact proposed diff first.
Obtain NEW explicit OWNER SPECIAL APPROVAL.
Only then may write.
```

核心鐵律：

> **不要把「下一步」當成果。**
>
> **不要把使用者當 Continue 按鈕。**
>
> **已核准的工作要持續做到真正的 Stable Completion 或真正的 Blocker。**
>
> **本鐵律不得由 AI 自行弱化；任何修改都必須重新取得 owner 對具體變更的特別同意。**
