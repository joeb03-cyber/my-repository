"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Query parameters keep exact selections inside the existing app routes.
export function useAppItem(path: string, key: string) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const active = pathname === path;
  return {
    active,
    requested: active ? params.get(key) : null,
    select: (value: string | null) => router.push(value ? `${path}?${key}=${encodeURIComponent(value)}` : path, { scroll: false }),
  };
}
