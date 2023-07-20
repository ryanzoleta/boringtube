import type { Session } from '@auth/core/types';
import { prisma } from './prisma';
import type { User } from '.prisma/client';
import moment from 'moment';

export async function getUser(session: Session) {
  if (!session.user?.email) {
    return null;
  }

  return await prisma.user.findUnique({
    where: {
      email: session.user?.email
    }
  });
}

export async function getAccount(user: User) {
  if (!user?.id) {
    return null;
  }

  const account = (
    await prisma.account.findMany({
      where: {
        userId: user?.id
      }
    })
  )[0];

  return account;
}

export async function updateAccountRefreshToken(
  accountId: string,
  accessToken: string,
  expiresAt: number
) {
  console.log(
    `Updating account.id ${accountId} access_token, will expire at ${moment(
      expiresAt * 1000
    ).format()}`
  );

  await prisma.account.update({
    where: {
      id: accountId
    },
    data: {
      access_token: accessToken,
      expires_at: expiresAt
    }
  });
}
