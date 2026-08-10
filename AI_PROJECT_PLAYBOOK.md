# AI\_PROJECT\_PLAYBOOK.md

# AI 協作開發最高規範 V3.0

## ChatGPT × Codex × AI Agents × GitHub × CI/CD × Deployment

> 核心哲學：
> **Broad Thinking, Narrow Execution.**
> **Evidence First, Risk-Proportional Governance.**
> **獨立審查重點是獨立推理與專業能力，不是不同人頭。**

---

# 0. 文件定位

本文件為本 Repository 的最高層級工程治理規範。

適用於：

- ChatGPT
- Codex
- AI Agent
- Sub-Agent
- Automated Coding Agent
- 人類開發者
- Reviewer

管理範圍包括：

- Research
- Planning
- Implementation
- Debug
- Refactor
- Test
- Review
- Git
- PR
- CI/CD
- Release
- Deployment
- Rollback
- Documentation
- AI Handoff

本文件的目的不是增加程序，而是：

> **以最低必要治理成本，取得足夠高的工程可信度。**

任何 Gate 如果沒有實際降低風險，就不應只因「流程上一直這樣做」而存在。

---

# 1. Repository 文件權威

專案至少維護：

```
README.md
AI_PROJECT_PLAYBOOK.md
to_do_update_list.md
docs/

```

各自職責：

## README.md

回答：

> 專案是什麼？架構是什麼？怎麼開發、執行、測試與部署？

不得拿 README 當即時進度表。

---

## AI\_PROJECT\_PLAYBOOK.md

回答：

> 開發、研究、審查、驗證與交接時應遵守什麼工程規則？

屬於穩定治理文件。

不應因單一 Feature 或 Bug 任意修改。

---

## to\_do\_update\_list.md

回答：

> 現在做到哪裡？為什麼？目前 blocker 是什麼？下一步是什麼？

它是 Repository 內的：

- Live Project Status
- Master Plan
- Current Phase
- Current Batch
- Decision Log
- Root Cause Log
- Risk Register
- Technical Debt
- Handoff Authority

但：

> **GitHub / CI / Deployment 等 Remote System 的即時狀態仍高於文件快照。**

執行重要操作前必須重新查證 remote truth。

---

## docs/

保存：

- Architecture
- Contracts
- ADR
- Research methodology
- API semantics
- Deployment runbooks
- Historical design records
- Versioned specifications

Versioned contract 不得被 live status 任意覆寫。

---

# 2. 最高工程原則

所有工作遵守：

1. **先理解，再修改。**
2. **先取得證據，再形成結論。**
3. **先找 Root Cause，再修症狀。**
4. **分析可以廣，Implementation 必須窄。**
5. **發現問題不等於立即修改問題。**
6. **每個 Batch 都要形成 Stable State。**
7. **驗證強度必須與風險相稱。**
8. **能自動驗證的，不靠人工猜測。**
9. **不能自動驗證的，才是 Review 的主要價值。**
10. **Workaround 不等於 Permanent Fix。**
11. **沒有驗證，不宣稱完成。**
12. **沒有充分證據，不重構穩定系統。**
13. **不為了通過自己的工作而降低 Gate。**
14. **不把流程本身當成成果。**
15. **重要決策必須可追溯。**
16. **重要修改必須可恢復。**
17. **下一個 AI 必須能只靠 Repository 接手。**
18. **新方向必須最終 NOW / NEXT / BACKLOG / REJECT。**
19. **專案要能完成 Phase，而不是永久優化。**
20. **最大化有效改善，不最大化修改量。**

---

# 3. 標準工程循環

一般重要工作：

```
Inspect
↓
Understand
↓
Collect Evidence
↓
Analyze
↓
Discover
↓
Converge
↓
Plan
↓
Implement
↓
Validate
↓
Review
↓
Stabilize
↓
Document
↓
Merge / Deploy when applicable

```

Debug：

```
Reproduce
↓
Evidence
↓
Hypotheses
↓
Trace
↓
Isolate
↓
Root Cause
↓
Impact
↓
Fix
↓
Regression
↓
Prevention

```

不得：

```
看到症狀
↓
猜一個原因
↓
大量修改
↓
Bug 好像消失

```

---

# 4. Risk-Proportional Governance

所有修改先依 **Impact Radius + Failure Consequence** 分級。

## R0 — Trivial

例如：

- typo
- 純文件非語意文字
- 無語意 formatting
- comment
- 不影響 behavior 的名稱說明

通常需要：

```
Self Review
+
必要的輕量驗證

```

不需要：

- Independent Review
- Full Regression
- Release Backup
- Production Smoke

除非實際影響更大。

---

## R1 — Local / Low Risk

例如：

- 局部 UI
- 非核心 helper
- isolated bug
- 小型 validation
- 低 impact configuration

需要：

- Targeted Tests
- Relevant Regression
- Self Review

Independent Review：

**建議但非強制**。

---

## R2 — Significant

例如：

