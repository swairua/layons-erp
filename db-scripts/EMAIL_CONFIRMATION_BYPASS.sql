-- =====================================================
-- EMAIL CONFIRMATION BYPASS FOR BIOLEGEND ADMIN
-- Execute this SQL in Supabase Dashboard > SQL Editor
-- =====================================================

-- Function 1: Simple email confirmation bypass
CREATE OR REPLACE FUNCTION confirm_user_email(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the email_confirmed_at timestamp for the specified user
  UPDATE auth.users 
  SET 
    email_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE email = user_email 
    AND email_confirmed_at IS NULL;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$;

-- Function 2: Force confirm admin email with profile update
CREATE OR REPLACE FUNCTION force_confirm_admin_email(admin_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  result jsonb;
BEGIN
  -- Find the user by email
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = admin_email;
  
  -- If user exists
  IF FOUND THEN
    -- Update email confirmation
    UPDATE auth.users 
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = user_record.id;
    
    -- Also update or create the profile
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      role, 
      status, 
      department, 
      position,
      created_at,
      updated_at
    ) VALUES (
      user_record.id,
      admin_email,
      'System Administrator',
      'admin',
      'active',
      'Administration',
      'System Administrator',
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = 'admin',
      status = 'active',
      full_name = COALESCE(profiles.full_name, 'System Administrator'),
      department = COALESCE(profiles.department, 'Administration'),
      position = COALESCE(profiles.position, 'System Administrator'),
      updated_at = NOW();
    
    result := jsonb_build_object(
      'success', true,
      'message', 'Admin email confirmed and profile updated',
      'user_id', user_record.id,
      'email', admin_email
    );
    
    RETURN result;
  ELSE
    result := jsonb_build_object(
      'success', false,
      'message', 'User not found with email: ' || admin_email
    );
    
    RETURN result;
  END IF;
END;
$$;

-- Function 3: Create admin user with bypass (if user doesn't exist)
CREATE OR REPLACE FUNCTION create_admin_with_bypass(
  admin_email text,
  admin_password text DEFAULT 'Biolegend2024!Admin',
  admin_name text DEFAULT 'System Administrator'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result jsonb;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    -- User exists, just confirm email
    RETURN force_confirm_admin_email(admin_email);
  END IF;
  
  -- Create new user (this would typically require direct auth.users access)
  -- Note: This function may need to be created by Supabase support
  -- or you may need to use the Dashboard/API
  
  result := jsonb_build_object(
    'success', false,
    'message', 'User creation requires Supabase auth API. Use Dashboard method instead.',
    'instructions', jsonb_build_array(
      'Use Supabase Dashboard Authentication > Users > Invite user',
      'Or use the admin creation in the application'
    )
  );
  
  RETURN result;
END;
$$;

-- Grant permissions to allow execution
GRANT EXECUTE ON FUNCTION confirm_user_email(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION force_confirm_admin_email(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_admin_with_bypass(text, text, text) TO authenticated, anon;

-- Test the functions (execute these one by one)
-- Replace 'admin@biolegendscientific.co.ke' with actual admin email

-- Test 1: Simple confirmation
SELECT confirm_user_email('admin@biolegendscientific.co.ke');

-- Test 2: Force confirmation with profile update
SELECT force_confirm_admin_email('admin@biolegendscientific.co.ke');

-- Test 3: Check if user now exists and is confirmed
SELECT 
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at
FROM auth.users 
WHERE email = 'admin@biolegendscientific.co.ke';

-- Test 4: Check profile
SELECT 
  id,
  email,
  full_name,
  role,
  status
FROM public.profiles 
WHERE email = 'admin@biolegendscientific.co.ke';

-- =====================================================
-- QUICK MANUAL CONFIRMATION (Alternative Method)
-- =====================================================

-- If the functions above don't work, try this direct approach:
-- WARNING: Only use this if you have superuser access

-- Direct email confirmation update
-- UPDATE auth.users 
-- SET 
--   email_confirmed_at = NOW(),
--   confirmed_at = NOW(),
--   updated_at = NOW()
-- WHERE email = 'admin@biolegendscientific.co.ke'
--   AND email_confirmed_at IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check email confirmation status
SELECT 
  email,
  email_confirmed_at,
  confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'admin@biolegendscientific.co.ke';

-- Check profile status
SELECT 
  profiles.id,
  profiles.email,
  profiles.full_name,
  profiles.role,
  profiles.status,
  auth_users.email_confirmed_at
FROM public.profiles 
LEFT JOIN auth.users auth_users ON profiles.id = auth_users.id
WHERE profiles.email = 'admin@biolegendscientific.co.ke';

-- =====================================================
-- INSTRUCTIONS SUMMARY
-- =====================================================

/*
EXECUTION STEPS:

1. Copy this entire script
2. Open Supabase Dashboard → SQL Editor  
3. Paste and execute the script (it will create the functions)
4. Execute the test queries to confirm the admin user
5. Return to the application and try signing in

If the functions don't work:
- Go to Authentication → Users in Supabase Dashboard
- Find admin@biolegendscientific.co.ke
- Click the menu (⋯) → "Confirm email"

The admin credentials are:
Email: admin@biolegendscientific.co.ke
Password: Biolegend2024!Admin
*/
