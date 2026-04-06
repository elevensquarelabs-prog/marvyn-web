import { AdminPlansShell } from './AdminPlansShell'

export default function PlansPage() {
  const plans = [
    {
      name: 'Starter',
      key: 'starter',
      price: '₹799/month',
      credits: 150,
      agentChatsPerMonth: 18,
      features: ['18 agent chats/month', '50 copy generations', '18 blog posts', '12 SEO audits', '8 competitor analyses'],
    },
    {
      name: 'Pro',
      key: 'pro',
      price: '₹1,499/month',
      credits: 400,
      agentChatsPerMonth: 50,
      features: ['50 agent chats/month', '133 copy generations', '50 blog posts', '33 SEO audits', '22 competitor analyses'],
    },
    {
      name: 'Beta',
      key: 'beta',
      price: 'Free (beta)',
      credits: 300,
      agentChatsPerMonth: 37,
      features: ['37 agent chats/month', 'All features', 'Beta access'],
    },
  ]

  const creditReference: Array<[string, string]> = [
    ['Agent Chat', '8 credits'],
    ['Blog Generate', '8 credits'],
    ['SEO Run', '30 credits'],
    ['Competitor Analysis', '18 credits'],
    ['SEO Audit', '12 credits'],
    ['Copy Generate', '3 credits'],
    ['Social Generate', '2 credits'],
    ['Strategy Plan', '6 credits'],
  ]

  return <AdminPlansShell plans={plans} creditReference={creditReference} />
}
