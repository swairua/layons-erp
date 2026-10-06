-- Fix audit_logs RLS policies: the previous SELECT/INSERT policies reference a
-- user_company_access table that does not exist in the applied migrations,
-- so every SELECT/INSERT on audit_logs fails the policy check (Postgres
-- returns an "undefined table" error), which breaks the /audit-logs page
-- and all audited delete logging. Rewrite both policies using the same
-- profiles-based company scoping pattern used by the rest of the schema:
--   company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );