import { prisma } from '$lib/data/prisma';
import type { Subscription } from '$lib/types';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import axios from 'axios';

export async function load({ locals }: RequestEvent) {
  const session = await locals.getSession();

  if (!session || !session?.user?.email) {
    throw redirect(303, '/');
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user?.email
    }
  });

  if (!user?.id) {
    throw redirect(303, '/');
  }

  const account = (
    await prisma.account.findMany({
      where: {
        userId: user?.id
      }
    })
  )[0];

  if (!account.access_token) {
    throw redirect(303, '/');
  }

  const response = await axios.get(
    'https://youtube.googleapis.com/youtube/v3/subscriptions?mine=true&maxResults=500&part=snippet',
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`
      }
    }
  );

  let subscriptions = response.data.items as Subscription[];

  subscriptions = subscriptions.sort((a, b) => {
    return a.snippet.title.localeCompare(b.snippet.title);
  });

  return {
    user,
    account,
    subscriptions
  };
}
