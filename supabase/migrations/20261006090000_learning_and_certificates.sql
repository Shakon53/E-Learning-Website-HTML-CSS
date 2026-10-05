-- Progress is awarded by checked lesson submissions, not by browser updates.
create schema if not exists learning_private;
revoke all on schema learning_private from public, anon, authenticated;

create table public.learning_courses (
  id text primary key,
  title text not null,
  image text not null,
  content jsonb not null
);
alter table public.learning_courses enable row level security;
create policy "Published courses are readable" on public.learning_courses for select to anon, authenticated using (true);
grant select on public.learning_courses to anon, authenticated;

create table learning_private.answer_keys (
  course_id text primary key references public.learning_courses(id),
  lesson_answers jsonb not null,
  exam_answers jsonb not null
);
create table public.lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.learning_courses(id),
  lesson_index integer not null check (lesson_index >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_index),
  foreign key (user_id, course_id) references public.enrollments(user_id, course_id) on delete cascade
);
alter table public.lesson_completions enable row level security;
create policy "Read own completed lessons" on public.lesson_completions for select to authenticated using (user_id=(select auth.uid()));
grant select on public.lesson_completions to authenticated;

create table public.learning_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.learning_courses(id),
  learner_name text not null,
  course_title jsonb not null,
  issued_at timestamptz not null default now(),
  score integer not null check (score between 80 and 100),
  unique (user_id, course_id)
);
alter table public.learning_certificates enable row level security;
create policy "Read own certificates" on public.learning_certificates for select to authenticated using (user_id=(select auth.uid()));
grant select on public.learning_certificates to authenticated;

-- Preserve existing enrollments, but do not treat former click-based progress as learning.
update public.enrollments set progress=0;
revoke insert, update on public.enrollments from authenticated;
drop policy if exists "Users can enroll themselves" on public.enrollments;
drop policy if exists "Users can update own progress" on public.enrollments;

create function public.enroll_learning_course(p_course_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_course public.learning_courses;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_course from public.learning_courses where id=p_course_id;
  if not found then raise exception 'Course not found'; end if;
  insert into public.enrollments(user_id,course_id,course_title,course_image)
  values(v_user,p_course_id,v_course.title,v_course.image)
  on conflict(user_id,course_id) do nothing;
end $$;

create function public.submit_learning_lesson(p_course_id text,p_lesson_index integer,p_answers integer[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_content jsonb; v_keys jsonb; v_count integer;
  v_total integer; v_progress integer; v_i integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform 1 from public.enrollments where user_id=v_user and course_id=p_course_id for update;
  if not found then raise exception 'Enrollment required'; end if;
  select content into v_content from public.learning_courses where id=p_course_id;
  if not found then raise exception 'Course not found'; end if;
  v_total := jsonb_array_length(v_content->'lessons');
  if p_lesson_index is null or p_lesson_index < 0 or p_lesson_index >= v_total then raise exception 'Lesson not found'; end if;
  select count(*) into v_count from public.lesson_completions where user_id=v_user and course_id=p_course_id;
  if p_lesson_index > v_count then raise exception 'Complete previous lessons first'; end if;
  select lesson_answers->p_lesson_index into v_keys from learning_private.answer_keys where course_id=p_course_id;
  if p_answers is null or cardinality(p_answers)<>jsonb_array_length(v_keys) then raise exception 'Answer all questions'; end if;
  for v_i in 0..jsonb_array_length(v_keys)-1 loop
    if p_answers[v_i+1] is distinct from (v_keys->>v_i)::integer then
      return jsonb_build_object('passed',false,'progress',round(80.0*v_count/v_total));
    end if;
  end loop;
  insert into public.lesson_completions(user_id,course_id,lesson_index) values(v_user,p_course_id,p_lesson_index) on conflict do nothing;
  select count(*) into v_count from public.lesson_completions where user_id=v_user and course_id=p_course_id;
  v_progress := round(80.0*v_count/v_total);
  if exists(select 1 from public.learning_certificates where user_id=v_user and course_id=p_course_id) then v_progress:=100; end if;
  update public.enrollments set progress=v_progress where user_id=v_user and course_id=p_course_id;
  return jsonb_build_object('passed',true,'progress',v_progress);
end $$;

create function public.submit_learning_exam(p_course_id text,p_answers integer[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_content jsonb; v_keys jsonb; v_count integer; v_correct integer := 0;
  v_score integer; v_i integer; v_certificate uuid; v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform 1 from public.enrollments where user_id=v_user and course_id=p_course_id for update;
  if not found then raise exception 'Enrollment required'; end if;
  select content into v_content from public.learning_courses where id=p_course_id;
  if not found then raise exception 'Course not found'; end if;
  select count(*) into v_count from public.lesson_completions where user_id=v_user and course_id=p_course_id;
  if v_count<>jsonb_array_length(v_content->'lessons') then raise exception 'Complete all lessons first'; end if;
  select exam_answers into v_keys from learning_private.answer_keys where course_id=p_course_id;
  if p_answers is null or cardinality(p_answers)<>jsonb_array_length(v_keys) then raise exception 'Answer all questions'; end if;
  for v_i in 0..jsonb_array_length(v_keys)-1 loop
    if p_answers[v_i+1]=(v_keys->>v_i)::integer then v_correct:=v_correct+1; end if;
  end loop;
  v_score := round(100.0*v_correct/jsonb_array_length(v_keys));
  if v_score<80 then return jsonb_build_object('passed',false,'score',v_score); end if;
  select coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),'Learner') into v_name from auth.users where id=v_user;
  insert into public.learning_certificates(user_id,course_id,learner_name,course_title,score)
  values(v_user,p_course_id,left(v_name,160),v_content->'title',v_score)
  on conflict(user_id,course_id) do nothing;
  select id into v_certificate from public.learning_certificates where user_id=v_user and course_id=p_course_id;
  update public.enrollments set progress=100 where user_id=v_user and course_id=p_course_id;
  return jsonb_build_object('passed',true,'score',v_score,'certificate_id',v_certificate);
end $$;

-- A shared certificate URL exposes only the displayed certificate, never contact details.
create function public.verify_learning_certificate(p_certificate_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',id,'learner_name',learner_name,'course_title',course_title,'issued_at',issued_at,'score',score)
  from public.learning_certificates where id=p_certificate_id;
$$;
revoke all on function public.enroll_learning_course(text) from public, anon;
revoke all on function public.submit_learning_lesson(text,integer,integer[]) from public, anon;
revoke all on function public.submit_learning_exam(text,integer[]) from public, anon;
revoke all on function public.verify_learning_certificate(uuid) from public;
grant execute on function public.enroll_learning_course(text) to authenticated;
grant execute on function public.submit_learning_lesson(text,integer,integer[]) to authenticated;
grant execute on function public.submit_learning_exam(text,integer[]) to authenticated;
grant execute on function public.verify_learning_certificate(uuid) to anon,authenticated;
