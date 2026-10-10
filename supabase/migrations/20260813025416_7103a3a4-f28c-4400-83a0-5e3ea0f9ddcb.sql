GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_member_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_path(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_post_public(uuid) TO authenticated, anon;