- API behavior
- data model
- shared library
- architecture boundary
- quantitative methodology
- authentication-adjacent behavior
- deployment/runtime change
- shared state
- persistence
- portfolio calculation

需要：

- Targeted Tests
- Relevant Broad Regression
- Exact-head CI
- Rollback / Recovery Point
- Independent Review Gate
- Documentation/Handoff update

---

## R3 — Critical

例如：

- authentication / authorization
- security boundary
- secret handling
- destructive DB migration
- data corruption possibility
- trading/financial critical calculation
- irreversible migration
- production outage recovery
- high-impact infrastructure

需要：

- R2 全部
- Domain-appropriate specialist review
- Strong recovery evidence
- Full applicable validation
- Production verification when deployed

必要時：

- 人類 owner decision
- security scanner
- migration rehearsal
- second independent reviewer


## Docs Risk Escalation Rule

文件修改原則上屬低風險，但：

> **Docs-only ≠ Automatically Low Risk**

文件風險必須依「文件實際控制的系統行為與決策後果」判斷，而不是只看檔案副檔名。

### Governance Documents

例如：

```text
AI_PROJECT_PLAYBOOK.md
branch / release / review policies
security policies
deployment governance
```

如果修改會改變：

- Merge Gate
- Review Requirement
- Security Boundary
- Deployment Procedure
- Rollback Policy
- Required Validation

至少視為：

```text
R2 — Significant
```

### Versioned Contracts

例如：

- API contract
- Data contract
- Quant methodology
- Research methodology
- Persistence schema
- Migration semantics

即使只改 Markdown，如果內容改變系統應如何實作或解讀，不得視為普通 docs cleanup。

至少依實際 semantic impact 分類為 R2，必要時 R3。

### Operational Runbooks

如果錯誤文件可能導致：

- 錯誤 production deployment
- data loss
- incorrect rollback
- security misconfiguration
- irreversible command
- wrong environment mutation

Risk Class 應按最嚴重可能後果判斷。

### Pure Documentation

只有以下類型才通常維持 R0：

- typo
- grammar
- formatting
- non-semantic wording
- navigation/link cleanup
- 不改變任何 contract / decision / operation 的說明

核心規則：

```text
Risk(Document Change)
=
Risk of the Decision / Behavior the Document Controls
```

不是：

```text
Risk = low because file extension is .md
```

---

## Risk Classification Gate

每個非 trivial Batch 在 Implementation 前必須先確定 Risk Class：

```text
R0
R1
R2
R3
```

至少考慮：

```text
Behavior Impact
Data Impact
Security Impact
Financial / Quant Impact
Architecture Impact
Deployment Impact
Rollback Difficulty
Blast Radius
Contract / Governance Impact
```

### Higher-Risk Default Rule

如果有合理理由落在兩個 Risk Class 之間，例如 R1 或 R2，預設採較高 Risk Class，直到有 evidence 足以降級。

```text
Uncertainty
→ Higher-Risk Default
→ Evidence
→ Optional Downgrade
```

不得反過來：

```text
先選低風險
→ 為了減少 Gate 再合理化
```

### Risk Downgrade

Risk Class 可以降級，但必須有理由。對 R2 / R3 的降級應留下簡短 evidence。

### Risk Upgrade

工作途中如果發現：

- wider blast radius
- security issue
- data integrity issue
- irreversible behavior
- hidden shared dependency
- methodology change
- contract change

立即重新分類。Risk Class 不是 Batch 開始後永遠固定。

### Final Risk Reclassification

> **對 R1 以上 Batch，Risk Class 必須在 final candidate / merge gate 前重新確認一次。**

Final Risk Classification 應依據：

- final diff
- actual behavior change
- discovered evidence
- actual blast radius
- contract / governance impact
- rollback characteristics
- current remote state

重新判定。

Initial Risk Class 不因 Batch 已開始而自動延續至 Merge。

若 final candidate 的實際影響高於初始判斷，應先完成 Risk Upgrade 及其新增適用 Gate，再進入 Merge。

若介於兩級之間且缺乏充分降級證據，仍適用：

```text
Uncertainty
↓
Higher-Risk Default
```

---

# 5. Gate Applicability Principle

不是每一個修改都執行所有 Gate。

每個 Gate 必須回答：

```
這個 Gate 在防止什麼 Failure Mode？

```

如果答案不明確：

> Gate 不應機械執行。

例如 docs-only PR：

通常不需要 production deployment smoke。

Quant methodology change：

即使沒有 UI change，也需要：

- mathematical invariants
- methodology review
- regression evidence

DB migration：

即使 diff 很小，也可能是 R3。

所以：

> **Diff Size ≠ Risk Level**

---

# 6. Controlled Divergence

允許主動發現：

- architecture issue
- bug
- security issue
- performance bottleneck
- technical debt
- test gap
- methodology weakness
- data integrity risk
- deployment risk

但是：

> **Discovery 不等於 Scope Expansion。**

所有新發現分類：

```
NOW
NEXT
BACKLOG
REJECT

```

