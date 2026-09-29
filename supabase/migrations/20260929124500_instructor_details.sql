alter table public.instructor_applications
  add column if not exists degree text not null default 'Not specified',
  add column if not exists subject text not null default 'Not specified';
