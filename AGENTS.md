# AGENTS.md

# Mandatory AI Repository Entry Point

所有 ChatGPT、Codex、AI Agent、Sub-Agent、Review Agent 在本 Repository 執行任何 Research / Planning / Coding / Debug / Review / Git / PR / CI/CD / Release / Deployment 工作前，**不得先以 current feature branch 作為 governance authority**。

必須先依下列順序執行：

1. 確認 Repository identity 與 authoritative remote default branch；本 Repository 目前為 `main`。
2. 從**最新 remote default branch**讀取 `AGENTS.md`。
3. 從**最新 remote default branch**讀取 `AI_PROJECT_EXECUTION_LOCK.md`。
4. 套用其中 Locked Governance 後，再讀目前 active branch / PR 所需的 `AI_PROJECT_PLAYBOOK.md`、`README.md`、`to_do_update_list.md`、相關 code/docs。
5. 最後核對與目前工作相關的 GitHub / CI / Deployment remote truth，從 exact current checkpoint 繼續。

`AI_PROJECT_EXECUTION_LOCK.md` 是 Repository Owner 鎖定的 execution-control amendment；其 governance source of truth 是最新 remote default branch，而不是 current feature branch。

如果 active feature branch / PR branch：

- 沒有 `AGENTS.md`；
- 沒有 `AI_PROJECT_EXECUTION_LOCK.md`；
- 只有較舊版本；
- 與 `main` diverged；

這些情況都**不構成豁免**。必須跨 branch 讀取 remote default branch 的 authoritative governance，不需要也不得只為了 policy discovery 而 merge / rebase / cherry-pick `main`。

新 Session / Conversation / Agent takeover，以及使用者要求「繼續」但無法證明已載入 current remote default-branch governance 時，必須先做最小 governance freshness check；若 default-branch head 未變則直接 resume，若已變或 freshness unknown，重新取得 locked governance 後立即 resume。不得把 freshness check 變成重新建立 Master Plan 或新的停止點。

若目前工作缺少關鍵 evidence，必須依 `AI_PROJECT_EXECUTION_LOCK.md` 的 `Evidence & Hard Blocker Gate` 執行：先定義 missing evidence、檢查與嘗試合理且直接相關的 available tool / connector / API / repository / runtime evidence paths，再判斷是否構成 genuine Hard Blocker。UI / workflow / job / check label 或 summary 只能作為導航線索，不能單獨冒充 precise failure、failing assertion 或 Root Cause 證據。只要仍有尚未嘗試、合理且可能成功的直接相關 evidence path，就不得以 Hard Blocker 為由送出 final response。

以下條款本身亦屬 Protected Locked Rules：

- 必須優先從最新 remote default branch 讀取 `AGENTS.md` 與 `AI_PROJECT_EXECUTION_LOCK.md`。
- Feature branch 缺檔、舊檔或 diverged 不得被解讀為 locked governance 不存在。
- 必須遵守 `AI_PROJECT_EXECUTION_LOCK.md` 的 Default-Branch Governance Authority / Discovery Gate、Evidence & Hard Blocker Gate、Continuous Execution、Final Response Gate、Resume-Do-Not-Restart 規則。
- 未取得證據不得被直接等同於證據無法取得；Hard Blocker 必須先完成合理、直接相關、available evidence paths 的必要查證並形成可審計 Blocker Proof。
- UI / workflow / job / check label 或 summary 不得單獨被當作 raw execution evidence、precise failure 或 Root Cause 證明。
- 不得把使用者當作每個 Task 之間的 Continue 按鈕。
- 不得以其他 policy / refactor / cleanup / new model / new session / old branch 繞過該文件。
- 修改、刪除、改名、搬移、弱化、取代本 entry-point、Default-Branch Governance Authority / Discovery Gate、Evidence & Hard Blocker Gate 或該 locked amendment，必須依 `AI_PROJECT_EXECUTION_LOCK.md` 的 **OWNER SPECIAL APPROVAL** 流程，重新取得 owner 對具體 proposed change 的特別同意。

一般開發授權、`繼續`、`同意`、PR/merge 授權或「給你所有權限」均不等於修改 Locked Rules 的 Special Approval。

如一般 Repository 流程與 locked amendment 衝突，在不違反平台 / 系統安全要求與使用者當下明確指令的前提下，採較嚴格且能維持 locked amendment 效力的規則。
