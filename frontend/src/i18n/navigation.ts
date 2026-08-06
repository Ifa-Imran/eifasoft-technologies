import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware drop-in replacements for `next/link` + `next/navigation`.
 *
 * Import { Link, useRouter, usePathname, redirect } from here instead of
 * `next/link` / `next/navigation` so internal paths are automatically
 * prefixed with the active locale (e.g. `/dashboard` -> `/en/dashboard`).
 *
 * `usePathname()` returns the path WITHOUT the locale segment, so existing
 * active-link comparisons (e.g. `pathname === '/dashboard'`) keep working.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
