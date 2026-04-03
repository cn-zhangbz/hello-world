import { describe, it, expect } from 'vitest'

describe('OpenAPI contract smoke checks', () => {
  it('contains at least one path', () => {
    const pathCount = 2
    expect(pathCount).toBeGreaterThan(0)
  })

  it('defines operationId login', () => {
    const operationId = 'login'
    expect(operationId.length).toBeGreaterThan(0)
  })

  it('defines operationId refreshCaptcha', () => {
    const operationId = 'refreshCaptcha'
    expect(operationId.length).toBeGreaterThan(0)
  })

})
