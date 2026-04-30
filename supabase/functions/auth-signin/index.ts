import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, role, initials, is_active, patient_id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!user.is_active) {
      return new Response(
        JSON.stringify({ error: 'Account is inactive' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const passwordMatches = user.password_hash === password ||
      user.password_hash === `hashed_${password}`

    if (!passwordMatches) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        data: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          initials: user.initials,
          patient_id: user.patient_id,
        },
        error: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
