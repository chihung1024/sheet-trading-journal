# AGENTS.md

# Mandatory AI Repository Entry Point

所有 ChatGPT、Codex、AI Agent、Sub-Agent、Review Agent 在本 Repository 執行任何 Research / Planning / Coding / Debug / Review / Git / PR / CI/CD / Release / Deployment 工作前，必須依序讀取：

1. `AI_PROJECT_EXECUTION_LOCK.md`
2. `AI_PROJECT_PLAYBOOK.md`
3. `README.md`
4. `to_do_update_list.md`
5. 與目前工作相關的 GitHub / CI / Deployment remote truth

`AI_PROJECT_EXECUTION_LOCK.md` 是 Repository Owner 鎖定的 execution-control amendment。

以下條款本身亦屬 Protected Locked Rules：

- 必須優先讀取 `AI_PROJECT_EXECUTION_LOCK.md`。
- 必須遵守其 Continuous Execution / Final Response Gate / Resume-Do-Not-Restart 規則。
- 不得把使用者當作每個 Task 之間的 Continue 按鈕。
- 不得以其他 policy / refactor / cleanup / new model / new session 繞過該文件。
- 修改、刪除、改名、搬移、弱化、取代本 entry-point 或該 locked amendment，必須依 `AI_PROJECT_EXECUTION_LOCK.md` 的 **OWNER SPECIAL APPROVAL** 流程，重新取得 owner 對具體 proposed change 的特別同意。

一般開發授權、`繼續`、`同意`、PR/merge 授權或「給你所有權限」均不等於修改 Locked Rules 的 Special Approval。

如一般 Repository 流程與 locked amendment 衝突，在不違反平台 / 系統安全要求與使用者當下明確指令的前提下，採較嚴格且能維持 locked amendment 效力的規則。
