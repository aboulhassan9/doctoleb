import { supabase } from '../lib/supabase.js';
import { apiCall, apiPaged } from './api.js';
import {
  BLOOD_GROUP_SELECT_FIELDS,
  CITY_SELECT_FIELDS,
  DISEASE_SELECT_FIELDS,
  FAMILY_RELATION_SELECT_FIELDS,
  OCCUPATION_SELECT_FIELDS,
  SPECIALTY_SELECT_FIELDS,
  SURGERY_TYPE_SELECT_FIELDS,
  VACCINE_SELECT_FIELDS,
  VISIT_TYPE_SELECT_FIELDS,
} from '../lib/selects.js';
import { catalogEntrySchema } from '../schemas/index.js';
import { validationError, parse } from '../lib/serviceHelpers.js';

const CATALOGS = {
  cities: CITY_SELECT_FIELDS,
  blood_groups: BLOOD_GROUP_SELECT_FIELDS,
  occupations: OCCUPATION_SELECT_FIELDS,
  specialties: SPECIALTY_SELECT_FIELDS,
  vaccines: VACCINE_SELECT_FIELDS,
  diseases: DISEASE_SELECT_FIELDS,
  surgery_types: SURGERY_TYPE_SELECT_FIELDS,
  family_relations: FAMILY_RELATION_SELECT_FIELDS,
  visit_types: VISIT_TYPE_SELECT_FIELDS,
};

function getCatalogFields(table) {
  const fields = CATALOGS[table];
  if (!fields) {
    throw new Error(`Unsupported catalog: ${table}`);
  }
  return fields;
}

export const catalogService = {
  getSupportedCatalogs() {
    return Object.keys(CATALOGS);
  },

  async getAll(table, { activeOnly = true, page = 1, pageSize = 100 } = {}) {
    const fields = getCatalogFields(table);
    let query = supabase.from(table).select(fields, { count: 'exact' }).order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getByCode(table, code) {
    const fields = getCatalogFields(table);
    return apiCall(
      supabase
        .from(table)
        .select(fields)
        .eq('code', code)
        .maybeSingle()
    );
  },

  async create(table, payload) {
    const fields = getCatalogFields(table);
    const parsed = parse(catalogEntrySchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(table)
        .insert([parsed.data])
        .select(fields)
        .single()
    );
  },

  async update(table, id, payload) {
    const fields = getCatalogFields(table);
    const parsed = parse(catalogEntrySchema.partial(), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(table)
        .update(parsed.data)
        .eq('id', id)
        .select(fields)
        .single()
    );
  },
};
