import { useCallback, useEffect, useRef, useState } from 'react';
import { templateService } from '../../services/templates.js';

/**
 * Hook for managing document templates — list, fetch, create, update, archive.
 * Wraps templateService and provides React state lifecycle.
 */
export function useTemplates({
  templateType = null,
  includeArchived = false,
  page = 1,
  pageSize = 25,
} = {}) {
  const [templates, setTemplates] = useState([]);
  const [pagination, setPagination] = useState({ page, pageSize, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keep latest prop values in refs so fetchAll always uses current params
  // without adding them to its dependency array (avoids unnecessary recreation).
  const paramsRef = useRef({ templateType, includeArchived, page, pageSize });
  useEffect(() => {
    paramsRef.current = { templateType, includeArchived, page, pageSize };
  }, [templateType, includeArchived, page, pageSize]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { templateType: tt, includeArchived: ia, page: p, pageSize: ps } = paramsRef.current;
    const result = await templateService.getAll({
      templateType: tt,
      includeArchived: ia,
      page: p,
      pageSize: ps,
    });
    if (result.error) {
      setError(result.error);
      setTemplates([]);
    } else {
      setTemplates(result.data);
      setPagination(result.meta.pagination);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const result = await templateService.getAll({
        templateType,
        includeArchived,
        page,
        pageSize,
      });
      if (!isMounted) return;
      if (result.error) {
        setError(result.error);
        setTemplates([]);
      } else {
        setTemplates(result.data);
        setPagination(result.meta.pagination);
        setError('');
      }
      setLoading(false);
    }

    void load();

    return () => { isMounted = false; };
  }, [templateType, includeArchived, page, pageSize]);

  const getById = useCallback(async (id) => {
    return templateService.getById(id);
  }, []);

  const create = useCallback(async (payload) => {
    return templateService.create(payload);
  }, []);

  const update = useCallback(async (id, payload) => {
    return templateService.update(id, payload);
  }, []);

  const archive = useCallback(async (id, archivedBy) => {
    return templateService.archive(id, archivedBy);
  }, []);

  return {
    templates,
    pagination,
    loading,
    error,
    fetchAll,
    getById,
    create,
    update,
    archive,
  };
}