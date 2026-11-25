'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { userKeys } from '@/lib/query-keys';
import type { User } from '@/types';

/**
 * The signed-in user's profile. The auth store only holds the user returned at
 * login (it is lost on refresh), so this also fetches GET /users/me and keeps
 * the store in sync.
 */
export function useCurrentUser() {
  const { address, user: storeUser, isHydrated, setUser } = useAuthStore();

  const query = useQuery({
    queryKey: userKeys.me(address),
    queryFn: usersApi.me,
    enabled: isHydrated && !!address,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  const user: User | null = address ? query.data ?? storeUser : null;
  return { user, query };
}
