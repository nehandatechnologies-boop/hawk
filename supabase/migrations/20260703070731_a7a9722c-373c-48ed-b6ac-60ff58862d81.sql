UPDATE auth.users
SET encrypted_password = crypt('Mtivambira@27', gen_salt('bf')),
    updated_at = now()
WHERE email = 'brianlevymadhobhi@gmail.com';