DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix RLS policies for pages table
DROP POLICY IF EXISTS "Users can create pages" ON pages;
CREATE POLICY "Users can create pages"
ON pages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view pages" ON pages;
CREATE POLICY "Users can view pages"
ON pages
FOR SELECT
TO authenticated
USING (true);

-- Fix RLS policies for creator_pages table
DROP POLICY IF EXISTS "Users can create creator pages" ON creator_pages;
CREATE POLICY "Users can create creator pages"
ON creator_pages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view published creator pages" ON creator_pages;
CREATE POLICY "Users can view published creator pages"
ON creator_pages
FOR SELECT
TO authenticated
USING (is_published = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own creator pages" ON creator_pages;
CREATE POLICY "Users can update own creator pages"
ON creator_pages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix group chat participant insertion
CREATE OR REPLACE FUNCTION create_group_chat_with_participants(
  chat_name text,
  participant_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id uuid;
  participant_id uuid;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user ID is NULL. Cannot create chat without a valid creator.';
  END IF;

  -- Create the group chat
  INSERT INTO chats (name, type, created_by, creator_id)
  VALUES (chat_name, 'group', current_user_id, current_user_id)
  RETURNING id INTO new_chat_id;

  -- Add creator as admin first
  INSERT INTO chat_participants (chat_id, user_id, role)
  VALUES (new_chat_id, current_user_id, 'admin');

  -- Add other participants
  FOREACH participant_id IN ARRAY participant_ids
  LOOP
    IF participant_id != current_user_id THEN
      INSERT INTO chat_participants (chat_id, user_id, role)
      VALUES (new_chat_id, participant_id, 'member');
    END IF;
  END LOOP;

  RETURN new_chat_id;
END;
$$;```
