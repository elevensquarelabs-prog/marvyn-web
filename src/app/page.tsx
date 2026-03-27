'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-headline',
  weight: ['400', '500', '600', '700', '800'],
})

const integrations = [
  { name: 'Meta Ads', logo: '/landing/meta.png', note: 'Paid social + creative testing' },
  { name: 'Google Ads', logo: '/landing/google-ads.png', note: 'Search demand and paid intent' },
  { name: 'LinkedIn', logo: '/landing/linkedin.png', note: 'B2B distribution and ads' },
  { name: 'GA4', logo: '/landing/ga4.png', note: 'Sessions, funnels, and attribution' },
  { name: 'Clarity', logo: '/landing/clarity.png', note: 'Behavior, dead clicks, and friction' },
]

const orchestrationSteps = [
  {
    step: '01',
    title: 'Deep ingestion',
    body: 'Marvyn reads brand context, SEO gaps, performance signals, funnel behavior, and publishing output before suggesting anything.',
  },
  {
    step: '02',
    title: 'Tactical synthesis',
    body: 'The strategy engine converts those signals into a 30-day operating plan with KPI targets, channel lanes, and execution tasks.',
  },
  {
    step: '03',
    title: 'Human-in-the-loop',
    body: 'Nothing is blindly shipped. Marketers review, commit, and refine the plan before a single campaign or content action goes live.',
  },
]

const accountabilityItems = [
  { label: 'Approve LinkedIn content pillars', done: true },
  { label: 'Verify Meta budget allocation', done: true },
  { label: 'Finalize landing page wireframes', done: false },
]

const contentProof = [
  {
    title: 'Adaptive voice mimicry',
    body: 'Marvyn learns your brand rhythm and strategy context so content feels operator-grade, not template-generated.',
  },
  {
    title: 'Social preview workflow',
    body: 'Review LinkedIn, Meta, and social drafts inside one operating system before approving or scheduling.',
  },
  {
    title: 'Strategy-backed creative',
    body: 'Every draft ties back to the active cycle, not a disconnected writing prompt.',
  },
]

const problemPoints = [
  {
    title: 'Too many dashboards, no operating view',
    body: 'Paid performance, SEO, behavior analytics, and content output live in different tools, so teams spend more time reconciling data than deciding what matters.',
  },
  {
    title: 'Content gets produced without strategic context',
    body: 'Most teams can ship posts and ads, but they cannot easily tie them back to the current bottleneck, KPI target, or conversion path.',
  },
  {
    title: 'Strategy lives in meetings instead of systems',
    body: 'The plan gets discussed, but execution, approvals, and review stay fragmented. That is where momentum and budget get lost.',
  },
]

const productModules = [
  {
    title: 'Strategy',
    subtitle: 'Diagnose the bottleneck and commit a 30-day cycle.',
    body: 'Marvyn builds a draft, helps you refine it, and turns it into a live operating plan with KPI targets and review built in.',
  },
  {
    title: 'Ads',
    subtitle: 'Read paid signals before spending more.',
    body: 'Meta and Google Ads context feed into one decision layer so campaign guidance is tied to actual performance, not generic playbooks.',
  },
  {
    title: 'SEO',
    subtitle: 'Spot content gaps and ranking opportunities.',
    body: 'Search Console, technical SEO signals, and keyword opportunities flow into briefs, priorities, and long-term search strategy.',
  },
  {
    title: 'Analytics',
    subtitle: 'See traffic, behavior, and conversion paths together.',
    body: 'GA4 and Clarity help Marvyn understand what users do, where friction exists, and whether the funnel is ready for more acquisition.',
  },
  {
    title: 'Alerts',
    subtitle: 'Surface drops, gaps, and issues early.',
    body: 'Marvyn turns anomalies and missed opportunities into action prompts instead of leaving them buried in reporting tools.',
  },
  {
    title: 'Social + Content',
    subtitle: 'Execute faster without losing context.',
    body: 'Posts, briefs, social drafts, and publishing decisions stay tied to the active plan so output supports the actual cycle objective.',
  },
]

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DA7755] shadow-[0_14px_30px_rgba(218,119,85,0.24)]">
      <span className="text-lg font-black text-white">M</span>
    </div>
  )
}

