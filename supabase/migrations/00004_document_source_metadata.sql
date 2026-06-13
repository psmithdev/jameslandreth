-- Track original source files for document previews.

alter table documents
  add column if not exists source_file_path text,
  add column if not exists source_file_type text,
  add column if not exists source_file_size bigint,
  add column if not exists source_modified_at timestamptz,
  add column if not exists content_hash text;

create index if not exists idx_documents_content_hash on documents(content_hash);
