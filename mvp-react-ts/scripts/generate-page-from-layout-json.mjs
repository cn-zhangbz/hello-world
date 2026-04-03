// 中文注释：scripts/generate-page-from-layout-json.mjs，用于项目自动化流程实现与验证。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// 中文注释：解析命令行参数，支持带默认值的读取。
function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

// 中文注释：将名称转换为 PascalCase，统一组件命名。
function toPascalCase(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

// 中文注释：将属性对象序列化为 JSX 属性字符串。
function serializeProps(props = {}) {
  const entries = Object.entries(props)
  if (entries.length === 0) return ''
  return entries
    .map(([key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value.$state === 'string'
      ) {
        return `${key}={${value.$state}}`
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value.$expr === 'string'
      ) {
        return `${key}={${value.$expr}}`
      }
      if (typeof value === 'string') return `${key}="${value}"`
      return `${key}={${JSON.stringify(value)}}`
    })
    .join(' ')
}

// 中文注释：根据初始值推断状态类型。
function inferStateType(initial) {
  if (typeof initial === 'string') return 'string'
  if (typeof initial === 'number') return 'number'
  if (typeof initial === 'boolean') return 'boolean'
  return 'unknown'
}

// 中文注释：把状态初始值转换为可写入代码的字面量。
function serializeInitialState(initial) {
  if (typeof initial === 'string') return `'${initial.replace(/'/g, "\\'")}'`
  return JSON.stringify(initial)
}

function upperFirst(s) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

function ensureState(states, name, initial = '', type = undefined) {
  const found = states.find((s) => s && s.name === name)
  if (found) return states
  states.push({ name, initial, type })
  return states
}

// 中文注释：主执行入口：组织流程、调用子步骤并输出报告。
async function main() {
  const input = getArg('--input')
  const outDir = getArg('--out') || 'src/pages/generated'
  if (!input) {
    throw new Error(
      'Usage: node scripts/generate-page-from-layout-json.mjs --input <json> [--out <dir>]',
    )
  }

  const absoluteInput = path.resolve(process.cwd(), input)
  const absoluteOut = path.resolve(process.cwd(), outDir)
  const payload = JSON.parse(await readFile(absoluteInput, 'utf-8'))

  const pageName = toPascalCase(payload.pageName || 'GeneratedPage')
  const pageType = payload.pageType || 'default'
  const sections = Array.isArray(payload.sections) ? payload.sections : []
  const states = Array.isArray(payload.state) ? payload.state : []
  const dataSources = Array.isArray(payload.dataSources) ? payload.dataSources : []
  const imports = new Set()
  const lines = []

  // 中文注释：针对登录页生成“可交互”的表单与 API 调用逻辑。
  // 说明：当前项目的 component/section 通用生成器偏静态展示能力，
  // 为了保证“真实输入控件 + 登录提交 + 验证请求/响应链路”可演示，
  // 这里采用 pageType 分支输出更完整的 LoginPage.tsx。
  if (String(pageType).toLowerCase() === 'login') {
    const actions = payload.actions || {}
    const loginOperationId =
      actions.loginOperationId ||
      actions.login?.operationId ||
      actions.loginOperation?.operationId
    const captchaOperationId =
      actions.captchaOperationId || actions.captcha?.operationId || actions.refreshCaptcha?.operationId

    if (!loginOperationId) {
      throw new Error(
        'Login page spec missing actions.loginOperationId (or actions.login.operationId)',
      )
    }

    // 中文注释：默认使用 username/password/captcha 作为登录入参 state 名称。
    // 你也可以在 spec.actions.loginRequestFields 里覆盖映射。
    const loginRequestFields =
      actions.loginRequestFields || /** @type {Record<string,string>} */ ({
        username: 'username',
        password: 'password',
        captcha: 'captcha',
      })

    const tokenExtract = actions.loginResponseTokenExtract || 'token'
    const statusDefault = actions.statusDefault || 'idle'

    const loginTheme = payload.loginTheme || {}
    const themeTitle =
      loginTheme.title != null ? String(loginTheme.title) : '登录'
    const primary = String(loginTheme.primaryColor || '#1861B5')
    const pageBg = String(loginTheme.pageBackground || '#F0F4F8')
    const cardBg = String(loginTheme.cardBackground || '#FFFFFF')
    const borderCol = String(loginTheme.borderColor || '#E0E0E0')
    const captchaPlaceholder = loginTheme.captchaPlaceholderImage != null
      ? String(loginTheme.captchaPlaceholderImage)
      : ''
    const titleJsExpr = JSON.stringify(themeTitle)

    const captchaFallbackBlock = captchaPlaceholder
      ? `<img src={${JSON.stringify(captchaPlaceholder)}} alt="captcha" style={{ width: 120, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid ${borderCol}' }} />`
      : `<div style={{ width: 120, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999', border: '1px dashed ${borderCol}', borderRadius: 4 }}>点击刷新加载</div>`

    // 中文注释：补齐登录页所需状态（如果 spec 未声明）。
    ensureState(states, 'username', '', 'string')
    ensureState(states, 'password', '', 'string')
    ensureState(states, 'captcha', '', 'string')
    ensureState(states, 'token', '', 'string')
    ensureState(states, 'status', statusDefault, 'string')
    if (captchaOperationId) ensureState(states, 'captchaImageUrl', '', 'string')

    const reactImports = [`useState`]

    const setterStates = states.map((item) => {
      const stateName = item.name
      const stateType = item.type || inferStateType(item.initial)
      const initial = serializeInitialState(item.initial)
      const setterName = `set${upperFirst(stateName)}`
      return `  const [${stateName}, ${setterName}] = useState<${stateType}>(${initial})`
    })

    const importClientNames = [
      loginOperationId,
      ...(captchaOperationId ? [captchaOperationId] : []),
    ]
    const reactImportText = `import { ${reactImports.join(', ')} } from 'react'`
    const clientImportText = `import { ${importClientNames.join(', ')} } from '../../api/generated/client'`

    const payloadExpr = `{\n${Object.entries(loginRequestFields)
      .map(([apiField, stateField]) => `        ${apiField}: ${stateField},`)
      .join('\n')}\n      }`

    const tokenExtractLines = []
    if (tokenExtract === 'token') {
      tokenExtractLines.push(`      setToken(resp.token)`)
    } else {
      // 不使用 any：用 Record<string, unknown> 进行安全取值
      tokenExtractLines.push(
        `      const tokenValue = (resp as Record<string, unknown>)[${JSON.stringify(tokenExtract)}]`,
      )
      tokenExtractLines.push(
        `      const nextToken = typeof tokenValue === 'string' ? tokenValue : JSON.stringify(tokenValue)`,
      )
      tokenExtractLines.push(`      setToken(nextToken)`)
    }

    const loginHandlerLines = [
      `  async function handleLogin() {`,
      `    setStatus('loading')`,
      `    try {`,
      `      const resp = await ${loginOperationId}(${payloadExpr})`,
      ...tokenExtractLines.map((l) => `      ${l.trimStart()}`),
      `      setStatus('success')`,
      `    } catch (err) {`,
      `      setStatus('error')`,
      `      console.error('login failed:', err)`,
      `    }`,
      `  }`,
    ]

    const captchaHandlerLines = []
    if (captchaOperationId) {
      captchaHandlerLines.push(`  async function handleRefreshCaptcha() {`)
      captchaHandlerLines.push(`    try {`)
      captchaHandlerLines.push(`      const resp = await ${captchaOperationId}()`)
      captchaHandlerLines.push(`      setCaptchaImageUrl(resp.imageDataUrl)`)
      captchaHandlerLines.push(`    } catch (err) {`)
      captchaHandlerLines.push(`      console.error('refresh captcha failed:', err)`)
      captchaHandlerLines.push(`    }`)
      captchaHandlerLines.push(`  }`)
    }

    // 中文注释：登录页：卡片布局 + 品牌区（对齐「数据服务隔离交换网关」类需求），含 data-testid 便于 Figma↔代码映射演示。
    const fileContent = `${reactImportText}
${clientImportText}

// 中文注释：src/pages/generated/${pageName}.tsx - 登录页（pageType=login 的特例生成器）
export function ${pageName}() {
${setterStates.join('\n')}

  // 中文注释：当某些状态（例如 token）只用于 setState 回写但未在 UI 上直接展示时，
  // 需要通过 void token 消除 TS noUnusedLocals 报错。
  ${states.some((s) => s?.name === 'token') ? 'void token' : ''}

${captchaHandlerLines.length > 0 ? captchaHandlerLines.join('\n') + '\n' : ''}
${loginHandlerLines.join('\n')}

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '${pageBg}',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <section
        data-testid="LoginCard"
        style={{
          width: 'min(420px, 92vw)',
          background: '${cardBg}',
          borderRadius: 12,
          padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(24, 97, 181, 0.12)',
        }}
      >
        <header
          data-testid="Logo"
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}
        >
          <svg width={40} height={40} viewBox="0 0 24 24" aria-hidden>
            <path
              fill="${primary}"
              d="M12 2 20 6v7c0 4.5-3.2 8.7-8 9.5C7.2 21.7 4 17.5 4 13V6l8-4z"
            />
            <path
              fill="#fff"
              d="M8.5 10h7v1.5h-2.5V16h-2v-4.5H8.5V10z"
            />
          </svg>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '${primary}',
              lineHeight: 1.3,
            }}
          >
            {${titleJsExpr}}
          </h1>
        </header>

        <div data-testid="UsernameInput" style={{ marginBottom: 16 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid ${borderCol}',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div data-testid="PasswordInput" style={{ marginBottom: 16 }}>
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid ${borderCol}',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div data-testid="CaptchaRow" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div data-testid="CaptchaInput" style={{ flex: 1, minWidth: 0 }}>
              <input
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                placeholder="请输入验证码"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid ${borderCol}',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            ${
              captchaOperationId
                ? `<div
              data-testid="CaptchaImage"
              role="button"
              tabIndex={0}
              title="点击刷新验证码"
              onClick={() => {
                void handleRefreshCaptcha()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void handleRefreshCaptcha()
                }
              }}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            >
              {captchaImageUrl ? (
                <img
                  src={captchaImageUrl}
                  alt="captcha"
                  style={{
                    width: 120,
                    height: 40,
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: '1px solid ${borderCol}',
                    display: 'block',
                  }}
                />
              ) : (
                ${captchaFallbackBlock}
              )}
            </div>`
                : `<div data-testid="CaptchaImage">（未配置验证码接口）</div>`
            }
          </div>
          ${
            captchaOperationId
              ? `<button
            type="button"
            data-testid="CaptchaRefreshButton"
            onClick={() => {
              void handleRefreshCaptcha()
            }}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid ${borderCol}',
              background: '#fff',
              color: '${primary}',
              cursor: 'pointer',
            }}
          >
            刷新验证码
          </button>`
              : ''
          }
        </div>

        <button
          type="button"
          data-testid="LoginButton"
          onClick={() => {
            void handleLogin()
          }}
          style={{
            width: '100%',
            padding: '14px 16px',
            border: 'none',
            borderRadius: 8,
            background: '${primary}',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          登录
        </button>

        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: '#888' }}>
          状态：{status}
        </p>
      </section>
    </main>
  )
}
`

    const filePath = path.join(absoluteOut, `${pageName}.tsx`)
    await writeFile(filePath, fileContent, 'utf-8')
    console.log(`Generated login page: ${path.relative(process.cwd(), filePath)}`)
    return
  }

  for (const section of sections) {
    const componentName = toPascalCase(section.component || 'PrimaryButton')
    imports.add(componentName)
    const propsText = serializeProps(section.props || {})
    lines.push(
      `      <${componentName}${propsText ? ` ${propsText}` : ''} />`,
    )
  }

  await mkdir(absoluteOut, { recursive: true })

  const importNames = [...imports].sort().join(', ')
  const stateLines = states.map((item) => {
    const stateName = item.name
    const stateType = item.type || inferStateType(item.initial)
    const initial = serializeInitialState(item.initial)
    return `  const [${stateName}] = useState<${stateType}>(${initial})`
  })

  const dataLines = dataSources.map((source) => {
    const constName = source.name || 'dataSource'
    const initial = JSON.stringify(source.value ?? null)
    return `  const ${constName} = ${initial}\n  void ${constName}`
  })

  const reactImport = states.length > 0 ? "import { useState } from 'react'\n" : ''
  const componentImport =
    importNames.length > 0
      ? `import { ${importNames} } from '../../components/generated'\n`
      : ''

  const bodyPreamble = [...stateLines, ...dataLines]
  const preambleText =
    bodyPreamble.length > 0 ? `${bodyPreamble.join('\n')}\n\n` : ''

  const fileContent = `${reactImport}${componentImport}

export function ${pageName}() {
${preambleText}
  return (
    <main>
${lines.length > 0 ? lines.join('\n') : '      {/* no sections */}'}
    </main>
  )
}
`

  const filePath = path.join(absoluteOut, `${pageName}.tsx`)
  await writeFile(filePath, fileContent, 'utf-8')
  console.log(`Generated page: ${path.relative(process.cwd(), filePath)}`)
}

main().catch((error) => {
  console.error('Page generator failed:', error.message)
  process.exit(1)
})