function TopNav({
  darkMode,
  onToggleDarkMode,
}: {
  darkMode: boolean
  onToggleDarkMode: () => void
}) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--landing-border-soft)] bg-[color:var(--landing-nav)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="font-[family-name:var(--font-headline)] text-2xl font-extrabold uppercase tracking-tight text-[color:var(--landing-text)]">
              Marvyn
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a className="font-[family-name:var(--font-headline)] text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--landing-accent)] transition-colors hover:opacity-80" href="#ecosystem">
            Ecosystem
          </a>
          <a className="font-[family-name:var(--font-headline)] text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="#orchestration">
            Intelligence
          </a>
          <a className="font-[family-name:var(--font-headline)] text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="#beta-form">
            Beta
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="hidden rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] px-3 py-2 font-[family-name:var(--font-headline)] text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--landing-text)] transition-colors hover:border-[color:var(--landing-accent)] sm:inline-flex"
          >
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <Link href="/login" className="font-[family-name:var(--font-headline)] hidden text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)] sm:inline-flex">
            Login
          </Link>
          <a
            href="#beta-form"
            className="rounded-xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] px-5 py-2.5 font-[family-name:var(--font-headline)] text-sm font-bold tracking-tight !text-white shadow-lg shadow-[#994527]/20 transition-transform hover:scale-[1.01]"
          >
            Request Beta Access
          </a>
        </div>
      </div>
    </nav>
  )
}

