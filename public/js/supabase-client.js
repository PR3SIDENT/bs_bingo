import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// These are safe to expose — scoped by RLS policies
const SUPABASE_URL = 'https://zwvdzwxvboyizlelxqsu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3dmR6d3h2Ym95aXpsZWx4cXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTk1MTEsImV4cCI6MjA4NTM3NTUxMX0.r0I5wBvok4lv_sqx-Lp-2o0vcFnDbnICUbJmTjPRWMI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
