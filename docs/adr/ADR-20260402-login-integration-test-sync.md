# ADR-20260402-login-integration-test-sync

状态（Status）：Accepted

日期（Date）：2026-04-02

## 背景（Context）
本项目的核心演示链路是：用户自然语言需求 -> 抽取 Spec -> 物化生成 OpenAPI/代码/测试 -> 执行测试并生成质量门禁证据。  
在“登录页（包含验证码）”这类需求中，后端契约（`operationId`、请求/响应字段）会随 Spec 动态变化。

如果集成测试仍使用仓库里“固定的旧 API 调用/旧断言”，会出现以下问题：
- Spec 变化后集成测试与当前 OpenAPI 不一致。
- CI 由于已有文件跳过生成时，会继续执行旧测试，导致“演示用例与实际生成契约不匹配”。

因此需要一种“集成测试随 OpenAPI 同步”的生成策略，并同时满足 eslint/tsc 的严格约束（禁止 `any`、避免 useEffect 中级联 setState 风险等）。

## 决策（Decision）
1. 将集成测试生成改为：读取 `reports/openapi.generated.json`，基于其中所有带 `operationId` 的操作自动生成集成烟测（integration smoke）。
2. 在 `materialize-from-spec.mjs` 物化阶段显式执行 `npm run gen:integration-tests`，确保 integration 测试与当前物化的 OpenAPI 同步。
3. 登录页生成器避免 eslint 报错：不在 `useEffect` 中自动刷新验证码，且用类型化字段访问替代显式 `any`。

## 备选方案（Alternatives）
1. 固定写死 `listUsers/createUser` 等旧 API 的集成测试。
   - 优点：实现简单。
   - 缺点：无法满足“Spec 驱动端到端闭环”的一致性要求。
2. 仅在 CI 中对 integration 测试做覆盖/强制重生成。
   - 优点：测试始终最新。
   - 缺点：可能覆盖 Agent 在 PR 中生成/修改的测试产物（与本项目“避免覆盖”的目标冲突）。

## 影响与后果（Consequences）
正向收益：
- 集成测试与 OpenAPI 契约天然同步，Spec -> 物化 -> 测试闭环更可信。
- 演示与 CI 在“跳过生成”的情况下也能保持测试一致性。

负面影响/风险：
- integration 测试更偏“烟测”（mock fetch + 校验 URL/HTTP method），不会深度验证响应业务字段。
- 若未来 OpenAPI 生成器的 path/operationId 命名策略发生变化，integration smoke 的断言仍需跟随调整。

## 实施与回滚（Implementation & Rollback）
实施步骤：
1. 更新 `mvp-react-ts/scripts/generate-integration-tests.mjs`：由固定测试改为基于 openapi 自动生成。
2. 更新 `mvp-react-ts/scripts/materialize-from-spec.mjs`：物化阶段增加 `gen:integration-tests`。
3. 更新登录页生成器：避免 `any` 与 useEffect setState lint 风险。

回滚条件：
- 若出现 “集成烟测无法通过” 的持续问题，可回滚到固定集成测试版本以恢复可用性；并在 Spec 变化后重新评估烟测策略。

## 验证计划（Validation Plan）
1. 本地运行：
   - `npm run gen:materialize -- --ui-spec ... --api-spec ...`
   - `npm run test`
   - `npm run quality:gate`
2. 验证点：
   - `tests/integration/generated/user-api.integration.spec.ts` 存在且能通过 eslint/tsc。
   - `npm run quality:gate` overall status 为 PASSED。

## 关联信息（Related PRs / Issues / Docs）
- 相关生成链路模板：`.cursor/templates/auto-pipeline-from-nl-requirement.md`
- 相关物化脚本：`mvp-react-ts/scripts/materialize-from-spec.mjs`
