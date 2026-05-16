import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  DOCUMENT_TEMPLATE_ASSET_SELECT_FIELDS,
  DOCUMENT_RENDER_JOB_SELECT_FIELDS,
  DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  reportDefinitionSchema,
  reportRenderJobCreateSchema,
  reportTemplateAssetCreateSchema,
  reportTemplateVersionCreateSchema,
  REPORT_BINDINGS,
} from '../schemas/reportDefinitions.js';
import { templateSectionSchema } from '../schemas/documentTemplates.js';
import { apiCall, apiPaged } from './api.js';

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

  return `{${entries.join(',')}}`;
};

const bytesToHex = (buffer) => [...new Uint8Array(buffer)]
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const DEFAULT_REPORT_THEME = {
  fontFamily: 'noto_sans',
  primaryColor: '#0f172a',
  accentColor: '#38bdf8',
};

const LEGACY_FIELD_TYPE_TO_REPORT_FIELD_TYPE = {
  text: 'text',
  textarea: 'textarea',
  date: 'date',
  select: 'select',
  checkbox: 'checkbox',
  checkbox_grid: 'checkbox_grid',
  static_text: 'static_text',
};

const toLocalizedText = (text, locale = 'en') => ({
  [locale]: String(text || '').trim(),
});

const mapLegacyField = (field, locale) => {
  const type = LEGACY_FIELD_TYPE_TO_REPORT_FIELD_TYPE[field.type];
  if (!type) return null;

  const mapped = {
    key: field.key,
    label: toLocalizedText(field.label, locale),
    type,
    required: field.required ?? false,
  };

  if (field.autofill) mapped.binding = field.autofill;
  if (field.content) mapped.content = field.content;
  if (Array.isArray(field.options)) {
    mapped.options = field.options.map((option) => toLocalizedText(option, locale));
  }
  if (Array.isArray(field.groups)) {
    mapped.groups = field.groups.map((group) => ({
      label: toLocalizedText(group.label, locale),
      items: group.items.map((item) => toLocalizedText(item, locale)),
    }));
  }

  return mapped;
};

export function createReportDefinitionFromLegacyTemplate(template, {
  locale = 'en',
  direction = locale === 'ar-LB' ? 'rtl' : 'ltr',
  renderProfile = locale === 'ar-LB' ? 'gotenberg_html' : 'edge_pdf_lib',
  theme = DEFAULT_REPORT_THEME,
} = {}) {
  if (!template?.sections) return validationError('Legacy template sections are required.');

  const sections = [];
  for (const section of template.sections) {
    const parsedSection = parse(templateSectionSchema, section);
    if (parsedSection.error) return validationError(parsedSection.error);
    sections.push(parsedSection.data);
  }

  const blocks = [];
  for (const section of sections) {
    const fields = section.fields
      .filter((field) => field.type !== 'signature')
      .map((field) => mapLegacyField(field, locale))
      .filter(Boolean);

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        key: section.key,
        title: toLocalizedText(section.title, locale),
        fields,
      });
    }

    if (section.fields.some((field) => field.type === 'signature')) {
      blocks.push({ type: 'signature', signer: 'doctor' });
    }
  }

  const definition = {
    schemaVersion: '2',
    authoringMode: 'flow_document',
    renderProfile,
    locale,
    direction,
    page: { size: 'A4', orientation: 'portrait' },
    theme,
    blocks,
  };

  const parsedDefinition = parse(reportDefinitionSchema, definition);
  if (parsedDefinition.error) return validationError(parsedDefinition.error);

  const unknownBinding = blocks
    .flatMap((block) => block.type === 'section' ? block.fields : [])
    .find((field) => field.binding && !REPORT_BINDINGS.includes(field.binding));

  if (unknownBinding) {
    return validationError(`Unsupported legacy autofill binding: ${unknownBinding.binding}`);
  }

  return { data: parsedDefinition.data, error: null };
}

