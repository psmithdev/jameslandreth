-- ============================================
-- Family Trees (jameslandreth.com /family-tree)
-- ============================================
-- One JSONB row per tree. `data` holds the exact object the client-side
-- renderer consumes: { label, legendFamilies, people, structure }.
-- Relationships are positional inside `structure`, so the whole tree is
-- stored as a single document rather than normalized tables.

create table family_trees (
  id uuid primary key default uuid_generate_v4(),
  tree_key text unique not null,
  label text not null,
  sort_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_family_trees_tree_key on family_trees(tree_key);
create index idx_family_trees_sort_order on family_trees(sort_order);

create trigger set_updated_at before update on family_trees
  for each row execute function update_updated_at();

-- ============================================
-- Row Level Security (mirrors documents: public read, admin write)
-- ============================================

alter table family_trees enable row level security;

create policy "Family trees are viewable by everyone"
  on family_trees for select using (true);

create policy "Admins can insert family trees"
  on family_trees for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update family trees"
  on family_trees for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete family trees"
  on family_trees for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
