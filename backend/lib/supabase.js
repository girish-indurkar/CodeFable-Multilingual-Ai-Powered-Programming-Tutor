const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Supabase client initialized with Service Role (Bypassing RLS)');
} else {
  console.log('Supabase client initialized with Anon Key (RLS enabled)');
}

module.exports = supabase;
