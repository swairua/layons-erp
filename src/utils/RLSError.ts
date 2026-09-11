/**
 * Custom error class for RLS policy issues
 * Used to identify and handle RLS problems separately from other database errors
 */
export class RLSPolicyError extends Error {
  public readonly isRLSError = true;
  public readonly requiresFix: boolean;

  constructor(
    message: string,
    requiresFix: boolean = true
  ) {
    super(message);
    this.name = 'RLSPolicyError';
    this.requiresFix = requiresFix;
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, RLSPolicyError.prototype);
  }
}

/**
 * Check if an error is an RLS policy error
 */
export function isRLSError(error: unknown): error is RLSPolicyError {
  if (error instanceof RLSPolicyError) {
    return true;
  }
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('row level security') || 
           msg.includes('violates policy') ||
           msg.includes('permission denied') ||
           msg.includes('insufficient privilege');
  }
  
  return false;
}

/**
 * Extract RLS error details from a Supabase error
 */
export function extractRLSErrorDetails(error: any): { type: string; message: string } {
  const fullError = JSON.stringify(error);
  const msgLower = (error?.message || '').toLowerCase();

  if (msgLower.includes('company_id') && msgLower.includes('does not exist')) {
    return {
      type: 'MISSING_COLUMN',
      message: 'The invoices table is missing the company_id column that RLS policies reference',
    };
  }

  if (msgLower.includes('company_id') || msgLower.includes('has no field')) {
    return {
      type: 'RLS_COLUMN_REFERENCE',
      message: 'RLS policy references a non-existent column',
    };
  }

  if (msgLower.includes('policy') || msgLower.includes('rls')) {
    return {
      type: 'RLS_POLICY_ERROR',
      message: 'RLS policy is preventing this operation',
    };
  }

  if (msgLower.includes('permission denied') || msgLower.includes('insufficient privilege')) {
    return {
      type: 'PERMISSION_DENIED',
      message: 'Permission denied due to RLS policy',
    };
  }

  return {
    type: 'UNKNOWN_RLS_ERROR',
    message: error?.message || 'An RLS-related error occurred',
  };
}