---

# 7. NOW / NEXT / BACKLOG / REJECT

## NOW

不處理就無法安全完成目前 Batch。

典型條件：

- Root Cause 必需
- Critical Risk
- Strong Dependency
- Correctness blocker

---

## NEXT

有高價值，但不需要塞入目前 Batch。

建立下一個明確 Batch。

---

## BACKLOG

有價值但：

- urgency 低
- dependency 未成熟
- cost/risk 過高
- 不影響目前 correctness

---

## REJECT

目前沒有足夠：

```
Evidence × Benefit × Relevance

```

或：

Risk / Complexity 明顯高於 Benefit。

---

# 8. Scope Lock

Batch 開始時應定義：

```
Objective
In Scope
Out of Scope
Allowed Investigation
Expansion Trigger
Risk Class
Verification Plan

```

如果工作途中必須擴大範圍：

先回答：

> 新工作是 Root Cause 必要條件，還是「順便」？

除非属于 NOW：

不得直接塞入目前 Batch。

---

# 9. WIP Limit

原則：

```
Primary Active Batch = 1

```

允許少量 Supporting Work：

- Research
- Root Cause Investigation
- Review
- Test investigation

但是：

> 同一核心實作面必須有唯一 implementation owner。

Blocked Primary Batch 不代表所有研究活動停止。

可以進行不破壞 Single-Owner 原則的：

- design review
- evidence collection
- test planning
- security research

---

# 10. Root Cause Protocol

Bug 至少區分：

```
Symptom
Failure Point
Contributing Factor
Root Cause
Systemic Cause

```

但 RCA 深度與風險成比例。

## Lightweight RCA

R0/R1 可只記：

```
Symptom
Cause
Fix
Regression Protection

```

## Full RCA

R2/R3 或反覆 Bug 才要求：

```
Reproduce
Evidence
Hypotheses
Failure Point
Root Cause
Systemic Cause
Impact
Fix
Regression
Prevention

```

Five Whys：

**需要時使用，不是固定儀式。**

---

# 11. Workaround Policy

允許 Workaround：

- production incident
- upstream defect
- external API failure
- temporary platform issue
- time-sensitive restoration

至少記：

```
Root Cause
Workaround
Risk
Removal Condition
Permanent Fix / Decision

```

不得把 workaround 描述成：

> Root Cause Resolved。

---

# 12. Refactor Gate

Refactor 必須至少符合一項：

- architecture blocks requirement
- recurring bugs share systemic cause
- maintenance cost materially high
- testing impossible
- security issue
- performance bottleneck
- scalability limitation
- technical debt blocks roadmap

不能只因：

- prettier
- newer framework
- coding preference
- theoretical elegance

如果可能：

```
Behavior Change

```

與：

```
Refactor

```

分離。

---

# 13. Recovery Policy

不是每個 Commit 前都建立 Tag / Release。

## R0 / R1

通常：

```
clean commit / branch

```

已足夠作 recovery point。

## R2

重要修改前確認：

```
Known Good Commit
+
Rollback Path

```

## R3

視情況增加：

- tag
- release
- DB backup
- deployment snapshot
- configuration backup

原則：

> Recovery 成本應與 Failure Consequence 相稱。

---

# 14. Unknown Changes Protection

重要修改前確認：

```
git status

```

發現未知變更：

視為：

> Potential User / Other Agent Work

不得直接：

```
reset --hard
clean -fd
force checkout
force push

```

除非明確知道來源與後果。

---

# 15. Branch / Main Policy

重要工作避免直接修改：

```
main

```

建議：

```
feature/
fix/
refactor/
perf/
docs/
chore/
hotfix/

```

`main` 視為：

> Potential Production Candidate

不得放入：

- known broken code
- unverified experiment
- partial migration
- knowingly inconsistent contracts

---

# 16. Commit Principle

每個 Commit 應：

- 單一目的
- 能描述 Why
- 可理解
- 可 rollback
- 有可驗證意義

推薦：

```
feat:
fix:
refactor:
perf:
test:
docs:
chore:

```

不追求：

> 一個 Batch 一定只能一個 Commit。

如果多 Commit 能提高 auditability，可以合理拆分。

---

# 17. Validation Strategy

Validation 必須依 Impact Radius 選擇。

可能包含：

```
Static
Unit
Integration
Contract
Invariant
Regression
Build
E2E
Smoke
Deployment Verification

```

不要求每一項都執行。

---

# 18. Quantitative / Financial Changes

涉及：

- return
- CAGR
- drawdown
- covariance
- correlation
- optimization
- factor model
- bootstrap
- portfolio selection
- weighting
- risk metrics
- backtest methodology

至少考慮：

```
Reference Test
Invariant Test
Boundary Test
Determinism Test
Sample-Semantics Test
Look-ahead / Leakage Risk
Currency / Calendar Semantics

```

對量化修改：

> 「程式有跑完」不是充分驗證。

---

# 19. Testing and Review 不重複做同一件事

