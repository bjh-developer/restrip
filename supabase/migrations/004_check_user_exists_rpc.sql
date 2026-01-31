-- Create RPC function to check if user exists by email
-- This function queries the auth.users table which is not directly accessible via PostgREST
CREATE OR REPLACE FUNCTION check_user_exists(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = LOWER(user_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke all default permissions
REVOKE EXECUTE ON FUNCTION check_user_exists(TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION check_user_exists(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_user_exists(TEXT) FROM anon;

-- Grant execute permission only to service_role
GRANT EXECUTE ON FUNCTION check_user_exists(TEXT) TO service_role;
