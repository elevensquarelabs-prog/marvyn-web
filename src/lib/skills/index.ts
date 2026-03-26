import fs from 'fs'
import path from 'path'

function loadSkill(name: string): string {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'skills', `${name}.md`)
  return fs.readFileSync(filePath, 'utf-8')
}

export const skills = {
  seoAudit: loadSkill('seo-audit'),
  paidAds: loadSkill('paid-ads'),
  socialContent: loadSkill('social-content'),
  copywriting: loadSkill('copywriting'),
  contentStrategy: loadSkill('content-strategy'),
  emailSequence: loadSkill('email-sequence'),
  adCreative: loadSkill('ad-creative'),
  competitorAlternatives: loadSkill('competitor-alternatives'),
  marketingOpsPlan: loadSkill('marketing-ops-plan'),
}

export type SkillKey = keyof typeof skills

/** Maps chip IDs (from the frontend) to skill content */
export const CHIP_TO_SKILL: Record<string, string> = {
  'paid-ads': skills.paidAds,
  'seo-audit': skills.seoAudit,
  'social-content': skills.socialContent,
  'copywriting': skills.copywriting,
  'content-strategy': skills.contentStrategy,
  'email-sequence': skills.emailSequence,
  'ad-creative': skills.adCreative,
  'competitor-alternatives': skills.competitorAlternatives,
}

export function getSkillByChipId(chipId: string): string {
  return CHIP_TO_SKILL[chipId] ?? ''
}