export async function createReportDefinitionChecksum(definition) {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) {
    throw new Error('Web Crypto SHA-256 is required to checksum report definitions.');
  }

  const encoded = new TextEncoder().encode(stableStringify(definition));
  return bytesToHex(await cryptoApi.digest('SHA-256', encoded));
}

async function buildVersionInsertPayload(payload) {
  const parsedDefinition = parse(reportDefinitionSchema, payload?.definition);
  if (parsedDefinition.error) return validationError(parsedDefinition.error);

  let definitionChecksum;
  try {
    definitionChecksum = await createReportDefinitionChecksum(parsedDefinition.data);
  } catch (error) {
    return validationError(error?.message || 'Report definition checksum failed.');
  }

  if (payload.definition_checksum && payload.definition_checksum !== definitionChecksum) {
    return validationError('Report definition checksum does not match the canonical definition.');
  }

  const parsedVersion = parse(reportTemplateVersionCreateSchema, {
    ...payload,
    definition: parsedDefinition.data,
    definition_checksum: definitionChecksum,
  });
  if (parsedVersion.error) return validationError(parsedVersion.error);

  const { definition, ...base } = parsedVersion.data;
  return {
    data: {
      ...base,
      schema_version: definition.schemaVersion,
      authoring_mode: definition.authoringMode,
      render_profile: definition.renderProfile,
      locale: definition.locale,
      direction: definition.direction,
      definition,
      published_at: parsedVersion.data.status === 'published'
        ? new Date().toISOString()
        : null,
    },
    error: null,
  };
}

export const reportDefinitionService = {
  async createVersion(payload) {
    const insertPayload = await buildVersionInsertPayload(payload);
    if (insertPayload.error) return insertPayload;

    return apiCall(
      supabase
        .from('document_template_versions')
        .insert([insertPayload.data])
        .select(DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS)
        .single()
    );
  },

  async createVersionFromLegacyTemplate(template, {
    createdBy,
    versionNumber = 1,
    status = 'draft',
    publishedBy = null,
    locale = 'en',
  } = {}) {
    if (!template?.id) return validationError('Template ID is required.');
    if (!createdBy) return validationError('createdBy is required.');

    const converted = createReportDefinitionFromLegacyTemplate(template, { locale });
    if (converted.error) return converted;

    return reportDefinitionService.createVersion({
      template_id: template.id,
      version_number: versionNumber,
      status,
      is_current: status === 'published',
      definition: converted.data,
      created_by: createdBy,
      published_by: publishedBy,
    });
  },

  async listVersions(templateId, {
    locale = null,
    includeArchived = false,
    page = 1,
    pageSize = 25,
  } = {}) {
    if (!templateId) return validationError('Template ID is required.');

    let query = supabase
      .from('document_template_versions')
      .select(DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS, { count: 'exact' })
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });

    if (locale) query = query.eq('locale', locale);
    if (!includeArchived) query = query.neq('status', 'archived');

    return apiPaged(query, { page, pageSize });
  },

  async getCurrentVersion(templateId, { locale = 'en' } = {}) {
    if (!templateId) return validationError('Template ID is required.');

    return apiCall(
      supabase
        .from('document_template_versions')
        .select(DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS)
        .eq('template_id', templateId)
        .eq('locale', locale)
        .eq('status', 'published')
        .eq('is_current', true)
        .maybeSingle()
    );
  },

  async createRenderJob(payload) {
    const parsed = parse(reportRenderJobCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('document_render_jobs')
        .insert([{ ...parsed.data, status: 'queued' }])
        .select(DOCUMENT_RENDER_JOB_SELECT_FIELDS)
        .single()
    );
  },

  async createAsset(payload) {
    const parsed = parse(reportTemplateAssetCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('document_template_assets')
        .insert([parsed.data])
        .select(DOCUMENT_TEMPLATE_ASSET_SELECT_FIELDS)
        .single()
    );
  },
};
