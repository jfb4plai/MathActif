-- math_adaptations — MathActif
-- NE PAS recréer profiles ni updated_at trigger (déjà dans le projet partagé)

create table if not exists math_adaptations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  document_original  text,
  au_texte           text,
  conseils_ia        text,
  texte_final        text,
  profils            text[],
  niveau             text,
  type_enseignement  text,
  chapitre           text,
  objectif           text,
  feedback           text,
  created_at         timestamptz default now()
);

-- RLS
alter table math_adaptations enable row level security;

create policy "user owns rows"
  on math_adaptations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
