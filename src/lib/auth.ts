import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'family' | 'public';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

const COOKIE_NAME = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';

/**
 * Get the current user's profile from a Supabase client.
 * Returns null if not authenticated.
 */
export async function getUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile as UserProfile | null;
}

/**
 * Extract the access token from request cookies.
 */
export function getAccessToken(request: Request): string | null {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Extract the refresh token from request cookies.
 */
export function getRefreshToken(request: Request): string | null {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Set auth cookies on a response.
 */
export function setAuthCookies(headers: Headers, accessToken: string, refreshToken: string): void {
  const secure = import.meta.env.PROD ? '; Secure' : '';
  const sameSite = '; SameSite=Lax';
  const path = '; Path=/';
  const httpOnly = '; HttpOnly';

  headers.append('Set-Cookie', `${COOKIE_NAME}=${accessToken}${httpOnly}${secure}${sameSite}${path}; Max-Age=3600`);
  headers.append('Set-Cookie', `${REFRESH_COOKIE}=${refreshToken}${httpOnly}${secure}${sameSite}${path}; Max-Age=604800`);
}

/**
 * Clear auth cookies on a response.
 */
export function clearAuthCookies(headers: Headers): void {
  headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0`);
  headers.append('Set-Cookie', `${REFRESH_COOKIE}=; Path=/; Max-Age=0`);
}

// Role check helpers
export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin';
}

export function isFamily(profile: UserProfile | null): boolean {
  return profile?.role === 'family' || profile?.role === 'admin';
}

export function isAuthenticated(profile: UserProfile | null): boolean {
  return profile !== null;
}
