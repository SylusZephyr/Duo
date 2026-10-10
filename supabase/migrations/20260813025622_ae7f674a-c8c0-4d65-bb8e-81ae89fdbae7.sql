CREATE POLICY "Creators can view their space"
ON public.spaces FOR SELECT TO authenticated
USING (auth.uid() = created_by);

DELETE FROM public.spaces s
WHERE s.invite_code IN ('QQ11WW','ZZ99XX')
  AND NOT EXISTS (SELECT 1 FROM public.space_members m WHERE m.space_id = s.id);