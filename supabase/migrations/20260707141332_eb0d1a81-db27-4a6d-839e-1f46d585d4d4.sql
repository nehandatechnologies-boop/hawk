
CREATE OR REPLACE FUNCTION public.admin_readonly_query(_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text;
  head text;
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'Administrator'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: administrator role required';
  END IF;

  trimmed := btrim(_sql);
  IF trimmed IS NULL OR length(trimmed) = 0 THEN
    RAISE EXCEPTION 'empty query';
  END IF;

  -- Strip trailing semicolon then reject any embedded ones (single statement only).
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
$$;

REVOKE EXECUTE ON FUNCTION public.admin_readonly_query(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_readonly_query(text) TO authenticated;