CI 適合證明：

- syntax
- type
- tests
- build
- deterministic assertions
- contract checks

Reviewer 主要檢查：

- requirement fit
- assumption validity
- architecture
- methodology
- missing test cases
- failure modes
- security semantics
- data semantics
- unintended behavior
- rollback feasibility

Reviewer 不應只重新跑一次 CI 然後宣布 PASS。

---

# 20. Independent Review Gate

V3.0 將：

```
Independent Third-Party Review

```

改為：

```
Independent Review Gate

```

Independent 的定義是：

> **獨立重新建立判斷，而不是不同 GitHub 帳號。**

---

# 21. Reviewer Independence

Reviewer 不得只接受：

```
Implementer Summary
→ 同意

```

必須重新取得關鍵證據：

```
Requirement
↓
Relevant Contracts
↓
Exact-head Diff
↓
Tests / CI
↓
Architecture / Methodology
↓
Risk
↓
Decision

```

即使 reviewer 是：

- 同一個 AI model
- 另一個 AI Agent
- Sub-Agent
- 人類
- 外部專家

都必須依此原則重新判斷。

---

# 22. Reviewer Competence

Reviewer 的價值取決於：

```
Independence × Relevant Competence

```

不是：

```
Different Person = Valid Reviewer

```

例如：

## Quant PR

應具備：

- statistics / finance / numerical-method reasoning
- sample semantics
- look-ahead awareness

## Security PR

應具備：

- auth/security reasoning
- threat modeling
- vulnerability understanding

## Deployment PR

應理解：

- runtime
- rollback
- infrastructure
- environment boundaries

## Documentation PR

應理解：

- source of truth
- actual architecture
- current remote state
- historical integrity

不具相關能力的 reviewer approval：

> 只能視為一般意見，不能自動提升工程可信度。


## Reviewer Competence Insufficiency Handling

Independent Reviewer 不只是要 independent，還必須足以判斷此次 change 的主要風險。

Review 開始前先判斷需要哪些能力，例如：

- Quant：statistics、numerical methods、financial methodology、sampling semantics
- Security：authentication、authorization、attack surface、secrets、dependency risk
- Deployment：runtime、CI/CD、cloud infrastructure、rollback
- Data：schema、migration、consistency、transaction semantics

Reviewer 能力不足時，不得以「看起來沒問題」取代判斷。應採以下之一：

### A. Narrow the Review Claim

例如：

```text
PASS:
API transport and regression

NOT REVIEWED:
statistical validity
```

### B. Obtain Specialist Review

如可用：

- specialist AI
- security scanner
- external expert
- domain-specific reference validation

### C. Strengthen Objective Evidence

例如：

- mathematical reference fixture
- invariant tests
- independent implementation comparison
- official specification
- reproducible benchmark
- migration rehearsal

### D. Leave Explicit Residual Risk

如果 specialist reviewer 不可得，而且不是必須停止的 R3 Critical，可以明確記錄 Residual Risk、Control 與 limitation，再依實際 residual risk 判斷是否可以 Merge。

### Critical Competence Gap

如果 change 為 R3，且 reviewer 無法判斷其核心 critical risk：

```text
Competence Insufficient
=
Review Gate Not Satisfied
```

不得靠沒有能力的 approval 取代。

---

# 23. AI Independent Reviewer Mode

對單人 AI-assisted Repository：

允許 AI Independent Review。

要求：

1. 不採信 implementer 的 PASS 結論。
2. 從 Repository / diff / contract 重建理解。
3. 明確指出 reviewed exact head。
4. 檢查 requirement 和 actual implementation 是否一致。
5. 尋找反例與 failure mode。
6. 檢查 existing tests 沒覆蓋的地方。
7. 不因自己之前參與設計就自動接受。
8. Findings 必須提供 evidence。

若可以使用另一個 Agent / model：

優先使用。

若沒有：

同一 AI 可進入明確的：

```
INDEPENDENT REVIEW MODE

```

但必須重新讀 primary evidence。


## Same-AI Independent Review Isolation Protocol

同一 AI 可以執行 Independent Review，但：

> **必須建立可驗證的 reasoning isolation，而不是換一個標題後重新同意自己。**

### Same-AI Review 必須重新建立 Evidence Set

Reviewer Mode 不得以 implementer summary 為主要證據。至少重新讀：

```text
Original Requirement
Applicable Contract / ADR
Exact Candidate Diff
Relevant Source Code
Relevant Tests
CI Evidence
Risk Classification
Rollback / Recovery
```

### Blind-to-Conclusion Principle

開始 Independent Review 時，應暫時忽略 implementer 的 PASS、READY、NO ISSUE、recommended merge 等結論。

Reviewer 必須自己回答：

```text
What can fail?
What assumption may be wrong?
What evidence is missing?
What would falsify this implementation?
Does the code actually satisfy the requirement?
```

### Adversarial Pass

R2 / R3 Same-AI Review 至少執行一次：

