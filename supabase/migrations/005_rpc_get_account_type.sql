-- RPC function for efficient account type lookup
-- This should be created in your Supabase database

CREATE OR REPLACE FUNCTION get_account_type(user_email TEXT)
RETURNS TABLE(account_type TEXT, has_passkey BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    passkey_count INTEGER;
BEGIN
    -- Find user by email
    SELECT * INTO user_record
    FROM auth.users
    WHERE email = LOWER(user_email)
    LIMIT 1;

    -- If user not found, return none
    IF user_record.id IS NULL THEN
        RETURN QUERY SELECT 'none'::TEXT, false;
        RETURN;
    END IF;

    -- Get auth method from metadata
    DECLARE
        auth_method TEXT := COALESCE(user_record.raw_user_meta_data->>'auth_method', 'password');
    BEGIN
        -- Check for passkey credentials
        SELECT COUNT(*) INTO passkey_count
        FROM passkey_credentials
        WHERE user_id = user_record.id
        LIMIT 1;

        -- Determine if user has passkey
        DECLARE
            has_passkey BOOLEAN := (passkey_count > 0) OR (auth_method = 'passkey') OR (auth_method = 'password_and_passkey');
        BEGIN
            RETURN QUERY SELECT auth_method, has_passkey;
        END;
    END;
END;
$$;