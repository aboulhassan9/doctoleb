import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type SeedMode = 'dry_run' | 'write'
export type SeedVolume = 'tiny' | 'small'

export type SeedConfig = {
  tenantId: string
  mode: SeedMode
  volume: SeedVolume
  seedTag: string
  allowDuplicates: boolean
}

export type SeedPlan = {
  seedTag: string
  volume: SeedVolume
  rows: {
    patients: number
    appointments: number
    completedAppointments: number
    cancelledAppointments: number
    noShowAppointments: number
    futureAppointments: number
    conversations: number
    messages: number
  }
}

export type SeedContext = {
  tenant: Record<string, string>
  seedTag: string
  serviceClient: SupabaseClient
  operatorClient: SupabaseClient
  doctorClient: SupabaseClient
  doctor: Record<string, unknown>
  operator: Record<string, unknown>
  visitTypes: Record<string, unknown>[]
  diseases: Record<string, unknown>[]
  familyRelations: Record<string, unknown>[]
  counts: Record<string, number>
}
