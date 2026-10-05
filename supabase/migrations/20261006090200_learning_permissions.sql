-- Supabase may grant default table privileges when tables are created.
-- Give browser roles only the read privileges required by the learning UI.
revoke all on public.learning_courses from anon, authenticated;
revoke all on public.lesson_completions from anon, authenticated;
revoke all on public.learning_certificates from anon, authenticated;
revoke all on public.enrollments from anon, authenticated;
grant select on public.learning_courses to anon, authenticated;
grant select on public.lesson_completions, public.learning_certificates, public.enrollments to authenticated;
