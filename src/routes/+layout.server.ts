import type { RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }: RequestEvent) => {
  const session = await locals.getSession();

  return {
    session
  };
};
