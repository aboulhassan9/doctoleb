import {
  corsHeaders,
  createTenantServiceClient,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { CONTROL_PLANE_PROVISIONING_JOB_SELECT } from '../_shared/selects.ts'
import { runTenantDatabaseMigrations } from '../_shared/tenantMigrationRunner.ts'
import { resolveTenantServiceRoleKey } from '../_shared/tenantSecrets.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ProvisioningJob = {
  id: string
  first_doctor_email: string | null
  first_doctor_display_name: string | null
  first_doctor_phone: string | null
}

type FirstDoctorContact = {
  authUserId: string
  email: string
  displayName: string
  phone: string | null
}

function normalizeUuid(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return UUID.test(id) ? id : ''
}

function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return EMAIL.test(email) && email.length <= 254 ? email : ''
}

function normalizeText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text && text.length <= maxLength ? text : ''
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text && text.length <= maxLength ? text : null
}

function safeFailureText(value: unknown, maxLength = 180) {
  const text = typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)

  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-db-url]')
    .replace(/\bsb_(?:secret|service_role|publishable)_[A-Za-z0-9_-]+/gi, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .slice(0, maxLength)
}

function safeAuthErrorDetails(error: unknown) {
  const object = error && typeof error === 'object'
    ? error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown }
    : null

  return {
    authErrorName: safeFailureText(object?.name, 80) || null,
    authErrorCode: safeFailureText(object?.code, 80) || null,
    authErrorStatus: typeof object?.status === 'number' || typeof object?.status === 'string'
      ? object.status
      : null,
    authErrorSummary: safeFailureText(object?.message ?? error) || 'Tenant Auth rejected the doctor login update.',
  }
}

function readRpcPayload(payload: unknown) {
  return payload && typeof payload === 'object'
    ? payload as { data?: unknown; error?: unknown; details?: Record<string, unknown> }
    : null
}

function readFirstDoctorContact(payload: unknown): FirstDoctorContact | null {
  const data = payload && typeof payload === 'object'
    ? (payload as { data?: unknown }).data
    : null
  const row = data && typeof data === 'object' ? data as Record<string, unknown> : null
  if (!row) return null

  const authUserId = normalizeUuid(row.authUserId)
  const email = normalizeEmail(row.email)
  const displayName = normalizeText(row.displayName, 160)
  const phone = normalizeOptionalText(row.phone, 40)

  return authUserId && email && displayName
    ? { authUserId, email, displayName, phone }
    : null
}

async function getFirstDoctorContact(tenantClient: ReturnType<typeof createTenantServiceClient>) {
  const { data, error } = await tenantClient.rpc('service_get_first_doctor_admin_contact')
  const envelope = readRpcPayload(data)
  const code = typeof envelope?.error === 'string' ? envelope.error : null
  const contact = envelope ? readFirstDoctorContact(envelope) : null

  return {
    contact,
    error,
    code,
  }
}

