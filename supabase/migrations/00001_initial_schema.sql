-- ============================================
-- James Landreth Full-Stack: Initial Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- Enums
-- ============================================

create type user_role as enum ('admin', 'family', 'public');
create type document_status as enum ('published', 'draft', 'archived');
create type artifact_status as enum ('available', 'claimed', 'gifted');
create type target_type as enum ('document', 'artifact');

-- ============================================
-- Profiles
-- ============================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role user_role not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- Documents (jameslandreth.com)
-- ============================================

create table documents (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  category text not null,
  excerpt text,
  date text,
  year integer,
  location text,
  tags text[] default '{}',
  pages text,
  file_type text default 'PDF',
  file_path text,
  thumbnail_path text,
  featured boolean not null default false,
  status document_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_slug on documents(slug);
create index idx_documents_category on documents(category);
create index idx_documents_status on documents(status);
create index idx_documents_year on documents(year);

-- ============================================
-- Artifacts (artifacts.jameslandreth.com)
-- ============================================

create table artifacts (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  category text not null,
  family text,
  description text,
  provenance text,
  estimated_value text,
  status artifact_status not null default 'available',
  images text[] default '{}',
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_artifacts_slug on artifacts(slug);
create index idx_artifacts_category on artifacts(category);
create index idx_artifacts_status on artifacts(status);
create index idx_artifacts_family on artifacts(family);

-- ============================================
-- Comments
-- ============================================

create table comments (
  id uuid primary key default uuid_generate_v4(),
  target_type target_type not null,
  target_id uuid not null,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_target on comments(target_type, target_id);
create index idx_comments_author on comments(author_id);

-- ============================================
-- Updated_at trigger
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on documents
  for each row execute function update_updated_at();

create trigger set_updated_at before update on artifacts
  for each row execute function update_updated_at();

create trigger set_updated_at before update on comments
  for each row execute function update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

alter table profiles enable row level security;
alter table documents enable row level security;
alter table artifacts enable row level security;
alter table comments enable row level security;

-- Profiles: users can read all profiles, update only their own
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Documents: published docs are public, drafts/archived need admin
create policy "Published documents are viewable by everyone"
  on documents for select using (status = 'published');

create policy "Admins can view all documents"
  on documents for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert documents"
  on documents for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update documents"
  on documents for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete documents"
  on documents for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Artifacts: all artifacts are viewable, only admins can modify
create policy "Artifacts are viewable by everyone"
  on artifacts for select using (true);

create policy "Admins can insert artifacts"
  on artifacts for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update artifacts"
  on artifacts for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Family members can claim available artifacts
create policy "Family can claim artifacts"
  on artifacts for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'family'))
  );

create policy "Admins can delete artifacts"
  on artifacts for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Comments: viewable by all authenticated, writable by family+admin
create policy "Comments are viewable by authenticated users"
  on comments for select using (auth.uid() is not null);

create policy "Family and admin can create comments"
  on comments for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'family'))
  );

create policy "Users can update own comments"
  on comments for update using (author_id = auth.uid());

create policy "Users can delete own comments"
  on comments for delete using (author_id = auth.uid());

create policy "Admins can delete any comment"
  on comments for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================
-- Storage Buckets (apply via Supabase Dashboard or API)
-- ============================================
-- Note: Storage buckets must be created via Supabase Dashboard or API.
-- Required buckets:
--   - documents (public read for published, admin write)
--   - thumbnails (public read, admin write)
--   - artifacts (public read, admin write)
--   - avatars (public read, authenticated write for own avatar)
