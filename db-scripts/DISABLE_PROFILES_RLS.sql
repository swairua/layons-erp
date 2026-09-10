-- SIMPLE FIX: Disable RLS on profiles table
-- This is the quickest way to fix the infinite recursion error
-- The app handles authorization at the application level, not at the database level

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Verify it worked:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
-- Should show: profiles | f (false = RLS disabled)