```text
Counterexample Search
Boundary Search
Failure-Mode Search
Regression Search
Assumption Challenge
```

對 Quant / Financial 另外檢查：

```text
sample semantics
look-ahead
survivorship
currency
calendar
determinism
mathematical invariants
```

### Implementation Context Separation

如果能力允許，優先使用：

1. different Agent
2. different model
3. isolated Sub-Agent
4. fresh review context

若只有同一 AI，仍可執行，但必須明確標記：

```text
Reviewer Type:
Same-AI Independent Review

Isolation Method:
fresh evidence reconstruction + adversarial review
```

### Reviewer / Implementer Role Separation

Independent Review 期間，Reviewer 不得同時修改正在被審查的 candidate。

如果 Review 發現 BLOCKER：

```text
Review
↓
Record Finding
↓
Exit Reviewer Mode
↓
Implementation / Fix
↓
Validation
↓
New Exact Candidate Head
↓
Focused Re-Review
```

禁止：

```text
Review
↓
Discover Problem
↓
Silent Fix
↓
Continue Same Review
↓
PASS
```

Reviewer 必須讓 finding、fix、validation、reviewed candidate 之間保持清楚的 audit trail。

> **任何 material fix 都會產生新的 candidate head；原 review conclusion 不自動繼承。**

Material change 包括但不限於：

- behavior
- methodology
- API semantics
- data semantics
- security behavior
- persistence
- architecture
- deployment behavior

Non-material change，例如純 typo 或不改語意的 formatting，可依 `Exact-Head Principle` 執行 focused re-review，而不需要重新進行完整 Review。

Same-AI Independent Review 的 independence 來自：

```text
Role Separation
+
Fresh Evidence Reconstruction
+
Adversarial Reasoning
+
Exact-Head Discipline
```

不是單純宣告進入 Reviewer Mode。

### Prohibited Same-AI Review

以下不算 Independent Review：

```text
I wrote it
↓
I remember why
↓
Looks correct
↓
PASS
```

也不算：

```text
CI green
↓
therefore architecture/methodology is correct
```

CI 是 evidence，不是全部 reasoning。

---

# 24. Review Level

## R0

Self Review 足夠。

## R1

Self Review 必須。

Independent Review 視風險選擇。

## R2

Independent Review 必須。

## R3

Independent domain review 必須。

必要時：

```
Two independent perspectives

```

但沒有意義的第二個人頭不得取代能力審查。

---

# 25. Review Findings

只分類：

```
BLOCKER
FOLLOW-UP
BACKLOG
REJECT

```

## BLOCKER

不解決不能 Merge。

## FOLLOW-UP

值得改善，但不阻止目前 Merge。

## BACKLOG

未來候選。

## REJECT

Reviewer 建議經評估後不採用。

Review 不得製造：

```
Infinite Improvement Loop

```

---

# 26. Review Convergence

Round 1：

可以廣泛尋找 correctness risk。

Round 2：

集中於已知 BLOCKER。

之後：

只確認 blocker resolution。

除非出現新的：

```
Critical Evidence

```

不得每輪重新發明專案。

Review round 數量不是固定 KPI。

---

# 27. Exact-Head Principle

對 R2 / R3：

Review 與最終 CI 必須對應：

```
Exact Candidate Head

```

如果 review 後又修改程式：

必須判斷修改是否：

### Non-material

例如：

- typo
- comment

可做 focused re-review。

### Material

例如：

- behavior
- method
- security
- API
- data

必須重新驗證受影響部分。

重要 merge 應使用：

```
expected head SHA

```

避免 reviewed head 與 merged head 不一致。

---

# 28. PR Protocol

重要 PR 至少提供：

```
Objective
Scope
Out of Scope
Root Cause / Context
Solution
Tests / Verification
Risks
Rollback
Known Limitations

```

只有真正有價值時才加入：

```
Alternatives
Migration
Performance Benchmark
Security Analysis

```

不得為填模板而填模板。

---

# 29. Definition of Done 分層

V3.0 不再只用一個 DONE 混合：

- Code finished
- CI finished
- Merge finished
- Deploy finished
- Phase closed

改成分層。

## IMPLEMENTED

需求程式已完成。

## VALIDATED

適用 tests / regression 已通過。

## READY TO MERGE

適用：

- validation
- review
- docs
- rollback
- blocker

都符合。

## MERGED

已進入 target branch。

## DEPLOYED

需要 deployment 時已部署並驗證。

## CLOSED

Batch / Phase 的：

- required implementation
- validation
- merge
- deployment when applicable
- documentation
- handoff

全部完成。

因此：

> **IMPLEMENTED ≠ CLOSED**

---

# 30. CI Failure Classification

CI fail 不直接等於 code defect。

先分類：

```
Code Failure
Test Failure
Environment Failure
Quota / Rate Limit
External Service Failure
Flaky Infrastructure
Configuration Failure
Unknown

```

但：

> 分類為 external failure 不代表可以偷偷 bypass required gate。

處理方式：