function HeroSection() {
  return (
    <section className="relative mx-auto max-w-[1440px] overflow-visible px-6 py-20 pt-28 lg:px-10 lg:py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--landing-hero-glow-1),transparent_30%),radial-gradient(circle_at_bottom_left,var(--landing-hero-glow-2),transparent_35%)]" />
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="mb-6 inline-block font-[family-name:var(--font-headline)] text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--landing-accent)]">
            Marketing OS Beta
          </span>
          <h1 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-[0.94] tracking-tight text-[color:var(--landing-text)] md:text-6xl xl:text-7xl">
            Marketing,
            <br />
            orchestrated
            <br />
            by <span className="italic text-[color:var(--landing-accent)]">intelligence.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-light leading-relaxed text-[color:var(--landing-muted)] md:text-xl">
            Marvyn is the AI marketing operating system that reads your data, builds your 30-day plan, and helps your team execute with clarity.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a
              href="#beta-form"
              className="rounded-xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] px-8 py-4 text-center font-[family-name:var(--font-headline)] text-base font-bold tracking-tight !text-white shadow-xl shadow-[#994527]/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
            >
              Request Beta Access
            </a>
            <a
              href="#chat"
              className="rounded-xl bg-[color:var(--landing-surface-3)] px-8 py-4 text-center font-[family-name:var(--font-headline)] text-base font-bold tracking-tight text-[color:var(--landing-text)] transition-colors hover:opacity-90"
            >
              View Demo
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-[color:var(--landing-accent-glow)] blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] shadow-[0_30px_90px_rgba(153,69,39,0.12)]">
            <img
              alt="Marvyn dashboard preview on laptop"
              className="h-full w-full object-cover"
              src="/landing/hero-dashboard.png"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color:var(--landing-panel)] via-[color:var(--landing-panel-fade)] to-transparent p-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Reads', 'Ads, GA4, Search Console, Clarity'],
                  ['Diagnoses', 'Bottlenecks, channel readiness, waste'],
                  ['Executes', 'Strategy cycles, content, alerts, reviews'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-[color:var(--landing-border-soft)] bg-[color:var(--landing-panel-fade-strong)] p-4 backdrop-blur-sm">
                    <p className="font-[family-name:var(--font-headline)] text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-muted)]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function EcosystemSection() {
  return (
    <section id="ecosystem" className="bg-[color:var(--landing-surface-1)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-headline)] text-3xl font-extrabold tracking-tight text-[color:var(--landing-text)] md:text-4xl">The unified ecosystem</h2>
            <p className="mt-4 max-w-xl text-lg text-[color:var(--landing-muted)]">
              Marvyn speaks the language of the marketing tools you already use. It connects them into one operating context.
            </p>
          </div>
          <div className="flex gap-3">
            {['west', 'east'].map((item) => (
              <div
                key={item}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--landing-border)] text-[color:var(--landing-muted)]"
              >
                <span className="text-xs font-bold uppercase">{item === 'west' ? '←' : '→'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid overflow-hidden rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] md:grid-cols-5">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex min-h-[190px] flex-col items-center justify-center gap-4 border-b border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] px-6 py-8 text-center transition-colors hover:bg-[color:var(--landing-surface-0)] md:border-b-0 md:border-r last:border-r-0"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--landing-surface-0)]">
                <img alt={integration.name} className="h-10 w-10 object-contain" src={integration.logo} />
              </div>
              <div>
                <p className="font-[family-name:var(--font-headline)] text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--landing-muted)]">{integration.name}</p>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--landing-muted-2)]">{integration.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProblemSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <div className="mb-8 flex items-center gap-4 text-[color:var(--landing-accent)]">
            <span className="h-px w-12 bg-[color:var(--landing-accent)]" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Why teams stall</span>
          </div>
          <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--landing-text)] md:text-5xl">
            Most marketing teams do not have a tool problem.
            <br />
            They have a coordination problem.
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[color:var(--landing-muted)]">
            Ads, SEO, analytics, content, and strategy all live in different places. Marvyn exists to turn that fragmented stack into one shared operating system.
          </p>
        </div>

        <div className="grid gap-5">
          {problemPoints.map((point, index) => (
            <div
              key={point.title}
              className="rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] p-7 shadow-sm transition-all hover:border-[color:var(--landing-accent)]/25 hover:shadow-lg"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--landing-accent-soft)] font-[family-name:var(--font-headline)] text-sm font-bold text-[color:var(--landing-accent)]">
                  0{index + 1}
                </div>
                <h3 className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[color:var(--landing-text)]">
                  {point.title}
                </h3>
              </div>
              <p className="leading-relaxed text-[color:var(--landing-muted)]">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OrchestrationSection() {
  return (
    <section id="orchestration" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold tracking-tight text-[color:var(--landing-text)] md:text-5xl">
          Collaborative orchestration
        </h2>
        <p className="mt-5 text-xl font-light text-[color:var(--landing-muted)]">
          The agent does not just suggest. It builds a validated roadmap for your approval.
        </p>
      </div>

      <div className="relative mt-14 grid gap-8 md:grid-cols-3">
        <div className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[color:var(--landing-border)] to-transparent md:block" />
        {orchestrationSteps.map((step) => (
          <div
            key={step.step}
            className="relative rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] p-7 shadow-sm transition-all hover:border-[color:var(--landing-accent)]/25 hover:shadow-lg"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--landing-surface-0)] font-[family-name:var(--font-headline)] text-lg font-bold text-[color:var(--landing-accent)] shadow-sm">
              {step.step}
            </div>
            <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold tracking-tight text-[color:var(--landing-text)]">{step.title}</h3>
            <p className="mt-4 leading-relaxed text-[color:var(--landing-muted)]">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AccountabilitySection() {
  return (
    <section className="bg-[color:var(--landing-surface-2)] px-6 py-20 lg:px-10">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div className="relative">
          <div className="rounded-[2.5rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] p-8 shadow-[0_30px_80px_rgba(153,69,39,0.08)]">
            <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-[family-name:var(--font-headline)] text-xl font-extrabold text-[color:var(--landing-text)]">Campaign: Q4 Growth</h4>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--landing-muted)]">Status: Active Strategy</p>
              </div>
              <button className="rounded-xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] px-5 py-2.5 text-sm font-bold !text-white shadow-md">
                Commit Plan
              </button>
            </div>

            <div className="space-y-5">
              {accountabilityItems.map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
                      item.done ? 'border-[color:var(--landing-accent)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]' : 'border-[color:var(--landing-muted-2)]'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.done ? '✓' : ''}</span>
                  </div>
                  <span className="text-sm font-medium text-[color:var(--landing-text)]">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <div className="mb-2 flex items-end justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--landing-muted)]">Strategy completion</span>
                <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-[color:var(--landing-accent)]">66%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--landing-surface-3)]">
                <div className="h-full w-2/3 bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)]" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-8 flex items-center gap-4 text-[color:var(--landing-accent)]">
            <span className="h-px w-12 bg-[color:var(--landing-accent)]" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Accountability system</span>
          </div>
          <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--landing-text)] md:text-5xl">
            Execution without ambiguity.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-[color:var(--landing-muted)]">
            Marvyn turns AI recommendations into a concrete commit plan with task checklists, progress tracking, and a review loop tied to the active strategy cycle.
          </p>
          <ul className="mt-10 space-y-6">
            {['Structured task checklists', 'Visual progress tracking', 'KPI vs actual review loop'].map((item) => (
              <li key={item} className="flex gap-4">
                <span className="pt-0.5 text-[color:var(--landing-accent)]">●</span>
                <span className="font-semibold text-[color:var(--landing-text)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ProductModulesSection() {
  return (
    <section className="bg-[color:var(--landing-surface-1)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-8 flex items-center gap-4 text-[color:var(--landing-accent)]">
            <span className="h-px w-12 bg-[color:var(--landing-accent)]" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">What Marvyn includes</span>
          </div>
          <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--landing-text)] md:text-5xl">
            A real operating layer, not a collection of disconnected AI widgets.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[color:var(--landing-muted)]">
            Every module in Marvyn is tied to the same context: the brand, the data, the active strategy cycle, and what the team is actually trying to improve this month.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {productModules.map((module) => (
            <div
              key={module.title}
              className="rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-[color:var(--landing-accent)]/25 hover:shadow-lg"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">{module.title}</p>
              <h3 className="mt-4 font-[family-name:var(--font-headline)] text-2xl font-bold tracking-tight text-[color:var(--landing-text)]">
                {module.subtitle}
              </h3>
              <p className="mt-4 leading-relaxed text-[color:var(--landing-muted)]">{module.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContentEngineSection() {
  return (
    <section className="bg-[color:var(--landing-panel)] px-6 py-20 lg:px-10">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-10">
          <div className="flex items-center gap-4 text-[color:var(--landing-accent)]">
            <span className="h-px w-12 bg-[color:var(--landing-accent)]" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Editorial engine</span>
          </div>
          <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--landing-text)] md:text-5xl">
            Narratives that scale, naturally.
          </h2>
          <p className="text-lg leading-relaxed text-[color:var(--landing-muted)]">
            Marvyn connects strategy, voice, and channel context so your team ships marketing that sounds deliberate, not AI-generated.
          </p>
          <div className="space-y-6">
            {contentProof.map((item) => (
              <div key={item.title} className="flex gap-4">
                <span className="pt-1 text-xl text-[color:var(--landing-accent)]">✦</span>
                <div>
                  <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[color:var(--landing-text)]">{item.title}</h4>
                  <p className="mt-2 leading-relaxed text-[color:var(--landing-muted)]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-1)] p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--landing-accent-soft)] text-sm font-bold text-[color:var(--landing-accent)]">GM</div>
                <div>
                  <p className="text-sm font-bold text-[color:var(--landing-text)]">Growth Marketer</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--landing-muted)]">Performance team</p>
                </div>
              </div>
              <p className="italic leading-relaxed text-[color:var(--landing-muted)]">
                “This feels like the first AI marketing product that understands the difference between strategy, execution, and review.”
              </p>
            </div>

            <div className="rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] p-8 shadow-sm">
              <img
                alt="Social preview card"
                className="mb-6 h-48 w-full rounded-xl object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuABHeur9lzu5z_Ei1fhCZF_PqJ1ccMAqkq93B0Im9pFNjMItiK60DvUdWQgR7UHXG7q35vCCVe_dg-HXXREZF_MPre_c7I99VBU_b9idAG6IO93sSFqvQfj9OvHBxI79kEm7fZC_1ndsgIVZKn2mywNZQ8SM1BANI7EHBuYkk9WFn_UEaovnnaNlN6qWDwE2vIjKp3ZyFjmb8jjE0KlR0xaKoY0B8vGethfucv0Y6jHm7mK99VYvJA6s-K7Hkl_BVTc9LKMjWc6aAzS"
              />
              <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[color:var(--landing-text)]">Social preview</h4>
              <p className="mt-2 text-sm text-[color:var(--landing-muted)]">Review a campaign draft before it hits your publishing queue.</p>
            </div>
          </div>

          <div className="relative flex min-h-[460px] flex-col justify-end overflow-hidden rounded-[2rem] bg-[color:var(--landing-surface-3)] p-8">
            <img
              alt="Operator dashboard background"
              className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-multiply"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxSQrmf1lvRZyjG-d2zS_YhHfcTjmFMxBgEwscuDSHKmd-94lZ9Qn8pBfwW6jkmvH63HCmr-8LxCOX4PLzdmAvxQghqu2cAY09-bIQVs7oarqV3gIDJfQXng_gPD_ybTwMBj5t9ULuhMnVheblYK0rIslZKIwaxRISFhr99-GHE1EWjt5wDFKnh84QCNxnGpl1fXOlQADcnp9fcBGJ3cqVq1oR6c4H1rEAp6ufRzgS7uRnWPU4dOBbxuD5bL_XZl5GCOFrhOhp0Ud5"
            />
            <div className="relative z-10">
              <div className="mb-6 h-1 w-12 bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)]" />
              <h3 className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-[color:var(--landing-text)]">Context over content spam</h3>
              <p className="mt-4 max-w-md leading-relaxed text-[color:var(--landing-muted)]">
                Marvyn turns strategy, data, and brand context into a system your team can actually trust.
              </p>
              <a href="#beta-form" className="mt-8 inline-flex items-center gap-2 font-bold text-[color:var(--landing-accent)]">
                Request beta access <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MarvynChatSection() {
  return (
    <section id="chat" className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] shadow-[0_25px_70px_rgba(153,69,39,0.1)]">
        <div className="flex items-center justify-between border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-3)] px-10 py-6">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-[color:var(--landing-accent-soft-strong)]" />
            <span className="font-[family-name:var(--font-headline)] text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--landing-muted)]">
              Marvyn Chat
            </span>
          </div>
          <span className="text-[color:var(--landing-muted)]">⋯</span>
        </div>

        <div className="min-h-[360px] space-y-8 p-8">
          <div className="flex justify-end">
            <div className="max-w-md rounded-2xl rounded-tr-none bg-[color:var(--landing-accent-soft)] p-6">
              <p className="font-medium italic text-[color:var(--landing-text)]">
                “Which ad creative had the highest emotional resonance with our Gen Z audience last month?”
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] text-white">
              ✦
            </div>
            <div className="max-w-2xl space-y-4">
              <p className="leading-relaxed text-[color:var(--landing-muted)]">
                Analyzing performance, behavior, and conversion paths. The strongest signal came from your “Proof + clarity” creative set. It outperformed on CTR and assisted conversions while holding CPC steady.
              </p>
              <div className="flex flex-wrap gap-3">
                {['View data map', 'Export chart', 'Build follow-up brief'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[color:var(--landing-surface-2)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--landing-muted)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[color:var(--landing-border)] pt-8">
            <div className="relative">
              <input
                className="w-full rounded-2xl bg-[color:var(--landing-surface-1)] px-7 py-5 pr-24 text-lg font-light italic text-[color:var(--landing-text)] outline-none ring-0 transition-all placeholder:text-[color:var(--landing-muted-2)] focus:ring-2 focus:ring-[#da7755]/20"
                placeholder="Ask anything about your marketing system..."
                type="text"
              />
              <button className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] text-white shadow-lg">
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="bg-[color:var(--landing-surface-0)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold tracking-tight text-[color:var(--landing-text)] md:text-6xl">
          Ready to orchestrate?
        </h2>
        <div className="mt-10 flex flex-col justify-center gap-5 sm:flex-row">
          <a
            href="#beta-form"
            className="rounded-2xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] px-10 py-5 font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight !text-white shadow-2xl shadow-[#994527]/20 transition-transform hover:scale-[1.01]"
          >
            Request Beta Access
          </a>
          <a
            href="#chat"
            className="rounded-2xl border-2 border-[color:var(--landing-border)] px-10 py-5 font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight text-[color:var(--landing-text)] transition-colors hover:bg-[color:var(--landing-surface-2)]"
          >
            View Demo
          </a>
        </div>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--landing-muted)]">
          No credit card. No fluff. Human-led intelligence.
        </p>
      </div>
    </section>
  )
}

function BetaForm() {
  const [betaSubmitted, setBetaSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleBetaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    try {
      await fetch('/api/beta-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setBetaSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="beta-form" className="bg-[color:var(--landing-surface-2)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-panel)] p-8 shadow-[0_25px_70px_rgba(153,69,39,0.08)] md:p-9">
        <div className="text-center">
          <div className="inline-flex rounded-full bg-[color:var(--landing-accent-soft)] px-4 py-1.5 text-sm font-semibold text-[color:var(--landing-accent)]">
            Closed beta
          </div>
          <h2 className="mt-5 font-[family-name:var(--font-headline)] text-4xl font-extrabold tracking-tight text-[color:var(--landing-text)] md:text-5xl">
            Request beta access
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[color:var(--landing-muted)]">
            We’re onboarding marketers, founders, and lean teams that want one operating system for strategy, execution, and review.
          </p>
        </div>

        {betaSubmitted ? (
          <div className="mt-10 rounded-[2rem] border border-green-200 bg-green-50 p-8 text-center">
            <p className="text-xl font-semibold text-green-700">Request received</p>
            <p className="mt-3 text-sm text-green-800/80">We’ll review it and get back to you shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleBetaSubmit} className="mt-10 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="name"
                placeholder="Your name"
                required
                className="w-full rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-0)] px-4 py-3 text-sm text-[color:var(--landing-text)] outline-none transition-colors placeholder:text-[color:var(--landing-muted-2)] focus:border-[#da7755]"
              />
              <input
                name="company"
                placeholder="Company"
                required
                className="w-full rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-0)] px-4 py-3 text-sm text-[color:var(--landing-text)] outline-none transition-colors placeholder:text-[color:var(--landing-muted-2)] focus:border-[#da7755]"
              />
            </div>

            <input
              name="email"
              type="email"
              placeholder="Work email"
              required
              className="w-full rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-0)] px-4 py-3 text-sm text-[color:var(--landing-text)] outline-none transition-colors placeholder:text-[color:var(--landing-muted-2)] focus:border-[#da7755]"
            />

            <div className="grid gap-4 md:grid-cols-[0.42fr_0.58fr]">
              <select
                name="team_size"
                required
                className="w-full rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-0)] px-4 py-3 text-sm text-[color:var(--landing-text)] outline-none transition-colors focus:border-[#da7755]"
                defaultValue=""
              >
                <option value="" disabled>
                  Team size
                </option>
                <option value="1">Just me</option>
                <option value="2-5">2–5 people</option>
                <option value="6-20">6–20 people</option>
                <option value="20+">20+ people</option>
              </select>

              <textarea
                name="use_case"
                rows={4}
                placeholder="What are you trying to improve right now? Paid efficiency, SEO growth, funnel clarity, content velocity..."
                className="w-full resize-none rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-0)] px-4 py-3 text-sm text-[color:var(--landing-text)] outline-none transition-colors placeholder:text-[color:var(--landing-muted-2)] focus:border-[#da7755]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#994527_0%,#da7755_100%)] px-6 py-3.5 font-[family-name:var(--font-headline)] text-base font-semibold !text-white shadow-lg shadow-[#994527]/20 transition-all hover:shadow-xl disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Request Beta Access'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-[color:var(--landing-surface-1)] px-6 py-20 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 border-t border-[color:var(--landing-border-soft)] pt-12 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-[family-name:var(--font-headline)] text-lg font-bold uppercase tracking-tight text-[color:var(--landing-text)]">
            Marvyn
          </div>
          <p className="mt-4 max-w-xs text-xs uppercase tracking-[0.22em] text-[color:var(--landing-muted)]">
            © 2026 Marvyn. Built by Eleven Square Labs for operators who want marketing to behave like a system.
          </p>
        </div>

        <div className="flex flex-wrap gap-8">
          <Link className="text-xs uppercase tracking-[0.18em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="/privacy-policy">
            Privacy
          </Link>
          <Link className="text-xs uppercase tracking-[0.18em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="/terms-of-service">
            Terms
          </Link>
          <Link className="text-xs uppercase tracking-[0.18em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="/cookie-policy">
            Cookies
          </Link>
          <Link className="text-xs uppercase tracking-[0.18em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="/refund-policy">
            Refunds
          </Link>
          <Link className="text-xs uppercase tracking-[0.18em] text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-accent)]" href="/data-deletion">
            Data Deletion
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('marvyn-landing-theme')
    if (saved === 'dark') {
      setDarkMode(true)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('marvyn-landing-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const landingTheme = darkMode
    ? ({
        '--landing-bg': '#12100f',
        '--landing-nav': 'rgba(18,16,15,0.86)',
        '--landing-nav-border': 'rgba(101,76,67,0.35)',
        '--landing-surface-0': '#12100f',
        '--landing-surface-1': '#181513',
        '--landing-surface-2': '#201c19',
        '--landing-surface-3': '#28231f',
        '--landing-panel': '#161311',
        '--landing-panel-fade': 'rgba(22,19,17,0.72)',
        '--landing-panel-fade-strong': 'rgba(22,19,17,0.9)',
        '--landing-text': '#f5ede5',
        '--landing-muted': '#c9b7ad',
        '--landing-muted-2': '#9e8a81',
        '--landing-accent': '#ffb59d',
        '--landing-accent-soft': 'rgba(255,181,157,0.12)',
        '--landing-accent-soft-strong': 'rgba(255,181,157,0.38)',
        '--landing-accent-glow': 'rgba(255,181,157,0.12)',
        '--landing-border': 'rgba(121,93,82,0.42)',
        '--landing-border-soft': 'rgba(121,93,82,0.28)',
        '--landing-hero-glow-1': 'rgba(255,181,157,0.16)',
        '--landing-hero-glow-2': 'rgba(255,181,157,0.08)',
      } as React.CSSProperties)
    : ({
        '--landing-bg': '#faf9f4',
        '--landing-nav': 'rgba(250,249,244,0.85)',
        '--landing-nav-border': 'rgba(231,229,228,0.5)',
        '--landing-surface-0': '#faf9f4',
        '--landing-surface-1': '#f5f4ef',
        '--landing-surface-2': '#efeee9',
        '--landing-surface-3': '#e9e8e3',
        '--landing-panel': '#ffffff',
        '--landing-panel-fade': 'rgba(255,255,255,0.6)',
        '--landing-panel-fade-strong': 'rgba(255,255,255,0.85)',
        '--landing-text': '#1c1917',
        '--landing-muted': '#55433d',
        '--landing-muted-2': '#6b5a54',
        '--landing-accent': '#994527',
        '--landing-accent-soft': 'rgba(153,69,39,0.1)',
        '--landing-accent-soft-strong': 'rgba(153,69,39,0.45)',
        '--landing-accent-glow': 'rgba(153,69,39,0.08)',
        '--landing-border': 'rgba(219,193,185,0.45)',
        '--landing-border-soft': 'rgba(214,211,209,0.8)',
        '--landing-hero-glow-1': 'rgba(218,119,85,0.16)',
        '--landing-hero-glow-2': 'rgba(153,69,39,0.08)',
      } as React.CSSProperties)

  return (
    <div
      style={landingTheme}
      className={`${inter.variable} ${plusJakarta.variable} min-h-screen bg-[color:var(--landing-bg)] font-[family-name:var(--font-body)] text-[color:var(--landing-text)] antialiased selection:bg-[#da7755] selection:text-[#541500] transition-colors duration-300`}
    >
      <TopNav darkMode={darkMode} onToggleDarkMode={() => setDarkMode((value) => !value)} />
      <main className="overflow-x-hidden">
        <HeroSection />
        <ProblemSection />
        <EcosystemSection />
        <OrchestrationSection />
        <ProductModulesSection />
        <AccountabilitySection />
        <ContentEngineSection />
        <MarvynChatSection />
        <FinalCTA />
        <BetaForm />
      </main>
      <Footer />
    </div>
  )
}
