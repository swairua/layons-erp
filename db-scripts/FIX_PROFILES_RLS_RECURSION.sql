-- Fix for infinite recursion in profiles RLS policies
-- This disables problematic recursive policies and replaces them with simpler ones

BEGIN TRANSACTION;

-- Step 1: Drop all problematic recursive policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Admins can insert new profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON profiles;

-- Step 2: Create simple non-recursive policies
-- Policy 1: Users can view their own profile (uses auth.uid() - no table access)
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy 3: Allow insert for authenticated users (profile creation on signup)
CREATE POLICY "Authenticated users can insert profiles" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 3: For admin operations, we use application-level checks instead of recursive RLS
-- The app checks if user.role = 'admin' before allowing admin operations
-- This is safer and avoids database-level recursion issues

-- Step 4: Verify the policies are in place
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';

COMMIT;

-- After running this SQL:
-- 1. Refresh your browser
-- 2. Go to Settings > User Management
-- 3. Try the Admin Diagnostics & Fix tool again
-- 4. The infinite recursion error should be resolved
