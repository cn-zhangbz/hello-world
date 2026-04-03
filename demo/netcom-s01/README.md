# 网通 S01 登录闭环演示证据（Spec / OpenAPI）

本目录为 AutoCursor `mvp-react-ts` 流水线产物的**摘录**，用于远程审计；完整工程与报告在本地工作区 `AutoCursor/mvp-react-ts`。

## 关键命令（本地）

```bash
cd mvp-react-ts
npm run gen:materialize -- --ui-spec reports/req/demo-login-netcom-s01-001/ui-layout.json --api-spec reports/req/demo-login-netcom-s01-001/api-requirement.json --out reports/req/demo-login-netcom-s01-001
npm run test:report && npm run test:summary
# 端到端（真实 HTTP）：终端 A
npm run mock:api
# 终端 B
npm run dev
```

## Figma

- 文件: https://www.figma.com/design/gcVOdCfrrMtwXpsnaFGFOc/Untitled
- 页面: **Page 1**；画板: **Login Page** → 原型点击 **LoginButton（登录）** → **Login Success**

## 报告路径（本地）

- `mvp-react-ts/reports/test-summary.md`
- `mvp-react-ts/reports/openapi.generated.json`
- `mvp-react-ts/src/pages/generated/LoginPage.tsx`
- `mvp-react-ts/tests/integration/generated/user-api.integration.spec.ts`
