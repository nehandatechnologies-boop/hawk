-- Recreate the admin read-only query helper so it is no longer callable by signed-in users.
DROP FUNCTION IF EXISTS public.admin_readonly_query(text);

CREATE OR REPLACE FUNCTION public.admin_readonly_query(_sql text, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trimmed text;
  head text;
  result jsonb;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'Administrator'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: administrator role required';
  END IF;

  trimmed := btrim(_sql);
  IF trimmed IS NULL OR length(trimmed) = 0 THEN
    RAISE EXCEPTION 'empty query';
  END IF;

  trimmed := regexp_replace(trimmed, ';\s*$', '');
  IF position(';' in trimmed) > 0 THEN
    RAISE EXCEPTION 'only a single statement is allowed';
  END IF;

  head := lower(split_part(trimmed, ' ', 1));
  IF head NOT IN ('select','with','show','explain','table') THEN
    RAISE EXCEPTION 'only SELECT / WITH / SHOW / EXPLAIN / TABLE statements are allowed';
  END IF;

  SET LOCAL statement_timeout = '5s';
  SET LOCAL transaction_read_only = on;

  EXECUTE format('SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', trimmed)
    INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_readonly_query(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_readonly_query(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_readonly_query(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_readonly_query(text, uuid) TO service_role;