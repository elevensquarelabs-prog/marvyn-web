import Link from 'next/link'

type AdminLoginShellProps = {
  email: string
  password: string
  error: string
  loading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function AdminLoginShell({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AdminLoginShellProps) {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden overflow-hidden bg-[#1a120f] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(217,119,87,0.32),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(242,194,160,0.18),_transparent_28%),linear-gradient(135deg,_#130d0b_0%,_#241714_42%,_#130d0b_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute inset-y-0 right-0 w-px bg-white/10" />

          <div className="relative z-10 flex w-full flex-col justify-between px-14 py-16 xl:px-20 xl:py-20">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#f7efe8]/85">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#d97757] font-semibold tracking-normal text-white">
                  M
                </span>
                Marvyn Admin Centre
              </div>
            </div>

            <div className="max-w-2xl space-y-5">
              <div className="space-y-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[#f2c2a0]">
                  Internal operations
                </p>
                <h1 className="font-[family-name:var(--font-geist-sans)] text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#fff8f3] xl:text-6xl">
                  Administrative access for the Marvyn team
                </h1>
                <p className="max-w-xl text-base leading-7 text-[#f7efe8]/68 xl:text-lg">
                  Sign in to manage plans, credits, users, costs, and approvals.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-8 text-xs uppercase tracking-[0.28em] text-[#f7efe8]/45">
              <span>Operational access only</span>
              <span>Marvyn Web</span>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f0ea] px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(217,119,87,0.14),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(246,240,234,0.96)_100%)]" />
          <div className="absolute inset-x-6 top-6 flex justify-end sm:inset-x-10 lg:top-10 xl:inset-x-20">
            <Link
              href="/"
              className="relative z-10 inline-flex items-center gap-2 rounded-full border border-[#d9c4b8] bg-white/70 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#6f4a3b] transition hover:border-[#d97757]/40 hover:text-[#8e452d]"
            >
              Return to main site
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="relative z-10 w-full max-w-xl rounded-[2rem] border border-[#e5d5ca] bg-white/82 p-8 shadow-[0_24px_80px_rgba(71,38,26,0.12)] backdrop-blur xl:p-10">
            <div className="mb-10 space-y-4">
              <div className="inline-flex items-center gap-3 lg:hidden">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d97757] text-sm font-semibold text-white">
                  M
                </span>
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7d5547]">
                  Marvyn Admin Centre
                </span>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e7768]">
                  Admin sign in
                </p>
                <h2 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#201714]">
                  Secure Access
                </h2>
                <p className="max-w-md text-sm leading-6 text-[#7d655c]">
                  Sign in with your team credentials to access the admin centre.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-7">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="admin-email"
                    className="block text-[11px] font-medium uppercase tracking-[0.22em] text-[#8f6a5b]"
                  >
                    Corporate Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={event => onEmailChange(event.target.value)}
                    required
                    placeholder="name@company.com"
                    className="w-full rounded-2xl border border-[#dfcec3] bg-[#fffaf6] px-5 py-4 text-base text-[#241814] placeholder:text-[#b39384] transition outline-none focus:border-[#d97757] focus:bg-white focus:ring-4 focus:ring-[#d97757]/12"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="admin-password"
                    className="block text-[11px] font-medium uppercase tracking-[0.22em] text-[#8f6a5b]"
                  >
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={event => onPasswordChange(event.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-[#dfcec3] bg-[#fffaf6] px-5 py-4 text-base text-[#241814] placeholder:text-[#b39384] transition outline-none focus:border-[#d97757] focus:bg-white focus:ring-4 focus:ring-[#d97757]/12"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-[#f1b8ae] bg-[#fff0ed] px-4 py-3 text-sm text-[#8f2d19]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#9b482a_0%,#d97757_100%)] px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_16px_30px_rgba(155,72,42,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(155,72,42,0.34)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span>{loading ? 'Signing in…' : 'Enter Admin Centre'}</span>
                <span aria-hidden="true">→</span>
              </button>

            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
