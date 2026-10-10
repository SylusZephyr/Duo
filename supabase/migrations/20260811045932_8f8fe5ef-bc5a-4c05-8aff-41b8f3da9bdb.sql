ALTER TABLE public.post_media DROP COLUMN public_path;

CREATE OR REPLACE FUNCTION public.can_access_storage_path(_name TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(_name))[1] = 'spaces'
      THEN public.is_space_member(NULLIF((storage.foldername(_name))[2], '')::uuid, _user_id)
    WHEN (storage.foldername(_name))[1] = 'avatars'
      THEN (storage.foldername(_name))[2] = _user_id::text
    ELSE false
  END
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_storage_path(TEXT, UUID) FROM PUBLIC;

CREATE POLICY "Members can read their moment photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'moments' AND public.can_access_storage_path(name, auth.uid()));
CREATE POLICY "Members can upload moment photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'moments' AND public.can_access_storage_path(name, auth.uid()));
CREATE POLICY "Members can replace moment photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'moments' AND public.can_access_storage_path(name, auth.uid()))
  WITH CHECK (bucket_id = 'moments' AND public.can_access_storage_path(name, auth.uid()));
CREATE POLICY "Members can delete moment photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'moments' AND public.can_access_storage_path(name, auth.uid()));