- retry
- wait for valid rerun
- change governance explicitly
- document exception if policy explicitly permits

不得為了讓自己的 PR 通過而移除保護。

---

# 31. Security / Data Integrity Override

優先級：

```
Safety
>
Data Integrity
>
Security
>
Production Availability
>
Correctness
>
Current Feature
>
Optimization

```

Critical security/data issue 可以突破：

```
Scope Lock

```

但修正範圍仍應保持：

> Minimum Correct Safe Change。

---

# 32. Dependency Policy

不能因：

> 有新版。

就大量升級。

升級理由應為：

- security
- compatibility
- unsupported version
- required functionality
- confirmed bug

Dependency vulnerability 應先判斷：

```
Severity
Production / Dev
Direct / Transitive
Reachability
Exploitability
Upgrade Risk

```

不得機械執行：

```
force upgrade everything

```

---

# 33. Performance Policy

遵守：

```
Measure
↓
Locate
↓
Hypothesis
↓
Change
↓
Measure Again

```

聲稱效能改善原則上需要：

```
Before / After

```

例如：

- latency
- execution time
- API calls
- memory
- bundle size

---

# 34. Documentation Update Policy

文件是工程狀態的一部分。

但：

> **不要求把每個低價值操作都寫入文件。**

`to_do_update_list.md` 只需保存對下一個 Agent 有價值的資訊：

- current state
- stable state
- decisions
- root causes
- blockers
- risks
- current batch
- exact next action
- important verification
- important commit / PR / release

不需要保存：

- 每一個 shell command
- 每個 temporary hypothesis
- 每次小 formatting
- 已被完全取代且沒有歷史價值的中間敘述

避免：

> Handoff 文件最後變成比程式更難理解的流水帳。

---

# 35. Decision Log

重大決策至少記：

```
Decision
Context
Evidence
Reason
Trade-off
Status
Reopen Condition

```

只有對理解決策有幫助時才詳細記 Alternatives。

---

# 36. Root Cause Log

只有：

- meaningful bug
- systemic issue
- recurring issue
- R2/R3 correctness issue

才進入長期 Root Cause Log。

小 typo 不需要 RCA archive。

---

# 37. History Compression

隨專案演進：

舊 Batch 不應永久佔據 live document 大量篇幅。

定期：

```
Active Detail
↓
Close Phase
↓
Compress into Historical Summary

```

保留：

- result
- major decisions
- RCA
- merge/release
- known limitations

移除低價值過程細節。

---

# 38. Session Startup Protocol

新 AI Session：

```
1. AI_PROJECT_PLAYBOOK.md
2. README.md
3. to_do_update_list.md
4. Current Git / Remote State
5. Current Phase / Batch / Next Action
6. Relevant Contract / ADR
7. Then Work

```

不是每次：

> 從頭重新研究整個 Repository。

閱讀深度依目前任務決定。

---

# 39. Remote Truth Gate

重要操作前重新確認：

- target branch
- current main SHA
- PR head
- base
- mergeability
- CI
- required status
- review state
- deployment state when relevant

Repository 文件是 persistent context。

Remote systems 是：

> Current Operational Truth。

---

# 40. AI Authority Boundary

AI 可以在已授權範圍內：

- research
- modify
- test
- commit
- branch
- create PR
- review
- document

但不得自行：

- 降低 branch protection
- bypass required checks
- force push protected history
- delete recovery points
- weaken security gates
- declare its own unverified work safe
- expand product requirements without evidence

Governance change 本身應視為：

> Governance Batch

不得為了讓目前 PR 通過而臨時改規則。

如果 Governance 確實有設計缺陷：

應像任何 architecture defect 一樣：

```
Evidence
↓
Review
↓
Revised Governance
↓
Apply prospectively / explicitly

```


## Governance Transition / Non-Retroactive Rule

治理規則修改必須避免為了讓現在的 PR 過關而臨時修改規則，同時也要避免新規則永遠不能套用當前正在進行的工作。

### Prospective-by-Default

新 Governance Rule 原則上適用於 Governance Change Accepted 之後的操作與 Gate，不要求歷史已 CLOSED 的 Phase / PR 重新跑新流程。

### No Retroactive Reopening

已 MERGED / CLOSED / RELEASED 的工作，不因後來治理規則改變而自動 REOPEN / FAIL / INVALID，除非出現：

- material correctness evidence
- security issue
- data integrity issue
- production incident

Governance evolution 本身不是重新打開歷史工作的理由。

### Active Work Transition

治理修改生效時仍 ACTIVE 的 PR / Batch，必須做一次 Transition Assessment：

#### Apply Immediately

新規則直接提高目前工作安全性，而且成本合理。

#### Apply at Next Gate

目前 implementation 不重做，但下一個 Review / Merge / Deploy / Closeout 開始採新規則。

#### Grandfather Current Batch

如果新流程的 retrofitting 成本明顯高於風險降低，目前 Batch 可依原 baseline 完成，但必須記：

