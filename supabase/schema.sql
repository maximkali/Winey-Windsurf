create table if not exists public.games (
  game_code text primary key,
  host_uid text not null,
  status text not null check (status in ('setup','lobby','in_progress','finished')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  current_round integer not null default 1,
  total_rounds integer not null default 3,
  players integer,
  bottles integer,
  bottles_per_round integer,
  bottle_eq_per_person double precision,
  oz_per_person_per_bottle double precision
);

alter table public.games add column if not exists players integer;
alter table public.games add column if not exists bottles integer;
alter table public.games add column if not exists bottles_per_round integer;
alter table public.games add column if not exists bottle_eq_per_person double precision;
alter table public.games add column if not exists oz_per_person_per_bottle double precision;

create table if not exists public.players (
  game_code text not null references public.games(game_code) on delete cascade,
  uid text not null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (game_code, uid)
);

create table if not exists public.rounds (
  game_code text not null references public.games(game_code) on delete cascade,
  round_id integer not null,
  state text not null check (state in ('open','closed')),
  primary key (game_code, round_id)
);

create table if not exists public.round_submissions (
  game_code text not null,
  round_id integer not null,
  uid text not null,
  notes text not null default '',
  ranking jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  primary key (game_code, round_id, uid),
  foreign key (game_code, round_id) references public.rounds(game_code, round_id) on delete cascade,
  foreign key (game_code, uid) references public.players(game_code, uid) on delete cascade
);

create table if not exists public.wines (
  game_code text not null references public.games(game_code) on delete cascade,
  wine_id text not null,
  letter text not null,
  label_blinded text not null default '',
  nickname text not null default '',
  price numeric,
  created_at timestamptz not null default now(),
  primary key (game_code, wine_id)
);

create table if not exists public.round_wines (
  game_code text not null,
  round_id integer not null,
  wine_id text not null,
  position integer,
  primary key (game_code, round_id, wine_id),
  foreign key (game_code, round_id) references public.rounds(game_code, round_id) on delete cascade,
  foreign key (game_code, wine_id) references public.wines(game_code, wine_id) on delete cascade
);

create index if not exists idx_wines_game on public.wines(game_code);
create index if not exists idx_round_wines_game_round on public.round_wines(game_code, round_id);
create index if not exists idx_round_wines_game_wine on public.round_wines(game_code, wine_id);

create index if not exists idx_players_game on public.players(game_code);
create index if not exists idx_rounds_game on public.rounds(game_code);
create index if not exists idx_submissions_game on public.round_submissions(game_code);
create index if not exists idx_submissions_round on public.round_submissions(game_code, round_id);
