const BASE_URL = '/api/v1'

async function request<TResp>(url: string, init?: RequestInit): Promise<TResp> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`)
  }
  return (await res.json()) as TResp
}

export async function login(payload: { username: string; password: string; captcha: string }): Promise<{ token: string }> {
  return request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
}

export async function refreshCaptcha(): Promise<{ imageDataUrl: string }> {
  return request<{ imageDataUrl: string }>('/auth/captcha', { method: 'GET' })
}