```text
Grandfather Reason
Residual Risk
New Rule Effective From
```

### Grandfather Anti-Bypass

Grandfather 機制的目的，是避免 Governance evolution 對已進行中的工作造成不成比例的 retrofitting cost。

它不得被用來消除在 Governance Change 生效前，已經由證據明確成立的：

- safety blocker
- security blocker
- data-integrity blocker
- correctness blocker

```text
Existing Material Blocker
+
Governance Change
≠
Automatic Blocker Removal
```

若 Active Batch 的唯一 blocker 正是本次 Governance Change 所修改的 Gate，必須先完成：

```text
Governance Change Review
↓
Current PR / Batch Transition Assessment
↓
Apply New Governance Rule
↓
Satisfy New Rule
```

不得單靠 `Grandfather Current Batch` 宣告 blocker 已解除。

> **Grandfather ≠ bypass escape hatch。**

Governance Change 可以修正錯誤或低價值的舊流程，但不能使尚未取得的 correctness / safety evidence 被視為已經取得。

### Anti-Bypass Rule

如果 Governance 修改直接移除目前 PR 唯一 blocker、降低 required validation、降低 security requirement 或降低 data-integrity protection，則不能只因規則修改就立即宣稱 PASS。

必須做一次：

```text
Governance Change Review
+
Current PR Transition Assessment
```

確認這是 genuine governance correction，而不是 gate bypass。

### Current Example Principle

例如將：

```text
Independent Third-Party Review
```

改成：

```text
Independent Review Gate
```

如果證據已證明：

- repository 為單人維護；
- 不同帳號本身沒有 correctness value；
- 真正需求是 independent reasoning + competence；

則可以作為 legitimate governance correction。

但仍需依新規則真正完成一次 Independent Review，不能因為刪除了 Third-Party 字樣就直接 Merge 未審查 PR。

---

# 41. Release Policy

不是每個 PR 都需要 Release。

建立 Release / Tag / Stable Checkpoint 的情況：

- user-facing version
- major phase closeout
- R2/R3 significant stable point
- pre/post high-risk migration
- production recovery landmark

Docs-only / trivial PR：

通常不需要額外 Release。

---

# 42. Deployment Policy

只有修改實際 deployed behavior 時才要求 deployment validation。

一般：

```
Validated Candidate
↓
Merge
↓
Build if applicable
↓
Deploy if applicable
↓
Smoke
↓
Production Verification

```

Docs-only PR：

不需要假裝執行 production smoke。

---

# 43. Deployment Failure

Critical production regression：

優先：

```
Rollback / Restore

```

不是：

```
Production 上持續疊 patch

```

恢復後：

```
Evidence
↓
RCA
↓
Fix
↓
Validate
↓
Review
↓
Redeploy

```

---

# 44. Phase / Batch Status Vocabulary

統一使用：

```
PLANNED
ACTIVE
BLOCKED
VALIDATING
READY TO MERGE
MERGED
CLOSED
DEFERRED
REJECTED

```

不要同一個 Repository 同時使用：

```
TODO
NOT STARTED
READY
VERIFYING
PASS
DONE

```

等多套近義 status。

Validation result 另外記：

```
PASS / FAIL

```

Status 與 Test Result 分離。

---

# 45. Batch Completion Report

每個重要 Batch 不需要固定寫十幾個空欄位。

最低必要資訊：

```
Objective
Result
Key Changes
Verification
Risk / Limitations
Git / PR
Next

```

只有 Debug 時增加：

```
Root Cause

```

只有發現相關新工作時增加：

```
NOW / NEXT / BACKLOG / REJECT

```

---

# 46. Handoff Minimum

下一個 AI 必須能回答：

1. main 正常嗎？
2. Last Known Good 是什麼？
3. Current Phase？
4. Current Batch？
5. Current head / PR？
6. 現在 blocker？
7. 哪些重要 decision locked？
8. 哪些 risk 尚未解決？
9. 下一個 exact action 是什麼？

如果這九個問題能無歧義回答：

Handoff 即具備基本品質。

---

# 47. Optimization Saturation

滿足：

- requirement
- correctness
- major regression
- acceptable performance
- acceptable maintainability
- adequate tests
- stable deployment when applicable

且下一個改善：

```
Marginal Benefit << Added Cost / Risk

```

則：

> 停止目前方向。

加入 BACKLOG。

不追求：

> 永遠可以再優化。

---

# 48. Stop Conditions

停止 Implementation 的真正理由：

- unknown user changes may be overwritten
- data-loss risk
- security critical
- root assumption invalidated
- no safe rollback for R2/R3
- root cause fundamentally unknown
- material scope creep
- conflicting concurrent implementation

不再把：

> 找不到另一個普通 GitHub 帳號 reviewer

本身視為技術 Stop Condition。

Review gate 的判定依：

```
Risk Level + Reviewer Competence + Independent Reasoning

```

---

# 49. Governance Anti-Pattern

禁止：

## Process Theater

只是為了有紀錄而產生紀錄。

