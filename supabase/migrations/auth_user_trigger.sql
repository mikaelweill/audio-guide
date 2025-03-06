-- Create a function that will be triggered when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new record into the User table using the auth user's id and email
  INSERT INTO public."User" (id, email, created_at)
  VALUES (NEW.id, NEW.email, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING; -- In case the user already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function whenever a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Log that the trigger was created successfully
DO $$
BEGIN
  RAISE NOTICE 'Auth user trigger created successfully';
END
$$; 