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
    <main>
      <h2>登录</h2>

      <div>
        <div>用户名</div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
        />
      </div>

      <div>
        <div>密码</div>
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
        />
      </div>

      <div>
        <div>验证码</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            {captchaImageUrl ? (
              <img src={captchaImageUrl} alt="captcha" style={{ width: 140, height: 40 }} />
            ) : (
              <div>验证码图片加载中...</div>
            )}
          </div>
          <button type="button" onClick={handleRefreshCaptcha}>
            刷新
          </button>
        </div>
        <input
          value={captcha}
          onChange={(e) => setCaptcha(e.target.value)}
          placeholder="请输入验证码"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={handleLogin}>
          登录
        </button>
      </div>

      <div style={{ marginTop: 8 }}>状态：{status}</div>
    </main>
  )
}
