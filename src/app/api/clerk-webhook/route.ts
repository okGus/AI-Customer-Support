import { Webhook, type WebhookRequiredHeaders } from 'svix';
import { headers } from 'next/headers';
import { type WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { env } from '~/env';

export async function POST(req: Request) {

  // You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error outunsafe
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Error occured -- no svix headers' }, { status: 400 });
  }

  // Get the body
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const payload = await req.json()
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    } as WebhookRequiredHeaders) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Error occured'}, { status: 400 });
  }

  const eventType = evt.type;
  if (eventType === 'user.created') {
    const { id, first_name, last_name } = evt.data;

    const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_KEY
    )

    const { error } = await supabase.from('users').insert({
        user_id: id,
        name: `${first_name} ${last_name}`,
    });

    if (error) {
        console.error("Error inserting user into Supabase:", error);
        return NextResponse.json({ error: 'Error inserting user into database' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User added successfully' }, { status: 200 });
  }

  return Response.json({ message: 'Webhook received' }, { status: 200 })
}