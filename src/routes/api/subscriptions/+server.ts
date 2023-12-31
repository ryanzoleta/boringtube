import { getUser, getAccount } from '$lib/data/queries';
import type { Subscription } from '$lib/types';
import { json, redirect, type RequestEvent } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ locals }: RequestEvent) {
  const session = await locals.getSession();

  if (!session || !session?.user?.email) {
    throw redirect(303, '/');
  }

  const user = await getUser(session);

  if (!user?.id) {
    throw redirect(303, '/');
  }

  const account = await getAccount(user.id);

  if (!account?.access_token) {
    throw redirect(303, '/');
  }

  let subscriptions: Subscription[] = [];
  let nextPage = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = nextPage
      ? `https://youtube.googleapis.com/youtube/v3/subscriptions?mine=true&maxResults=500&part=snippet&pageToken=${nextPage}`
      : 'https://youtube.googleapis.com/youtube/v3/subscriptions?mine=true&maxResults=500&part=snippet';

    const response = await axios.get(query, {
      headers: {
        Authorization: `Bearer ${account.access_token}`
      }
    });

    subscriptions = [...subscriptions, ...(response.data.items as Subscription[])];
    nextPage = response.data.nextPageToken;

    if (!nextPage) {
      break;
    }
  }

  subscriptions = subscriptions.sort((a, b) => {
    return a.snippet.title.localeCompare(b.snippet.title);
  });

  return json({ subscriptions });
}
