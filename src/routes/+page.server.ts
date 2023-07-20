import { redirect, type RequestEvent } from '@sveltejs/kit';

export async function load({ locals }: RequestEvent) {
  const session = await locals.getSession();

  if (session) {
    // throw redirect(303, '/app');
  }
}
