import { useState } from 'react'
import { login, refreshCaptcha } from '../../api/generated/client'

// 中文注释：src/pages/generated/LoginPage.tsx - 登录页（pageType=login 的特例生成器）
export function LoginPage() {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [captcha, setCaptcha] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [status, setStatus] = useState<string>('idle')
  const [captchaImageUrl, setCaptchaImageUrl] = useState<string>('')

  // 中文注释：当某些状态（例如 token）只用于 setState 回写但未在 UI 上直接展示时，
  // 需要通过 void token 消除 TS noUnusedLocals 报错。
  void token

  async function handleRefreshCaptcha() {
    try {
      const resp = await refreshCaptcha()
      setCaptchaImageUrl(resp.imageDataUrl)
    } catch (err) {
      console.error('refresh captcha failed:', err)
    }
  }

  async function handleLogin() {
    setStatus('loading')
    try {
      const resp = await login({
        username: username,
        password: password,
        captcha: captcha,
      })
      setToken(resp.token)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      console.error('login failed:', err)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ECEFF1',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <section
        data-testid="LoginCard"
        style={{
          width: 'min(420px, 92vw)',
          background: '#FFFFFF',
          borderRadius: 12,
          padding: '0',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(24, 97, 181, 0.12)',
        }}
      >
        <div
          data-testid="BrandHeader"
          style={{
            background: '#1565C0',
            padding: '14px 20px',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          {"网通S01-数据服务隔离交换网关"}
        </div>
        <div style={{ padding: '20px 28px 28px' }}>
        <header
          data-testid="Logo"
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}
        >
          <svg width={40} height={40} viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#1565C0"
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
              color: '#1565C0',
              lineHeight: 1.3,
            }}
          >
            {"用户登录"}
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
              border: '1px solid #CFD8DC',
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
              border: '1px solid #CFD8DC',
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
                  border: '1px solid #CFD8DC',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <div
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
                    border: '1px solid #CFD8DC',
                    display: 'block',
                  }}
                />
              ) : (
                <img src={"/login-captcha-netcom-s01.png"} alt="captcha" style={{ width: 120, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #CFD8DC' }} />
              )}
            </div>
          </div>
          <button
            type="button"
            data-testid="CaptchaRefreshButton"
            onClick={() => {
              void handleRefreshCaptcha()
            }}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #CFD8DC',
              background: '#fff',
              color: '#1565C0',
              cursor: 'pointer',
            }}
          >
            刷新验证码
          </button>
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
            background: '#1565C0',
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
        </div>
      </section>
    </main>
  )
}