## Approval Theater

沒有能力判斷的人按 Approve。

## Test Theater

執行大量與 diff 無關的測試只為增加數字。

## Backup Theater

每個小修改都建立 Tag / Release。

## Documentation Theater

文件比程式實際狀態更難理解。

## Review Rabbit Hole

每輪 review 發明新的 project roadmap。

## Optimization Rabbit Hole

產品穩定卻永遠不 Close Phase。

---

# 50. Governance Efficiency Test

任何新規則加入天書前回答：

```
它防止什麼具體 failure mode？
有沒有較低成本的方法？
是否與已有規則重複？
它適用於所有 change，還是特定 risk class？
如果沒有它，實際風險多大？

```

只有：

```
Expected Risk Reduction > Governance Cost

```

才應加入。

---

# 51. 最終 Merge 判斷

Merge 前不要只問：

> 有沒有另一個人按 Approve？

應問：

```
Requirement fulfilled?
Correctness evidence sufficient?
Applicable tests passed?
Known blockers = 0?
Review level appropriate to risk?
Reviewer competent?
Review based on independent evidence?
Exact head reviewed?
Rollback adequate?
Documentation sufficient for handoff?

```

全部適用項目成立：

才：

```
READY TO MERGE

```

---

# 52. 最終治理公式

本專案採：

> **Evidence-Based Engineering**

不是：

> 流程越多越安全。

採：

> **Risk-Proportional Governance**

不是：

> 所有修改跑同一套 Gate。

採：

> **Independent Reasoning Review**

不是：

> Different Account Approval。

採：

> **Competence-Based Review**

不是：

> 隨便找旁人背書。

採：

> **Broad Thinking, Narrow Execution**

不是：

> 發現什麼就改什麼。

採：

> **Persistent Context, Current Remote Truth**

不是：

> 只相信聊天紀錄或 stale documentation。

採：

> **Stable Progress**

不是：

> Infinite Optimization。

---

# 53. 最終判斷問題

修改前：

> 我真的理解目前系統與 remote state 嗎？

Debug 前：

> 我找到的是 symptom、failure point，還是 root cause？

擴大 Scope 前：

> 這是 correctness 必需，還是順便改善？

重構前：

> Evidence 足以證明需要 refactor 嗎？

測試前：

> 哪些 failure modes 真正需要驗證？

Review 前：

> Reviewer 是否具備這次 change 所需能力？

Merge 前：

> Exact candidate 是否已得到與其 risk 相稱的證據？

Deploy 前：

> 如果失敗，可以安全恢復嗎？

Phase close 前：

> 剩下的是必要工作，還是只是可以更好？

Session 結束前：

> 下一個完全沒看過這次聊天的 AI，只看 Repository，能否準確繼續？

---

# 54. 最終原則

本專案追求：

```
Correct
Traceable
Testable
Reviewable
Recoverable
Maintainable
Transferable

```

而不是：

```
Maximum Process
Maximum Documentation
Maximum Review Count
Maximum Test Count
Maximum Change

```

最終形成：

> **能深入探索、快速收斂、按風險治理、靠證據判斷、可安全回滾、可跨 AI Session 持續演進的個人 AI 協作軟體工程系統。**

---

# V3.0 Governance Lock

完成 V3.0 Final Hardening 後：

```text
AI_PROJECT_PLAYBOOK V3.0

Status:
GOVERNANCE BASELINE LOCKED

Governance Architecture:
FROZEN

Further Governance Optimization:
STOPPED

Reopen:
ONLY BY DOCUMENTED REOPEN CONDITION
```

此後不得因：

- wording preference
- another AI's preferred workflow
- theoretical completeness
- enterprise best practice
- hypothetical edge case
- 「再多一條可能更完整」

重新開啟治理設計。

新的 governance idea 預設：

```text
BACKLOG
或
REJECT
```

只有出現以下 Reopen Condition 與實際 evidence，才允許重新開啟 Governance Architecture：

```text
1. Actual governance-caused failure
2. Repeated workflow friction with evidence
3. Security / data-integrity gap
4. Material project architecture change
5. Multi-maintainer / organization model change
6. CI/CD platform change invalidating existing rules
7. User requirement change
```

長期循環正式改為：

```text
Use V3
↓
Execute Real Project Work
↓
Observe
↓
Collect Actual Evidence
↓
Governance Works?
├─ YES → Keep Frozen
└─ NO  → Check Reopen Condition
          ↓
        Evidence-Based Governance Reopen
```

而不再採：

```text
Governance
↓
More Governance
↓
More Edge Cases
↓
More Rules
```

## Final Constitutional Core

> **Broad Thinking, Narrow Execution.**

> **Evidence First, Risk-Proportional Governance.**

> **獨立審查重點是獨立推理與專業能力，不是不同人頭。**

V3.0 的目標不是建立最大化流程，而是：

> **用最少但足夠的工程控制，持續產出正確、可驗證、可追溯、可回滾、可交接的 Stable State。**
