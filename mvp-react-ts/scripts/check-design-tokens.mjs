// 中文注释：scripts/check-design-tokens.mjs，用于项目自动化流程实现与验证。
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(process.cwd())
const srcDir = path.join(projectRoot, 'src')

const TARGET_EXTENSIONS = new Set(['.css', '.ts', '.tsx', '.js', '.jsx'])
const TOKEN_SOURCE_FILES = new Set([
  path.join(srcDir, 'index.css'),
  path.join(srcDir, 'design-tokens.css'),
])

const COLOR_LITERAL_RE =
  /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)\b/g

// 中文注释：递归扫描目录并返回文件列表。
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return listFiles(fullPath)
      }
      return fullPath
    }),
  )
  return files.flat()
}

// 中文注释：该函数用于当前自动化流程中的关键步骤处理。
function isTargetFile(filePath) {
  return TARGET_EXTENSIONS.has(path.extname(filePath))
}

// 中文注释：物化生成的页面常内联「来自 spec 的品牌色」用于演示对齐 Figma，不参与设计 token 门禁。
function shouldIgnoreFilePath(filePath) {
  const rel = path.relative(srcDir, filePath)
  return rel.startsWith(`pages${path.sep}generated${path.sep}`)
}

// 中文注释：该函数用于当前自动化流程中的关键步骤处理。
function shouldIgnoreLine(filePath, line, inTokenDeclaration) {
  const trimmed = line.trim()

  // Token source files can define color literals in CSS custom properties.
  if (TOKEN_SOURCE_FILES.has(filePath) && (trimmed.startsWith('--') || inTokenDeclaration)) {
    return true
  }

  // Ignore comments and empty lines.
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
    return true
  }

  return false
}

// 中文注释：主执行入口：组织流程、调用子步骤并输出报告。
async function main() {
  const allFiles = await listFiles(srcDir)
  const targetFiles = allFiles.filter(isTargetFile)
  const violations = []

  for (const filePath of targetFiles) {
    if (shouldIgnoreFilePath(filePath)) continue
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split(/\r?\n/)
    let inTokenDeclaration = false

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      if (TOKEN_SOURCE_FILES.has(filePath)) {
        if (trimmed.startsWith('--') && trimmed.includes(':') && !trimmed.endsWith(';')) {
          inTokenDeclaration = true
        }
        if (inTokenDeclaration && trimmed.endsWith(';')) {
          // Keep this line ignored, then close multi-line token declaration.
          const shouldClose = true
          if (shouldIgnoreLine(filePath, line, inTokenDeclaration)) {
            if (shouldClose) inTokenDeclaration = false
            return
          }
          inTokenDeclaration = false
        }
      }

      if (shouldIgnoreLine(filePath, line, inTokenDeclaration)) return

      const matches = line.match(COLOR_LITERAL_RE)
      if (!matches) return

      violations.push({
        file: path.relative(projectRoot, filePath),
        line: index + 1,
        literals: [...new Set(matches)],
      })
    })
  }

  if (violations.length > 0) {
    console.error(
      'Design token check failed: found hard-coded color literals outside token definitions.\n',
    )
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line} -> ${violation.literals.join(', ')}`,
      )
    }
    process.exit(1)
  }

  console.log('Design token check passed: no hard-coded color literals found.')
}

main().catch((error) => {
  console.error('Design token check error:', error)
  process.exit(1)
})
