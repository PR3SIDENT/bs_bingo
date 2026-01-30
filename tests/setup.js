// Provide dummy env vars so supabase-admin.js can initialize
// The actual Supabase client won't be used — tests mock the from/auth methods
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
