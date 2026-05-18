import { SAFE_TAG, VOLUME_PRESETS } from './constants.ts'
import type { SeedConfig, SeedMode, SeedPlan, SeedVolume } from './types.ts'

export function defaultSeedTag(now = new Date()) {
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  return `ops_seed_${yyyy}${mm}${dd}`
}

function normalizeSeedTag(value: unknown) {
  const seedTag = typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : defaultSeedTag()
  return SAFE_TAG.test(seedTag) ? seedTag : ''
}

function normalizeVolume(value: unknown): SeedVolume {
  return value === 'small' ? 'small' : 'tiny'
}

function normalizeMode(value: unknown): SeedMode {
  return value === 'write' ? 'write' : 'dry_run'
}

function normalizeBoolean(value: unknown) {
  return value === true
}

export function readConfig(body: Record<string, unknown>): SeedConfig | null {
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''
  const seedTag = normalizeSeedTag(body.seedTag)
  if (!tenantId || !seedTag) return null

  return {
    tenantId,
    mode: normalizeMode(body.mode),
    volume: normalizeVolume(body.volume),
    seedTag,
    allowDuplicates: normalizeBoolean(body.allowDuplicates),
  }
}

export function buildPlan(config: SeedConfig): SeedPlan {
  const preset = VOLUME_PRESETS[config.volume]
  const completed = Math.round(preset.appointments * 0.68)
  const cancelled = Math.max(1, Math.round(preset.appointments * 0.1))
  const noShow = Math.max(1, Math.round(preset.appointments * 0.05))
  const future = Math.max(1, preset.appointments - completed - cancelled - noShow)

  return {
    seedTag: config.seedTag,
    volume: config.volume,
    rows: {
      patients: preset.patients,
      appointments: preset.appointments,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      futureAppointments: future,
      conversations: preset.conversations,
      messages: preset.conversations * preset.messagesPerConversation,
    },
  }
}
