import { groupPatientTimelineItems, normalizePatientTimelineDocuments } from '../lib/patientTimeline.js';
import { documentService } from './documents.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

export const patientTimelineService = {
  async getTimeline({ patientId, pageSize = 50 } = {}) {
    if (!patientId) {
      return { data: null, error: 'Patient identity is required.' };
    }

    const documentsResult = await documentService.getByPatientId(patientId, {
      status: 'final',
      includeArchived: false,
      pageSize,
    });

    if (documentsResult.error) {
      return {
        data: null,
        error: getErrorMessage(documentsResult.error, 'Unable to load care timeline.'),
      };
    }

    const items = normalizePatientTimelineDocuments(documentsResult.data || []);
    return {
      data: {
        items,
        groups: groupPatientTimelineItems(items),
        summary: {
          documentCount: items.length,
        },
      },
      error: null,
    };
  },
};