async function setProvisioningDoctorInput(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  jobId: string,
  email: string,
  displayName: string,
  phone: string | null,
) {
  return context.client.rpc('admin_set_provisioning_first_doctor_atomic', {
    p_actor_id: context.admin.id,
    p_job_id: jobId,
    p_email: email,
    p_display_name: displayName,
    p_phone: phone,
  })
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = normalizeUuid(body.tenantId ?? body.tenant_id)
  const email = normalizeEmail(body.email)
  const displayName = normalizeText(body.displayName ?? body.display_name, 160)
  const phone = normalizeOptionalText(body.phone, 40)

  if (!tenantId || !email || !displayName) {
    return errorResponse('FIRST_DOCTOR_ADMIN_INPUT_REQUIRED', 422, cors, {
      summary: 'Doctor name and login email are required.',
    })
  }

  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref, supabase_url')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) return errorResponse('TENANT_LOOKUP_FAILED', 500, cors)
  if (!tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)
  if (!tenant.supabase_project_ref || !tenant.supabase_url) {
    return errorResponse('TENANT_RUNTIME_CONFIG_REQUIRED', 409, cors)
  }

  const { data: job, error: jobError } = await context.client
    .from('tenant_provisioning_jobs')
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (jobError) return errorResponse('PROVISIONING_JOB_LOOKUP_FAILED', 500, cors)
  if (!job?.id) return errorResponse('PROVISIONING_JOB_NOT_FOUND', 404, cors)

  const tenantSecret = await resolveTenantServiceRoleKey(context.client, {
    tenantId,
    projectRef: tenant.supabase_project_ref,
  })

  if (!tenantSecret.key) {
    return errorResponse('TENANT_SERVICE_ROLE_SECRET_REQUIRED', 409, cors, {
      summary: 'Save the tenant service-role key before changing doctor login.',
      secretName: tenantSecret.secretName,
      projectRef: tenant.supabase_project_ref,
    })
  }

  const tenantClient = createTenantServiceClient(tenant.supabase_url, tenantSecret.key)
  let currentLookup = await getFirstDoctorContact(tenantClient)

  if (currentLookup.error) {
    const migrationResult = await runTenantDatabaseMigrations(context, {
      tenantId,
      stepId: null,
      projectRef: tenant.supabase_project_ref,
    })

    if (migrationResult.error) {
      return errorResponse('FIRST_DOCTOR_ADMIN_CONTACT_RPC_NOT_READY', 409, cors, {
        summary: 'Run tenant database update before changing doctor login.',
        setupError: migrationResult.error,
        setupSummary: migrationResult.summary,
      })
    }

    currentLookup = await getFirstDoctorContact(tenantClient)
  }

  if (currentLookup.error) {
    return errorResponse('FIRST_DOCTOR_ADMIN_CONTACT_RPC_NOT_READY', 409, cors, {
      summary: 'Run tenant database update before changing doctor login.',
    })
  }

  if (currentLookup.code || !currentLookup.contact) {
    return errorResponse(currentLookup.code || 'FIRST_DOCTOR_ADMIN_NOT_FOUND', currentLookup.code === 'FIRST_DOCTOR_ADMIN_NOT_FOUND' ? 404 : 409, cors, {
      summary: 'First doctor admin was not found in the tenant database.',
    })
  }

  const currentContact = currentLookup.contact
  const previousJob = job as ProvisioningJob
  const jobUpdate = await setProvisioningDoctorInput(context, job.id, email, displayName, phone)
  if (jobUpdate.error) return errorResponse('FIRST_DOCTOR_ADMIN_JOB_UPDATE_FAILED', 500, cors)

  const restoreProvisioningJob = async () => {
    if (!previousJob.first_doctor_email || !previousJob.first_doctor_display_name) return
    await setProvisioningDoctorInput(
      context,
      job.id,
      previousJob.first_doctor_email,
      previousJob.first_doctor_display_name,
      previousJob.first_doctor_phone,
    )
  }

  const authUpdate = await tenantClient.auth.admin.updateUserById(currentContact.authUserId, {
    email,
    email_confirm: true,
    user_metadata: {
      role: 'doctor',
      full_name: displayName,
    },
  })

  if (authUpdate.error) {
    await restoreProvisioningJob()
    return errorResponse('FIRST_DOCTOR_AUTH_UPDATE_FAILED', 409, cors, {
      summary: 'Tenant Auth rejected the doctor login update.',
      ...safeAuthErrorDetails(authUpdate.error),
      serviceSecretSource: tenantSecret.source,
      serviceSecretStorage: tenantSecret.secretStorage,
      serviceSecretRef: tenantSecret.secretRef,
    })
  }

  const { data: updatePayload, error: updateError } = await tenantClient.rpc('service_update_first_doctor_admin_contact', {
    p_auth_user_id: currentContact.authUserId,
    p_email: email,
    p_display_name: displayName,
    p_phone: phone,
  })
  const updateEnvelope = readRpcPayload(updatePayload)
  const updateCode = typeof updateEnvelope?.error === 'string' ? updateEnvelope.error : null

  if (updateError || updateCode) {
    await tenantClient.auth.admin.updateUserById(currentContact.authUserId, {
      email: currentContact.email,
      email_confirm: true,
      user_metadata: {
        role: 'doctor',
        full_name: currentContact.displayName,
      },
    })
    await restoreProvisioningJob()
    return errorResponse(updateCode || 'FIRST_DOCTOR_ADMIN_UPDATE_FAILED', 409, cors, {
      summary: 'Tenant doctor login could not be saved. Auth was restored.',
    })
  }

  return jsonResponse({
    data: {
      tenantId,
      slug: tenant.slug,
      firstDoctorAdmin: {
        email,
        displayName,
        phone,
      },
      otpLogin: {
        enabledByCode: true,
        deliveryDependsOnTenantEmailProvider: true,
      },
    },
    error: null,
  }, 200, cors)
})
