import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError, createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { toast } from '@/utils/safeToast';
import { initializeAuth, clearAuthTokens, safeAuthOperation } from '@/utils/authHelpers';
import { logError, getUserFriendlyErrorMessage, isErrorType } from '@/utils/errorLogger';
import { parseErrorMessage } from '@/utils/errorHelpers';

// Type definitions for user roles and statuses
export type UserRole = 'admin' | 'accountant' | 'stock_manager' | 'user' | 'sales';
export type UserStatus = 'active' | 'inactive' | 'pending';

// Helper function to safely format error for display
const formatErrorForDisplay = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const errorObj = error as any;
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error_description && typeof errorObj.error_description === 'string') {
      return errorObj.error_description;
    }
    if (errorObj.details && typeof errorObj.details === 'string') {
      return errorObj.details;
    }
  }

  return 'An unexpected error occurred';
};

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  company_id?: string;
  department?: string;
  position?: string;
  role?: UserRole;
  status?: UserStatus;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  changeOwnPassword: (oldPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  changeUserPassword: (userId: string, newPassword: string) => Promise<{ error: Error | null }>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  clearTokens: () => void;
  permissions: Record<string, boolean>;
  profileReady: boolean;
  permissionsReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useIsSalesAccount = () => {
  const { profile, loading } = useAuth();
  const isSalesAccount = profile?.role === 'sales';
  return { isSalesAccount, isLoading: loading };
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [profileReady, setProfileReady] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Log storage availability once on mount
  useEffect(() => {
    try {
      const testKey = '__auth_test__';
      const isStorageAvailable = typeof window !== 'undefined' &&
        window.localStorage !== undefined;

      if (isStorageAvailable) {
        try {
          window.localStorage.setItem(testKey, 'test');
          const value = window.localStorage.getItem(testKey);
          window.localStorage.removeItem(testKey);
        } catch (e) {
        }
      }

      const existingToken = window.localStorage?.getItem('sb-auth-token');
    } catch (e) {
    }
  }, []);

  // Use refs to prevent stale closures and unnecessary re-renders
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const forceCompletedRef = useRef(false);
  const signingOutRef = useRef(false);
  const signingInRef = useRef(false);

  // Toast spam prevention
  const lastNetworkErrorToast = useRef<number>(0);
  const lastPermissionErrorToast = useRef<number>(0);
  const lastGeneralErrorToast = useRef<number>(0);
  const TOAST_COOLDOWN = 10000; // 10 seconds between similar error toasts

  // Fetch user profile from database with error handling and retry logic
  const fetchProfile = useCallback(async (userId: string, showErrorToast: boolean = false): Promise<UserProfile | null> => {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Profile and permissions must land together: a role-gated UI that
        // renders from the profile while permissions are still empty shows the
        // wrong menu (role defaults only) on login and page refresh.
        const [
          { data: profileData, error: profileError },
          { data: permissionData, error: permissionError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, phone, company_id, department, position, role, status, last_login, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle(), // Use maybeSingle to handle 0 results gracefully
          supabase
            .from('user_permissions')
            .select('permission_name, granted')
            .eq('user_id', userId),
        ]);

        if (profileError) {
          throw profileError;
        }

        if (permissionError) throw permissionError;

        setPermissions(Object.fromEntries(
          (permissionData || []).map(permission => [permission.permission_name, permission.granted === true])
        ));
        setPermissionsReady(true);

        if (!profileData) {
          console.warn(`No profile data found for user ${userId} - this is expected if profile hasn't been created yet`);
          return null;
        }

        if (profileData.email) {
          profileData.email = profileData.email.toLowerCase();
        }

        return profileData as unknown as UserProfile;
      } catch (fetchError) {
        lastError = fetchError;

        // Check if it's a network error
        const errorMsg = (fetchError instanceof Error) ? fetchError.message : String(fetchError);
        const isNetworkError = errorMsg.includes('Failed to fetch') ||
                              errorMsg.includes('Network') ||
                              errorMsg.includes('timeout') ||
                              errorMsg.includes('ECONNREFUSED') ||
                              errorMsg.includes('ENOTFOUND') ||
                              errorMsg.includes('NetworkError') ||
                              errorMsg.includes('CORS') ||
                              errorMsg.includes('fetch');

        if (isNetworkError && attempt < maxRetries - 1) {
          // Wait before retrying (exponential backoff: 300ms, 600ms)
          const delayMs = 300 * Math.pow(2, attempt);
          console.warn(`Profile fetch network error (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms... Error: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Format error message properly to avoid [object Object]
        let errorMessage = 'Unknown error';
        let errorDetails = '';
        if (fetchError instanceof Error) {
          errorMessage = fetchError.message;
          errorDetails = fetchError.stack ? ` Stack: ${fetchError.stack.substring(0, 100)}` : '';
        } else if (typeof fetchError === 'string') {
          errorMessage = fetchError;
        } else if (fetchError && typeof fetchError === 'object') {
          const errObj = fetchError as any;
          errorMessage = errObj.message || errObj.error_description || errObj.details || String(fetchError);
          errorDetails = errObj.hint ? ` Hint: ${errObj.hint}` : '';
        }

        // Log comprehensive error info for debugging (but suppress from user by default)
        console.warn(`Profile fetch error for user ${userId}: ${errorMessage}${errorDetails} (attempt ${attempt + 1}/${maxRetries}). App will continue without full profile.`);

        // Handle specific error types using the error type checker
        if (isErrorType(fetchError, 'auth')) {
          console.warn('Profile fetch failed due to expired token - user may need to re-authenticate');
          return null; // Don't show error toast for auth issues
        }

        if (isErrorType(fetchError, 'network')) {
          console.warn('Profile fetch failed due to network issue - app will continue without full profile');
          // Don't show toast for network errors on profile fetch - it's not critical
          // The app can work with just the auth user info
          return null;
        }

        if (isErrorType(fetchError, 'permission')) {
          console.warn('Profile fetch failed due to permissions');

          // Only show permission error if explicitly requested
          if (showErrorToast) {
            const now = Date.now();
            if (now - lastPermissionErrorToast.current > TOAST_COOLDOWN) {
              lastPermissionErrorToast.current = now;
              setTimeout(() => toast.error(
                'Permission error accessing profile. Please sign in again.',
                { duration: 4000 }
              ), 0);
            }
          }
          return null;
        }

        // Only show general error if explicitly requested (profile fetch is non-critical for app operation)
        if (showErrorToast) {
          const friendlyMessage = getUserFriendlyErrorMessage(fetchError);
          const now = Date.now();
          if (now - lastGeneralErrorToast.current > TOAST_COOLDOWN) {
            lastGeneralErrorToast.current = now;
            setTimeout(() => toast.error(
              `Failed to load user profile: ${friendlyMessage}`,
              { duration: 4000 }
            ), 0);
          }
        }

        return null;
      }
    }

    return null;
  }, []);

  // Keep retrying the profile fetch until it succeeds so a slow query never
  // leaves the user stuck on the temporary fallback (role: 'user').
  const loadProfileInBackground = useCallback((userId: string, email?: string | null, maxAttempts = 5) => {
    let cancelled = false;

    const attemptLoad = (attempt: number) => {
      if (cancelled || !mountedRef.current) return;

      fetchProfile(userId)
        .then(profile => {
          if (cancelled || !mountedRef.current) return;
          if (profile) {
            console.log(`[profile] loaded on background attempt ${attempt}`);
            setProfile(profile);
            setProfileReady(true);
          } else if (attempt < maxAttempts) {
            setTimeout(() => attemptLoad(attempt + 1), 2000);
          } else {
            console.warn(`[profile] still no profile after ${maxAttempts} background attempts - using temporary profile`);
            setProfile(prev => prev ?? ({
              id: userId,
              email: (email || '').toLowerCase(),
              role: 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as UserProfile));
            setProfileReady(true);
          }
        })
        .catch(err => {
          if (cancelled || !mountedRef.current) return;
          logError('Profile background retry failed:', err, { userId, attempt, context: 'loadProfileInBackground' });
          if (attempt < maxAttempts) {
            setTimeout(() => attemptLoad(attempt + 1), 2000);
          } else {
            console.warn(`[profile] background retries exhausted - using temporary profile`);
            setProfile(prev => prev ?? ({
              id: userId,
              email: (email || '').toLowerCase(),
              role: 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as UserProfile));
            setProfileReady(true);
          }
        });
    };

    attemptLoad(1);

    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  // Update last login timestamp silently
  const updateLastLogin = useCallback(async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logError('Error updating last login:', error, { userId, context: 'updateLastLogin' });
    }
  }, []);

  // Handle auth state changes with improved error handling
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    if (!mountedRef.current || initializingRef.current || signingOutRef.current || signingInRef.current) return;

    
    try {
      // Batch state updates to prevent multiple renders
      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id);
        
        if (mountedRef.current) {
          setSession(newSession);
          setUser(newSession.user);
          setProfile(userProfile);
          setProfileReady(true);

          // Update last login for sign-in events, but don't await to prevent blocking
          if (event === 'SIGNED_IN' && userProfile) {
            updateLastLogin(newSession.user.id).catch(err =>
              logError('Sign-in last login update failed:', err, {
                userId: newSession.user.id,
                context: 'handleAuthStateChange'
              })
            );
          }
        }
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Debounce: verify session is truly gone before clearing state
        // Prevents transient auto-refresh failures from logging the user out
        await new Promise(resolve => setTimeout(resolve, 400));
        const { data: verifyData } = await supabase.auth.getSession();
        if (verifyData?.session?.user && mountedRef.current) {
          setSession(verifyData.session);
          setUser(verifyData.session.user);
          return;
        }
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setPermissions({});
          setPermissionsReady(false);
          setProfileReady(true);
        }
      } else {
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setPermissions({});
          setPermissionsReady(false);
          setProfileReady(true);
        }
      }
    } catch (error) {
      logError('Error in auth state change:', error, {
        event,
        hasSession: !!newSession,
        context: 'handleAuthStateChange'
      });

      // If we get invalid token errors, clear tokens
      if (isErrorType(error, 'auth')) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        if (errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('Refresh Token Not Found')) {
          clearAuthTokens();
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchProfile, updateLastLogin]);

  // Initialize auth state - simple and robust
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    mountedRef.current = true;

    let completed = false;

    const completeInit = () => {
      if (!completed && mountedRef.current) {
        completed = true;
        initializingRef.current = false;
        setLoading(false);
        setInitialized(true);
      }
    };

    // CRITICAL: Ensure initialization completes within 5 seconds no matter what
    const hardTimeout = setTimeout(() => {
      completeInit();
    }, 5000);

    const initializeAuthState = async () => {
      try {
        // Simple session check with generous timeout (Supabase may need to refresh the token)
        const sessionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 3000);
        });

        try {
          const { data: sessionData } = await Promise.race([
            supabase.auth.getSession(),
            sessionTimeoutPromise
          ]) as any;

          if (sessionData?.session?.user && mountedRef.current && !signingOutRef.current) {
            // Explicitly set the session on the Supabase client to ensure auth headers
            // are wired for subsequent API calls
            try {
              await supabase.auth.setSession({
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
              });
            } catch (setSessionError) {
            }

            setSession(sessionData.session);
            setUser(sessionData.session.user);
            setProfileReady(false);

            // Fetch profile in background with timeout
            const profileTimeoutPromise = new Promise<UserProfile | null>((resolve) => {
              setTimeout(() => {
                resolve(null);
              }, 2000);
            });

            Promise.race([
              fetchProfile(sessionData.session.user.id),
              profileTimeoutPromise
            ])
              .then(profile => {
                if (mountedRef.current) {
                  if (profile) {
                    setProfile(profile);
                    setProfileReady(true);
                  } else {
                    // Keep profileReady false so role/permission-gated UI (sidebar,
                    // protected routes) waits for the real profile instead of
                    // rendering from a temporary role: 'user' fallback.
                    console.warn('[profile] initial fetch timed out or returned nothing - retrying in background');
                    setProfile({
                      id: sessionData.session.user.id,
                      email: (sessionData.session.user.email || '').toLowerCase(),
                      role: 'user',
                      status: 'active',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    } as UserProfile);
                    loadProfileInBackground(sessionData.session.user.id, sessionData.session.user.email);
                  }
                }
              })
              .catch(() => {
                if (mountedRef.current) {
                  setProfile({
                    id: sessionData.session.user.id,
                    email: (sessionData.session.user.email || '').toLowerCase(),
                    role: 'user',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  } as UserProfile);
                  loadProfileInBackground(sessionData.session.user.id, sessionData.session.user.email);
                }
              });
          }
        } catch (sessionError) {
          const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        }

        completeInit();
      } catch (error) {
        console.error('❌ Initialization error:', {
          message: error instanceof Error ? error.message : String(error),
          error
        });
        completeInit();
      }
    };

    initializeAuthState();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      clearTimeout(hardTimeout);
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, handleAuthStateChange, loadProfileInBackground]);

  const signIn = useCallback(async (email: string, password: string) => {
    const hardTimeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    }, 2000);

    // Set flag so handleAuthStateChange skips during active sign-in
    signingInRef.current = true;

    try {
      const { data, error } = await safeAuthOperation(async () => {
        setLoading(true);
        return await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }, 'signIn');

      if (error) {
        clearTimeout(hardTimeoutId);
        setLoading(false);
        const errorMessage = parseErrorMessage(error);
        const formattedError = new Error(errorMessage || 'Authentication failed');
        return { error: formattedError as AuthError, session: null };
      }

      if (data?.error) {
        clearTimeout(hardTimeoutId);
        setLoading(false);
        const errorMessage = parseErrorMessage(data.error);
        const formattedError = new Error(errorMessage || 'Authentication failed');
        return { error: formattedError as AuthError, session: null };
      }

      // Update auth state and wait for profile load before clearing loading
      try {
        const session = (data as any)?.session ?? (data as any)?.data?.session;
        const signedInUser = session?.user;
        if (signedInUser) {
          setSession(session);
          setUser(signedInUser);
          setProfileReady(false);

          try {
            const profileTimeoutPromise = new Promise<UserProfile | null>((resolve) => {
              setTimeout(() => {
                resolve(null);
              }, 1000);
            });

            const userProfile = await Promise.race([
              fetchProfile(signedInUser.id),
              profileTimeoutPromise
            ]);

            if (mountedRef.current) {
              if (userProfile) {
                if (userProfile.email) {
                  userProfile.email = userProfile.email.toLowerCase();
                }
                setProfile(userProfile);
                setProfileReady(true);
              } else {
                // Temporary profile only: keep profileReady false so the sidebar
                // and protected routes wait for the real role + permissions.
                const fallbackProfile: UserProfile = {
                  id: signedInUser.id,
                  email: (signedInUser.email || '').toLowerCase(),
                  role: 'user',
                  status: 'active',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                setProfile(fallbackProfile);
              }

              setLoading(false);

              if (!userProfile) {
                loadProfileInBackground(signedInUser.id, signedInUser.email);
              }
            }
          } catch (profileError) {
            setLoading(false);
            const fallbackProfile: UserProfile = {
              id: signedInUser.id,
              email: (signedInUser.email || '').toLowerCase(),
              role: 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            setProfile(fallbackProfile);
            loadProfileInBackground(signedInUser.id, signedInUser.email);
          }
          clearTimeout(hardTimeoutId);
          setTimeout(() => toast.success('Signed in successfully'), 0);
          return { error: null, session };
        } else {
          clearTimeout(hardTimeoutId);
          setLoading(false);
          const errorMessage = 'Authentication failed: no user data returned';
          return { error: new Error(errorMessage) as AuthError, session: null };
        }
      } catch (error) {
        clearTimeout(hardTimeoutId);
        setLoading(false);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during sign in';
        return { error: new Error(errorMessage) as AuthError, session: null };
      }
    } finally {
      signingInRef.current = false;
    }
  }, [fetchProfile, loadProfileInBackground]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await safeAuthOperation(async () => {
      setLoading(true);
      return await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
    }, 'signUp');

    if (error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (error instanceof Error) {
        formattedError = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Sign up failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(error) || 'Sign up failed');
      }
      return { error: formattedError as AuthError };
    }

    if (data?.error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (data.error instanceof Error) {
        formattedError = data.error;
      } else if (data.error && typeof data.error === 'object') {
        const errObj = data.error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Sign up failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(data.error) || 'Sign up failed');
      }
      return { error: formattedError as AuthError };
    }

    setTimeout(() => toast.success('Account created successfully'), 0);
    setLoading(false);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    signingOutRef.current = true;

    // Clear local auth state immediately and unconditionally so the UI never
    setUser(null);
    setProfile(null);
    setPermissions({});
    setPermissionsReady(false);
    setSession(null);
    setProfileReady(true);
    clearAuthTokens();
    setLoading(false);

    // Hard timeout so a hanging sign-out request can never freeze the app.
    // Mirrors the existing timeout pattern used by signIn and initialization.
    let timedOut = false;
    const hardTimeout = setTimeout(() => {
      timedOut = true;
      signingOutRef.current = false;
      setTimeout(() => toast.info('Signed out locally (connection issue)'), 0);
    }, 2500);

    try {
      // Best-effort server-side sign out; local state is already cleared.
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (timedOut) return;
      clearTimeout(hardTimeout);

      if (error) {
        // Better error message handling
        let errorMsg = 'Error signing out';
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (typeof error === 'string') {
          errorMsg = error;
        } else if (error && typeof error === 'object') {
          const errObj = error as any;
          // Try common error object properties
          if (errObj.message && typeof errObj.message === 'string') {
            errorMsg = errObj.message;
          } else if (errObj.error_description && typeof errObj.error_description === 'string') {
            errorMsg = errObj.error_description;
          } else if (errObj.status) {
            errorMsg = `Network error (status ${errObj.status})`;
          } else {
            errorMsg = 'Network error during sign out';
          }
        }

        logError('❌ Sign out error:', errorMsg, { context: 'signOut' });

        // Network errors during sign out are non-critical since we clear local state anyway
        setTimeout(() => toast.info('Signed out locally (connection issue)'), 0);
      } else {
        setTimeout(() => toast.success('Signed out successfully'), 0);
      }
    } catch (error) {
      // Handle network errors gracefully
      let errorMsg = 'Unknown error';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        if (errObj.message && typeof errObj.message === 'string') {
          errorMsg = errObj.message;
        } else if (errObj.error_description && typeof errObj.error_description === 'string') {
          errorMsg = errObj.error_description;
        } else if (errObj.status) {
          errorMsg = `Network error (status ${errObj.status})`;
        } else {
          errorMsg = 'Network error during sign out';
        }
      }

      logError('❌ Sign out exception:', errorMsg, { context: 'signOut' });

      // Network errors during sign out are not critical - we've already cleared local state
      setTimeout(() => toast.info('Signed out locally (connection issue)'), 0);
    } finally {
      if (!timedOut) clearTimeout(hardTimeout);
      if (mountedRef.current) {
        setLoading(false);
      }
      signingOutRef.current = false;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { data, error } = await safeAuthOperation(async () => {
      return await supabase.auth.resetPasswordForEmail(email);
    }, 'resetPassword');

    if (error) {
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (error instanceof Error) {
        formattedError = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Password reset failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(error) || 'Password reset failed');
      }
      return { error: formattedError as AuthError };
    }

    if (data?.error) {
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (data.error instanceof Error) {
        formattedError = data.error;
      } else if (data.error && typeof data.error === 'object') {
        const errObj = data.error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Password reset failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(data.error) || 'Password reset failed');
      }
      return { error: formattedError as AuthError };
    }

    setTimeout(() => toast.success('Password reset email sent'), 0);
    return { error: null };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        logError('Error updating profile:', error, { context: 'updateProfile', userId: user.id });
        setTimeout(() => toast.error('Failed to update profile'), 0);
        return { error: new Error(error.message) };
      }

      // Refresh profile data
      await refreshProfile();
      setTimeout(() => toast.success('Profile updated successfully'), 0);
      return { error: null };
    } catch (error) {
      logError('Error updating profile exception:', error, { context: 'updateProfile', userId: user.id });
      setTimeout(() => toast.error('Failed to update profile'), 0);
      return { error: error as Error };
    }
  }, [user]);

  const changeOwnPassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: new Error('No authenticated user found. Please sign in again.') };
    }

    try {
      const tempClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      const { error: signInError } = await tempClient.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) {
        setTimeout(() => toast.error('Current password is incorrect'), 0);
        return { error: new Error('Current password is incorrect') };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        logError('Error updating password:', updateError, { context: 'changeOwnPassword' });
        const errorMsg = updateError.message || 'Failed to update password';
        setTimeout(() => toast.error(`Failed to update password: ${errorMsg}`), 0);
        return { error: new Error(errorMsg) };
      }

      setTimeout(() => toast.success('Password changed successfully'), 0);
      return { error: null };
    } catch (error) {
      logError('Error changing password exception:', error, { context: 'changeOwnPassword' });
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setTimeout(() => toast.error(`Failed to change password: ${errorMessage}`), 0);
      return { error: error as Error };
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const userProfile = await fetchProfile(user.id);
    if (userProfile && mountedRef.current) {
      setProfile(userProfile);
    }
  }, [user, fetchProfile]);

  const refreshPermissions = useCallback(async () => {
    if (!user) return;

    try {
      const { data: permissionData, error: permissionError } = await supabase
        .from('user_permissions')
        .select('permission_name, granted')
        .eq('user_id', user.id);

      if (permissionError) {
        console.warn('Failed to refresh permissions:', permissionError.message);
        return;
      }

      if (mountedRef.current) {
        setPermissions(Object.fromEntries(
          (permissionData || []).map(permission => [permission.permission_name, permission.granted === true])
        ));
      }
    } catch (error) {
      console.warn('Unexpected error refreshing permissions:', error instanceof Error ? error.message : String(error));
    } finally {
      // Always resolve the gate, even when the query failed, so screens never
      // sit on a spinner or fall back to role defaults while waiting.
      if (mountedRef.current) setPermissionsReady(true);
    }
  }, [user]);

  // Keep this user's permission map in sync with user_permissions so overrides
  // granted by an admin appear in the sidebar without a fresh login.
  useEffect(() => {
    if (!user) return;

    // Fetch immediately: the initial profile load can time out and fall back to
    // a default profile with an empty permission map after a page refresh.
    refreshPermissions();

    const pollInterval = setInterval(() => {
      refreshPermissions();
    }, 30000);

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshPermissions();
    };
    window.addEventListener('focus', refreshOnVisible);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', refreshOnVisible);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [user, refreshPermissions]);

  const changeUserPassword = useCallback(async (userId: string, newPassword: string) => {
    try {
      console.log('[changeUserPassword] starting', { userId });
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[changeUserPassword] session resolved', { hasSession: !!session });

      if (!session) {
        const errorMsg = 'Not authenticated. Please sign in again.';
        setTimeout(() => toast.error(errorMsg), 0);
        return { error: new Error(errorMsg) };
      }

      const invokeStarted = Date.now();
      const invokePromise = supabase.functions.invoke('change-user-password', {
        body: {
          userId,
          newPassword,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Password service timed out after 15 seconds')), 15000);
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      console.log(`[changeUserPassword] edge function responded in ${Date.now() - invokeStarted}ms`, { error, data });

      // Edge functions that omit Content-Type arrive as a JSON string
      let result = data;
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch {
          result = null;
        }
      }

      if (error) {
        logError('Error changing user password:', error, { context: 'changeUserPassword', targetUserId: userId, errorDetails: String(error) });

        const rawMessage = error?.message || '';
        const isServiceUnavailable =
          error?.name === 'FunctionsFetchError' ||
          /failed to send a request|failed to fetch|networkerror|load failed/i.test(rawMessage);

        if (isServiceUnavailable) {
          const unavailableMsg = 'Password service is unavailable. Ask an administrator to deploy the change-user-password function.';
          setTimeout(() => toast.error(unavailableMsg), 0);
          return { error: new Error(unavailableMsg) };
        }

        let errorMessage = formatErrorForDisplay(error);
        if (!errorMessage || errorMessage === 'An unexpected error occurred') {
          errorMessage = 'Failed to send request to edge function. Please try again.';
        }
        setTimeout(() => toast.error(`Failed to change password: ${errorMessage}`), 0);
        return { error: new Error(errorMessage) };
      }

      if (result?.success) {
        setTimeout(() => toast.success('Password changed successfully'), 0);
        return { error: null };
      } else {
        const errorMsg = result?.error || 'Failed to change password';
        setTimeout(() => toast.error(errorMsg), 0);
        return { error: new Error(errorMsg) };
      }
    } catch (error) {
      logError('Error changing user password exception:', error, { context: 'changeUserPassword', targetUserId: userId });
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('💥 Unexpected error:', {
        message: errorMessage,
        error
      });
      setTimeout(() => toast.error(`Failed to change password: ${errorMessage}`), 0);
      return { error: error as Error };
    }
  }, []);

  // Add function to manually clear tokens
  const clearTokens = useCallback(() => {
    clearAuthTokens();
    setUser(null);
    setProfile(null);
    setPermissions({});
    setPermissionsReady(false);
    setProfileReady(true);
    setSession(null);
    toast.info('Authentication tokens cleared. Please sign in again.');
  }, []);

  // Compute derived state
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === 'admin';

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading: loading && !forceCompletedRef.current,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    changeOwnPassword,
    changeUserPassword,
    isAuthenticated,
    isAdmin,
    refreshProfile,
    refreshPermissions,
    clearTokens,
    permissions,
    profileReady,
    permissionsReady,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
