-- Run once in your existing project's Supabase SQL Editor.
-- Uses your existing app_users and face_templates tables; does not recreate them.
begin;

create or replace function public.register_face_user(
  p_email text,
  p_embeddings jsonb,
  p_model_version text
)
returns table (id uuid, email text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_user public.app_users%rowtype;
  sample jsonb;
  sample_index integer := 0;
begin
  if p_email is null or length(btrim(p_email)) = 0 or length(p_email) > 254 then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if jsonb_typeof(p_embeddings) is distinct from 'array' then
    raise exception 'Expected three embeddings' using errcode = '22023';
  end if;
  if jsonb_array_length(p_embeddings) <> 3 then
    raise exception 'Expected three embeddings' using errcode = '22023';
  end if;
  if p_model_version is distinct from '3.3.6/faceres' then
    raise exception 'Unsupported model version' using errcode = '22023';
  end if;

  -- The existing lower(email) unique index also handles concurrent registration.
  insert into public.app_users (email)
  values (lower(btrim(p_email))) returning * into new_user;

  for sample in select value from jsonb_array_elements(p_embeddings)
  loop
    if jsonb_typeof(sample) is distinct from 'array' then
      raise exception 'Invalid embedding' using errcode = '22023';
    end if;
    if jsonb_array_length(sample) <> 1024 then
      raise exception 'Invalid embedding size' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(sample) as item(value)
               where jsonb_typeof(item.value) <> 'number') then
      raise exception 'Embedding must contain numbers' using errcode = '22023';
    end if;
    sample_index := sample_index + 1;
    insert into public.face_templates (user_id, embedding, sample_number, model_name, model_version)
    values (new_user.id, (sample::text)::extensions.vector(1024), sample_index,
            'human-faceres', p_model_version);
  end loop;
  return query select new_user.id, new_user.email;
end;
$$;

revoke all on function public.register_face_user(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.register_face_user(text, jsonb, text) to service_role;
grant usage on schema extensions to service_role;
grant select, insert on public.app_users, public.face_templates to service_role;
notify pgrst, 'reload schema';
commit;
