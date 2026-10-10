REVOKE EXECUTE ON FUNCTION public.is_space_member(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.space_member_count(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_post(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_post_public(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_space_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space_id UUID;
  _count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT id INTO _space_id FROM public.spaces WHERE upper(invite_code) = upper(btrim(_code));
  IF _space_id IS NULL THEN
    RAISE EXCEPTION 'That invite code does not exist';
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_members WHERE space_id = _space_id AND user_id = auth.uid()) THEN
    RETURN _space_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a space';
  END IF;

  SELECT count(*) INTO _count FROM public.space_members WHERE space_id = _space_id;
  IF _count >= 2 THEN
    RAISE EXCEPTION 'That space is already full';
  END IF;

  INSERT INTO public.space_members (space_id, user_id) VALUES (_space_id, auth.uid());
  RETURN _space_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_space_by_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_space_by_code(TEXT) TO authenticated;