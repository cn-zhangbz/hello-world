// 中文注释：scripts/materialize-from-spec.mjs，用于将“UI Spec + API Spec”
// 物化为可执行的 OpenAPI/代码/测试与页面产物（服务于演示与 CI）。
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

function getArg(flag, fallback = undefined) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

function resolveMaybe(pathLike, cwd) {
  if (!pathLike) return null
  const p = pathLike
  return path.isAbsolute(p) ? p : path.resolve(cwd, p)
}

// 中文注释：与 `generate-page-from-layout-json.mjs` 保持一致的命名转换口径。
function toPascalCase(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

async function fileExists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function run(cmd, cwd) {
  // 让命令输出在当前终端可见（演示/排查更友好）
  execSync(cmd, { cwd, stdio: 'inherit' })
}

async function main() {
  const cwd = process.cwd()

  const uiSpecPath = resolveMaybe(
    getArg('--ui-spec', 'scripts/examples/figma-home-layout.json'),
    cwd,
  )
  const apiSpecPath = resolveMaybe(
    getArg('--api-spec', 'scripts/examples/api-requirement.json'),
    cwd,
  )

  const outRunDir = resolveMaybe(getArg('--out', 'reports/req/materialize-last'), cwd)
  if (!uiSpecPath || !apiSpecPath) throw new Error('Missing --ui-spec or --api-spec')

  if (!(await fileExists(uiSpecPath))) throw new Error(`UI spec not found: ${uiSpecPath}`)
  if (!(await fileExists(apiSpecPath))) throw new Error(`API spec not found: ${apiSpecPath}`)

  // 固定产物路径（被 e2e 验证脚本/quality gate 读取）
  const openapiOut = path.resolve(cwd, 'reports/openapi.generated.json')
  const apiOutDir = path.resolve(cwd, 'src/api/generated')
  const apiTestsOutDir = path.resolve(cwd, 'tests/api/generated')
  const componentsOutDir = path.resolve(cwd, 'src/components/generated')
  const pagesOutDir = path.resolve(cwd, 'src/pages/generated')

  await mkdir(outRunDir, { recursive: true })

  // 额外的 mapping 归一化：把 spec 中的 reactComponentNames 统一成“生成器实际使用的命名结果”
  // 这样在演示时你能在 spec/证据中准确对齐 Figma frame/page 名与 React 产物名。
  const uiSpecOriginal = JSON.parse(await readFile(uiSpecPath, 'utf-8'))
  const sections = Array.isArray(uiSpecOriginal.sections) ? uiSpecOriginal.sections : []
  const reactPageName = toPascalCase(uiSpecOriginal.pageName || 'GeneratedPage')
  const sectionComponentNames = [
    ...new Set(sections.map((s) => toPascalCase(s.component || 'PrimaryButton'))),
  ]
  const userReactMapped = Array.isArray(uiSpecOriginal.mapping?.reactComponentNames)
    ? uiSpecOriginal.mapping.reactComponentNames
    : []
  const userFigmaMapped = Array.isArray(uiSpecOriginal.mapping?.figmaNodeNames)
    ? uiSpecOriginal.mapping.figmaNodeNames
    : []

  uiSpecOriginal.mapping = uiSpecOriginal.mapping || {}
  uiSpecOriginal.mapping.reactComponentNames = [
    ...new Set([reactPageName, ...userReactMapped, ...sectionComponentNames]),
  ]
  uiSpecOriginal.mapping.figmaNodeNames = [...new Set([...userFigmaMapped])]

  const normalizedUiSpecPath = path.resolve(outRunDir, 'ui-spec-normalized.json')
  await writeFile(normalizedUiSpecPath, `${JSON.stringify(uiSpecOriginal, null, 2)}\n`, 'utf-8')

  // 1) 生成 OpenAPI
  run(
    `node ./scripts/generate-openapi-from-requirement.mjs --input "${uiSpecPath === null ? apiSpecPath : apiSpecPath}" --out "${openapiOut}"`,
    cwd,
  )

  // 2) 生成 API client（types.ts + client.ts）
  run(
    `node ./scripts/generate-api-code-from-openapi.mjs --input "${openapiOut}" --out "${apiOutDir}"`,
    cwd,
  )

  // 2.1) 生成 API 集成测试（读取 openapi.generated.json + 导入 client）
  // 目的：确保后续 `npm run test` 不依赖“仓库里已有旧 integration 测试文件”的状态。
  // 由于 CI 里会在存在 openapi-contract.spec.ts 时跳过 integration/unit/snapshot 的自动生成，
  // 所以这里必须在物化阶段确保 integration 用例与当前 OpenAPI 同步。
  run(`npm run gen:integration-tests`, cwd)

  // 3) 生成 API 合约测试（smoke）
  run(
    `node ./scripts/generate-api-tests-from-openapi.mjs --input "${openapiOut}" --out "${apiTestsOutDir}"`,
    cwd,
  )

  // 4) 可选：由 uiSpec 里携带 components（如果存在，则生成组件）
  if (Array.isArray(uiSpecOriginal.components) && uiSpecOriginal.components.length > 0) {
    const tmpDir = path.resolve(outRunDir, 'component-spec-tmp')
    await mkdir(tmpDir, { recursive: true })

    for (let i = 0; i < uiSpecOriginal.components.length; i++) {
      const comp = uiSpecOriginal.components[i]
      const tmpFile = path.resolve(tmpDir, `component-${i + 1}.json`)
      await writeFile(tmpFile, `${JSON.stringify(comp, null, 2)}\n`, 'utf-8')

      run(
        `node ./scripts/generate-component-from-figma-json.mjs --input "${tmpFile}" --out "${componentsOutDir}"`,
        cwd,
      )
    }
    // 组件生成后刷新 index.ts
    run(`npm run gen:component-index`, cwd)
  } else {
    // 无组件 spec 时，仍尝试刷新 index 以覆盖运行时新增组件的情况
    await mkdir(componentsOutDir, { recursive: true })
    run(`npm run gen:component-index`, cwd)
  }

  // 5) 生成页面
  run(
    `node ./scripts/generate-page-from-layout-json.mjs --input "${normalizedUiSpecPath}" --out "${pagesOutDir}"`,
    cwd,
  )

  // 6) 映射校验：确保 reactPageName/组件名确实生成了对应文件
  const expectedPageFile = path.resolve(pagesOutDir, `${reactPageName}.tsx`)
  if (!(await fileExists(expectedPageFile))) {
    throw new Error(`Mapping validation failed: expected page file missing: ${expectedPageFile}`)
  }

  for (const componentName of sectionComponentNames) {
    const expectedComponentFile = path.resolve(componentsOutDir, `${componentName}.tsx`)
    if (!(await fileExists(expectedComponentFile))) {
      throw new Error(`Mapping validation failed: expected component file missing: ${expectedComponentFile}`)
    }
  }

  // 6) 落地运行记录，便于“每一步在做什么”的演示证据
  await writeFile(
    path.resolve(outRunDir, 'materialize-inputs.json'),
    `${JSON.stringify(
      {
        uiSpecPath,
        apiSpecPath,
        normalizedUiSpecPath,
        reactPageName,
        sectionComponentNames,
        mappingReactComponentNames: uiSpecOriginal.mapping.reactComponentNames,
        mappingFigmaNodeNames: uiSpecOriginal.mapping.figmaNodeNames,
        openapiOut,
        apiOutDir,
        apiTestsOutDir,
        pagesOutDir,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log('Materialize complete.')
  console.log(`- UI spec: ${uiSpecPath}`)
  console.log(`- API spec: ${apiSpecPath}`)
  console.log(`- OpenAPI: ${openapiOut}`)
  console.log(`- API code: ${apiOutDir}`)
  console.log(`- API tests: ${apiTestsOutDir}`)
  console.log(`- Pages: ${pagesOutDir}`)
}

main().catch((error) => {
  console.error('Materialize from spec failed:', error.message)
  process.exit(1)
})

