import { describe, expect, it, vi } from 'vitest'
import { login, refreshCaptcha } from '../../../src/api/generated/client'

describe('OpenAPI integration flow', () => {
  it('executes generated client operations with mocked fetch', async () => {
    const mockedFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ __mock: 'login' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ __mock: 'refreshCaptcha' }),
      })
    vi.stubGlobal('fetch', mockedFetch)

    const result1 = await login({} as unknown as Parameters<typeof login>[0])
    const result2 = await refreshCaptcha()

    expect(result1).toEqual({ __mock: 'login' })
    expect(result2).toEqual({ __mock: 'refreshCaptcha' })

    expect(mockedFetch.mock.calls[0][0]).toBe('/api/v1/auth/login')
    expect(mockedFetch.mock.calls[0][1].method).toBe('POST')
    expect(mockedFetch.mock.calls[1][0]).toBe('/api/v1/auth/captcha')
    expect(mockedFetch.mock.calls[1][1].method).toBe('GET')
  })
})
