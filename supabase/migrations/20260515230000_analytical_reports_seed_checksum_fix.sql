-- Fix seed report checksums: replace MD5-padded values with real SHA-256.
--
-- The JS service's createReportDefinitionChecksum uses Web Crypto SHA-256,
-- which produces a genuine 64-char hex digest. The original seed migration
-- used lpad(md5(v_definition::text), 64, '0') — a 32-char MD5 hash
-- zero-padded to 64 chars. The two will never match if compared, breaking
-- definition-change detection.
--
-- This migration recalculates all seed (is_default=true) version checksums
-- using PostgreSQL's encode(digest(..., 'sha256'), 'hex') so they align
-- with the JS contract. Non-seed reports are untouched — they were created
-- through the service which already uses SHA-256.

UPDATE public.analytical_report_versions
SET definition_checksum = encode(digest(definition::text, 'sha256'), 'hex')
WHERE report_id IN (
  SELECT id FROM public.analytical_reports WHERE is_default = true
);