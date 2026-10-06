import { supabase } from '@/integrations/supabase/client';
import { getAllowedFeatures, ALL_FEATURE_KEYS } from '@/utils/rolePermissions';
import type { UserRole } from '@/utils/rolePermissions';

export interface PermissionSaveError {
  code: string;
  message: string;
  details?: string;
}

export interface PermissionSaveResult {
  success: boolean;
  error?: PermissionSaveError;
  rowsDeleted?: number;
  rowsInserted?: number;
}

interface PermissionFunctionResponse {
  success?: boolean;
  error?: string;
  rowsDeleted?: number;
  rowsInserted?: number;
}

/**
 * Compute the overrides that actually differ from the role defaults.
 * Entries that match the role default are dropped so only meaningful
 * overrides are persisted.
 */
function computeEffectiveOverrides(
  overrides: Record<string, boolean>,
  userRole: UserRole
): { permission_name: string; granted: boolean }[] {
  const defaults = new Set<string>(getAllowedFeatures(userRole));
  const validKeys = new Set<string>(ALL_FEATURE_KEYS);
  return Object.entries(overrides)
    .filter(([permissionName, granted]) => validKeys.has(permissionName) && granted !== defaults.has(permissionName))
    .map(([permission_name, granted]) => ({ permission_name, granted }));
}

export async function saveUserPermissions(
  userId: string,
  overrides: Record<string, boolean>,
  userRole: UserRole
): Promise<PermissionSaveResult> {
  const edgeResult = await invokeEdgeFunction(userId, overrides, userRole);

  if (edgeResult.success) return edgeResult;

  // If the edge function is unavailable (not deployed / unreachable),
  // fall back to direct database writes which are allowed by the
  // "Admins can manage permissions in their company" RLS policy.
  if (edgeResult.error?.code === 'SAVE_SERVICE_UNAVAILABLE') {
    return saveViaDirectDb(userId, overrides, userRole);
  }

  return edgeResult;
}

async function invokeEdgeFunction(
  userId: string,
  overrides: Record<string, boolean>,
  userRole: UserRole
): Promise<PermissionSaveResult> {
  const effective = computeEffectiveOverrides(overrides, userRole);
  // The edge function expects a Record<string, boolean>; the DB fallback
  // (and computeEffectiveOverrides) use the array form.
  const payload = Object.fromEntries(effective.map(e => [e.permission_name, e.granted]));

  const { data, error } = (await supabase.functions.invoke('save-user-permissions', {
    body: { userId, overrides: payload },
  })) as {
    data: unknown;
    error: { name?: string; message?: string; context?: Response } | null;
  };

  // Edge functions that omit Content-Type arrive as a JSON string
  let result: PermissionFunctionResponse | null = null;
  if (typeof data === 'string') {
    try {
      result = JSON.parse(data) as PermissionFunctionResponse;
    } catch {
      result = null;
    }
  } else if (data) {
    result = data as PermissionFunctionResponse;
  }

  if (error) {
    const message = error.message || '';
    const isUnavailable = error.name === 'FunctionsFetchError' || message.toLowerCase().includes('failed to send a request');

    // Surface the function's own error body instead of the generic
    // "Edge Function returned a non-2xx status code".
    let serverMessage = message;
    if (error.context && typeof error.context.text === 'function') {
      try {
        const body = await error.context.text();
        const parsed = body ? (JSON.parse(body) as { error?: string }) : null;
        if (parsed?.error) serverMessage = parsed.error;
        else if (body) serverMessage = body;
      } catch {
        // keep the generic message
      }
    }

    return {
      success: false,
      error: {
        code: isUnavailable ? 'SAVE_SERVICE_UNAVAILABLE' : 'SAVE_FAILED',
        message: isUnavailable
          ? 'Permission service is unavailable. Ask an administrator to deploy the save-user-permissions function.'
          : serverMessage || 'Permission save failed',
      },
    };
  }

  if (!result?.success) {
    const rawError = result?.error;
    const message = typeof rawError === 'string' && rawError ? rawError : 'Permission save failed';
    const isAuthorizationError = /only admins|other companies|unauthorized/i.test(message);

    return {
      success: false,
      error: {
        code: isAuthorizationError ? 'SAVE_NOT_AUTHORIZED' : 'SAVE_FAILED',
        message: isAuthorizationError ? 'You are not authorized to change permissions for this user.' : message,
        details: message,
      },
    };
  }

  return {
    success: true,
    rowsDeleted: result.rowsDeleted,
    rowsInserted: result.rowsInserted,
  };
}

async function saveViaDirectDb(
  userId: string,
  overrides: Record<string, boolean>,
  userRole: UserRole
): Promise<PermissionSaveResult> {
  try {
    const effective = computeEffectiveOverrides(overrides, userRole);

    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    let rowsInserted = 0;
    if (effective.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('user_permissions')
        .insert(effective.map(p => ({ user_id: userId, permission_name: p.permission_name, granted: p.granted })))
        .select('id');

      if (insertError) throw insertError;
      rowsInserted = (inserted || []).length;
    }

    return {
      success: true,
      rowsDeleted: 0,
      rowsInserted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message,
        details: message,
      },
    };
  }
}
