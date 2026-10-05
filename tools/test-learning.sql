-- Transactional backend checks. Test users, enrollments and certificates are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data)
values ('a1111111-1111-4111-8111-111111111111','learning-sql-test@example.invalid','{"name":"Learning test"}'),
       ('a2222222-2222-4222-8222-222222222222','learning-sql-other@example.invalid','{}');
create temporary table test_keys as select * from learning_private.answer_keys;
grant select on test_keys to authenticated;
set local request.jwt.claim.sub='a1111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$
declare c record; result jsonb; answer integer[]; exam integer[]; wrong integer[]; i integer; certificate uuid; second uuid;
begin
  if has_table_privilege('authenticated','public.enrollments','UPDATE') then raise exception 'Browser can still forge progress'; end if;
  if has_table_privilege('authenticated','public.learning_certificates','INSERT') then raise exception 'Browser can issue certificates directly'; end if;
  for c in select * from test_keys loop
    perform public.enroll_learning_course(c.course_id);
    perform public.enroll_learning_course(c.course_id);
    if (select count(*) from public.enrollments where course_id=c.course_id)<>1 then raise exception 'Duplicate enrollment'; end if;
    begin
      perform public.submit_learning_lesson(c.course_id,1,array[-1]);
      raise exception 'Skipped lesson accepted';
    exception when raise_exception then
      if sqlerrm<>'Complete previous lessons first' then raise; end if;
    end;
    begin
      perform public.submit_learning_exam(c.course_id,array[-1,-1,-1,-1,-1]);
      raise exception 'Early final test accepted';
    exception when raise_exception then
      if sqlerrm<>'Complete all lessons first' then raise; end if;
    end;
    result:=public.submit_learning_lesson(c.course_id,0,array[-1]);
    if (result->>'passed')::boolean or (select progress from public.enrollments where course_id=c.course_id)<>0 then raise exception 'Incorrect lesson awarded progress'; end if;
    for i in 0..jsonb_array_length(c.lesson_answers)-1 loop
      select array_agg(value::integer) into answer from jsonb_array_elements_text(c.lesson_answers->i);
      result:=public.submit_learning_lesson(c.course_id,i,answer);
      if not (result->>'passed')::boolean then raise exception 'Correct lesson rejected'; end if;
      perform public.submit_learning_lesson(c.course_id,i,answer);
    end loop;
    if (select progress from public.enrollments where course_id=c.course_id)<>80 then raise exception 'Lessons should award 80 percent'; end if;
    select array_agg(value::integer) into exam from jsonb_array_elements_text(c.exam_answers);
    wrong:=array_fill(-1,array[cardinality(exam)]);
    result:=public.submit_learning_exam(c.course_id,wrong);
    if (result->>'passed')::boolean or (select count(*) from public.learning_certificates where course_id=c.course_id)<>0 then raise exception 'Failed final test issued certificate'; end if;
    -- Four correct answers must be enough; five must also pass without reissuing.
    answer:=exam;answer[5]:=-1;
    result:=public.submit_learning_exam(c.course_id,answer);
    if not (result->>'passed')::boolean or (result->>'score')::integer<>80 then raise exception '80 percent pass rejected'; end if;
    certificate:=(result->>'certificate_id')::uuid;
    result:=public.submit_learning_exam(c.course_id,exam);
    second:=(result->>'certificate_id')::uuid;
    if certificate<>second then raise exception 'Certificate was reissued'; end if;
    if (select progress from public.enrollments where course_id=c.course_id)<>100 then raise exception 'Final test did not complete course'; end if;
    select array_agg(value::integer) into answer from jsonb_array_elements_text(c.lesson_answers->0);
    perform public.submit_learning_lesson(c.course_id,0,answer);
    if (select progress from public.enrollments where course_id=c.course_id)<>100 then raise exception 'Review lowered completed progress'; end if;
    result:=public.verify_learning_certificate(certificate);
    if result is null or result ? 'user_id' or result ? 'email' then raise exception 'Verification leaks personal account details'; end if;
  end loop;
  if (select count(*) from public.learning_certificates)<>12 then raise exception 'Expected 12 certificates'; end if;
end $$;
set local request.jwt.claim.sub='a2222222-2222-4222-8222-222222222222';
do $$ begin
  if exists(select 1 from public.enrollments) or exists(select 1 from public.lesson_completions) or exists(select 1 from public.learning_certificates) then raise exception 'Cross-user data access'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if not has_function_privilege('anon','public.verify_learning_certificate(uuid)','EXECUTE') then raise exception 'Public certificate verification is unavailable'; end if;
  if has_function_privilege('anon','public.submit_learning_exam(text,integer[])','EXECUTE') then raise exception 'Anonymous final submission allowed'; end if;
end $$;
select 'Passed: 12 courses, ordered checkpoints, incorrect answers, 80% threshold, stable certificates, progress integrity, account isolation.' as test_result;
rollback;
