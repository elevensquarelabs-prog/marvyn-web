import { IntegrationsGrid } from '@/components/integrations/IntegrationsGrid'

export default function IntegrationsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Integrations</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Connect your data sources — agents will automatically use them to give you deeper analysis.
          </p>
        </div>
        <IntegrationsGrid />
      </div>
    </div>
  )
}
