import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'noreply@marvyn.tech'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://marvyn.tech'

export async function sendWelcomeEmail(to: string, name: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Marvyn — your AI marketing OS',
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;padding:0 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:44px;height:44px;background:#DA7756;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;">M</div>
    </div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">Welcome, ${name} 👋</h1>
    <p style="color:#888;font-size:15px;line-height:1.6;margin:0 0 24px;">
      You've been approved for Marvyn beta access. Your account is ready — log in and start building your marketing OS.
    </p>
    <a href="${APP_URL}/login" style="display:inline-block;background:#DA7756;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
      Go to Marvyn →
    </a>
    <p style="color:#444;font-size:12px;margin:32px 0 0;">
      This is a closed beta invitation. Keep your login details safe.
    </p>
  </div>
</body>
</html>`,
  })
}

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${APP_URL}/api/auth/send-verification?token=${token}`
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Verify your email — Marvyn',
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;padding:0 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:44px;height:44px;background:#DA7756;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;">M</div>
    </div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">Verify your email</h1>
    <p style="color:#888;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Click the button below to verify your email address. This link expires in 24 hours.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:#DA7756;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
      Verify email →
    </a>
    <p style="color:#444;font-size:12px;margin:24px 0 0;">
      Or copy this link: <span style="color:#666;">${verifyUrl}</span>
    </p>
    <p style="color:#333;font-size:11px;margin:16px 0 0;">If you didn't create a Marvyn account, ignore this email.</p>
  </div>
</body>
</html>`,
  })
}

export async function sendWeeklyDigestEmail(
  to: string,
  name: string,
  digest: {
    headline: string
    highlights: string[]
    recommendations: Array<{ title: string; description: string }>
    totalClicks: number
    totalImpressions: number
    weekLabel: string
  }
) {
  const highlightItems = digest.highlights
    .map(h => `<li style="margin:0 0 8px;color:#ccc;font-size:14px;line-height:1.5;">${h}</li>`)
    .join('')

  const recItems = digest.recommendations
    .map(
      (r, i) => `
      <div style="border:1px solid #222;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-size:13px;color:#DA7756;font-weight:600;margin-bottom:4px;">${i + 1}. ${r.title}</div>
        <div style="font-size:13px;color:#888;line-height:1.5;">${r.description}</div>
      </div>`
    )
    .join('')

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Your Marvyn weekly recap — ${digest.weekLabel}`,
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 0;">
  <div style="max-width:520px;margin:0 auto;padding:0 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:44px;height:44px;background:#DA7756;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;">M</div>
    </div>
    <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Weekly Recap · ${digest.weekLabel}</div>
    <h1 style="font-size:20px;font-weight:600;margin:0 0 20px;line-height:1.4;">${digest.headline}</h1>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#DA7756;">${digest.totalClicks.toLocaleString()}</div>
        <div style="font-size:11px;color:#555;margin-top:4px;">organic clicks</div>
      </div>
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#DA7756;">${digest.totalImpressions.toLocaleString()}</div>
        <div style="font-size:11px;color:#555;margin-top:4px;">impressions</div>
      </div>
    </div>

    <h2 style="font-size:13px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">This week</h2>
    <ul style="margin:0 0 24px;padding-left:18px;">${highlightItems}</ul>

    <h2 style="font-size:13px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Your plan for next week</h2>
    ${recItems}

    <div style="margin-top:28px;text-align:center;">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#DA7756;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">Open Marvyn →</a>
    </div>
    <p style="color:#333;font-size:11px;margin:28px 0 0;text-align:center;">Marvyn · AI Marketing OS · <a href="${APP_URL}" style="color:#444;text-decoration:none;">marvyn.tech</a></p>
  </div>
</body>
</html>`,
  })
}

export async function sendTempPasswordEmail(to: string, name: string, temporaryPassword: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Your Marvyn account is ready — temporary password inside',
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;padding:0 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:44px;height:44px;background:#DA7756;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;">M</div>
    </div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">Your temporary password, ${name}</h1>
    <p style="color:#888;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Your Marvyn account is ready. Use the temporary password below to log in — you'll be asked to set a new one immediately.
    </p>
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#555;margin-bottom:6px;">Temporary password</div>
      <div style="font-size:18px;font-weight:700;color:#DA7756;letter-spacing:2px;font-family:monospace;">${temporaryPassword}</div>
    </div>
    <a href="${APP_URL}/login" style="display:inline-block;background:#DA7756;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
      Log in to Marvyn →
    </a>
    <p style="color:#333;font-size:11px;margin:24px 0 0;">If you weren't expecting this email, contact support@marvyn.tech.</p>
  </div>
</body>
</html>`,
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your password — Marvyn',
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0A0A0A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;padding:0 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:44px;height:44px;background:#DA7756;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;">M</div>
    </div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">Reset your password</h1>
    <p style="color:#888;font-size:15px;line-height:1.6;margin:0 0 24px;">
      We received a request to reset your Marvyn password. Click below — this link expires in 1 hour.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#DA7756;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
      Reset password →
    </a>
    <p style="color:#444;font-size:12px;margin:24px 0 0;">
      Or copy this link: <span style="color:#666;">${resetUrl}</span>
    </p>
    <p style="color:#333;font-size:11px;margin:16px 0 0;">If you didn't request this, ignore this email — your password won't change.</p>
  </div>
</body>
</html>`,
  })
}
