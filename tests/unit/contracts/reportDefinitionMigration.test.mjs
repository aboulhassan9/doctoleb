import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  'supabase/migrations/20260515170000_report_definition_versions.sql'
);

describe('report-definition migration contract', () => {
  it('creates the versioned report tables needed by R1-R4', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    for (const table of [
      'document_template_versions',
      'document_template_assets',
      'document_render_jobs',
      'document_render_artifacts',
    ]) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    }
  });

  it('keeps report definitions structured and renderer profiles explicit', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /authoring_mode text not null/);
    assert.match(sql, /render_profile text not null/);
    assert.match(sql, /definition jsonb not null/);
    assert.match(sql, /definition_checksum text not null/);
    assert.match(sql, /check \(render_profile in \('edge_pdf_lib','gotenberg_html'\)\)/);
  });

  it('freezes published report definitions so old PDFs stay reproducible', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /create or replace function public\.guard_document_template_version_immutability/);
    assert.match(sql, /OLD\.status in \('published','superseded','archived'\)/);
    assert.match(sql, /NEW\.definition is distinct from OLD\.definition/);
    assert.match(sql, /NEW\.definition_checksum is distinct from OLD\.definition_checksum/);
    assert.match(sql, /document_template_versions_immutability_guard/);
  });

  it('keeps report-version actor fields tied to the authenticated user in browser RLS', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /created_by = \(select current_domain_user_id\(\)\)/);
    assert.match(sql, /published_by is null or published_by = \(select current_domain_user_id\(\)\)/);
  });

  it('allows browser render jobs only for visible clinical documents and current published versions', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /document_render_jobs_doctor_insert/);
    assert.match(sql, /requested_by = \(select current_domain_user_id\(\)\)/);
    assert.match(sql, /from public\.clinical_documents as cd/);
    assert.match(sql, /cd\.id = public\.document_render_jobs\.clinical_document_id/);
    assert.match(sql, /from public\.document_template_versions as version/);
    assert.match(sql, /version\.id = public\.document_render_jobs\.template_version_id/);
    assert.match(sql, /version\.status = 'published'/);
    assert.match(sql, /version\.is_current = true/);
    assert.match(sql, /version\.render_profile = public\.document_render_jobs\.render_profile/);
  });

  it('requires current report versions to be published at the DB boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /constraint document_template_versions_current_status_check/);
    assert.match(sql, /status = 'published' or is_current = false/);
  });

  it('protects Arabic templates from the baseline renderer at the DB boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /locale <> 'ar-LB'/);
    assert.match(sql, /render_profile = 'gotenberg_html'/);
  });

  it('enforces safe template asset metadata at the DB boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /asset_type in \('logo','stamp','signature','background'\)/);
    assert.match(sql, /content_type in \('image\/png','image\/jpeg','image\/svg\+xml'\)/);
    assert.match(sql, /byte_size <= 2097152/);
    assert.match(sql, /scan_status text not null default 'passed'/);
    assert.match(sql, /image_width_px integer not null/);
    assert.match(sql, /image_height_px integer not null/);
    assert.match(sql, /position\(chr\(92\) in storage_path\) = 0/);
  });

  it('keeps render artifact storage refs tenant-local instead of remote or traversable paths', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /document_render_artifacts/);
    assert.match(sql, /storage_path not like '\/%'/);
    assert.match(sql, /storage_path not like '%\.\.%'/);
    assert.match(sql, /storage_path not like '%:\/\/%'/);
    assert.match(sql, /position\(chr\(92\) in storage_path\) = 0/);
  });
});
