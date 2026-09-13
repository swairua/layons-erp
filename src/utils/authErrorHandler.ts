import { AuthError } from '@supabase/supabase-js';
import { toast } from '@/utils/safeToast';
import { logError } from '@/utils/errorLogger';
import { parseErrorMessage } from '@/utils/errorHelpers';

export interface AuthErrorInfo {
  type: 'invalid_credentials' | 'email_not_confirmed' | 'network_error' | 'rate_limit' | 'server_error' | 'unknown';
  message: string;
  action?: string;
  retry?: boolean;
}

const NON_MEANINGFUL_MESSAGES = new Set(['', '[object object]', 'null', 'undefined']);

const sanitizeAuthMessage = (error: AuthError | Error | any): string => {
  try {
    const candidates: string[] = [];

    // Handle string errors directly
    if (typeof error === 'string') {
      const trimmed = error.trim();
      if (trimmed && trimmed !== '[object Object]') {
        candidates.push(trimmed);
      }
    }

    // Handle Error instances
    if (error instanceof Error) {
      if (error.message && typeof error.message === 'string') {
        const trimmed = error.message.trim();
        if (trimmed && trimmed !== '[object Object]') {
          candidates.push(trimmed);
        }
      }
      // Also try name + message if message alone is empty
      if (error.name && typeof error.name === 'string' && (!error.message || !error.message.trim())) {
        candidates.push(error.name);
      }
    }

    // Handle objects (AuthError, plain objects, etc.)
    if (error && typeof error === 'object') {
      const authError = error as any;

      // Try multiple property names that Supabase might use
      const messageSources = [
        authError.message,
        authError.error_description,
        authError.error_message,
        authError.details,
        authError.hint,
        authError.msg,
        authError.error,
      ];

      for (const source of messageSources) {
        if (typeof source === 'string') {
          const trimmed = source.trim();
          if (trimmed && trimmed !== '[object Object]' && !candidates.includes(trimmed)) {
            candidates.push(trimmed);
          }
        } else if (source && typeof source === 'object') {
          // If source is an object, try to stringify it safely
          try {
            const stringified = JSON.stringify(source);
            if (stringified && stringified !== '{}' && stringified !== '[object Object]') {
              candidates.push(stringified);
            }
          } catch {
            // Skip if stringify fails
          }
        }
      }
    }

    // Filter out non-meaningful candidates
    const meaningfulCandidate = candidates.find(candidate => {
      if (!candidate) return false;
      const normalized = String(candidate).trim().toLowerCase();
      return normalized && !NON_MEANINGFUL_MESSAGES.has(normalized) && normalized !== '[object object]';
    });

    if (meaningfulCandidate) {
      return meaningfulCandidate.trim();
    }

    // Fallback to parseErrorMessage which has additional safeguards
    const parsed = parseErrorMessage(error);
    const safeParsed = typeof parsed === 'string' ? parsed : String(parsed || '');
    const normalizedParsed = safeParsed.trim().toLowerCase();

    if (!NON_MEANINGFUL_MESSAGES.has(normalizedParsed) && normalizedParsed !== '[object object]') {
      const trimmedParsed = safeParsed.trim();
      if (trimmedParsed && trimmedParsed !== '[object Object]') {
        return trimmedParsed;
      }
    }

    return 'An unexpected authentication error occurred';
  } catch (sanitizeError) {
    console.error('Error sanitizing auth message:', sanitizeError);
    return 'An unexpected authentication error occurred';
  }
};

export function analyzeAuthError(error: AuthError | Error): AuthErrorInfo {
  const errorMessage = sanitizeAuthMessage(error);

  // Ensure errorMessage is a string
  const safeMessage = typeof errorMessage === 'string' ? errorMessage : String(errorMessage || '');
  const message = safeMessage.toLowerCase().trim();

  // Prevent empty messages from proceeding
  if (!message || message === '[object object]') {
    return {
      type: 'unknown',
      message: 'An unexpected authentication error occurred',
      action: 'Please try again or contact support if the problem persists',
      retry: true
    };
  }

  if (message.includes('invalid login credentials')) {
    return {
      type: 'invalid_credentials',
      message: 'Invalid email or password',
      action: 'Check your credentials or create an admin account using the setup above'
    };
  }

  if (message.includes('email not confirmed')) {
    return {
      type: 'email_not_confirmed',
      message: 'Email address needs to be confirmed',
      action: 'Check your email for a confirmation link'
    };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return {
      type: 'network_error',
      message: 'Network connection error',
      action: 'Check your internet connection and try again',
      retry: true
    };
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return {
      type: 'rate_limit',
      message: 'Too many login attempts',
      action: 'Please wait a few minutes before trying again',
      retry: true
    };
  }

  if (message.includes('server') || message.includes('500')) {
    return {
      type: 'server_error',
      message: 'Server error occurred',
      action: 'Please try again in a few moments',
      retry: true
    };
  }

  // Use the safe message directly if it's meaningful
  const finalMessage = NON_MEANINGFUL_MESSAGES.has(message)
    ? 'An unexpected authentication error occurred'
    : safeMessage.trim();

  // Ensure it's a non-empty string
  const displayMessage = (finalMessage && finalMessage !== '[object Object]')
    ? finalMessage
    : 'An unexpected authentication error occurred';

  return {
    type: 'unknown',
    message: displayMessage,
    action: 'Please try again or contact support if the problem persists',
    retry: true
  };
}

export function handleAuthError(error: AuthError | Error): AuthErrorInfo {
  const errorInfo = analyzeAuthError(error);

  // Log for debugging using structured logger with detailed error info
  logError('Authentication error', error, {
    parsed: errorInfo,
    errorDetails: {
      message: error?.message || 'No message',
      code: (error as any)?.code,
      status: (error as any)?.status,
      statusCode: (error as any)?.statusCode,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      originalError: String(error)
    }
  });

  // Triple-check that message is definitely a string
  let messageToShow = 'An unexpected authentication error occurred';
  if (errorInfo.message) {
    if (typeof errorInfo.message === 'string') {
      messageToShow = errorInfo.message.trim();
      // Prevent "[object Object]" from being displayed
      if (messageToShow === '[object Object]' || !messageToShow) {
        messageToShow = 'An unexpected authentication error occurred';
      }
    } else {
      // If message is somehow not a string, convert it
      const stringified = String(errorInfo.message);
      if (stringified && stringified !== '[object Object]') {
        messageToShow = stringified;
      }
    }
  }

  let descriptionToShow: string | undefined;
  if (errorInfo.action) {
    if (typeof errorInfo.action === 'string') {
      descriptionToShow = errorInfo.action.trim();
      if (descriptionToShow === '[object Object]' || !descriptionToShow) {
        descriptionToShow = undefined;
      }
    } else {
      const stringified = String(errorInfo.action);
      if (stringified && stringified !== '[object Object]') {
        descriptionToShow = stringified;
      }
    }
  }

  // Show appropriate toast with guaranteed string values
  if (errorInfo.retry) {
    toast.error(messageToShow, {
      description: descriptionToShow,
      duration: 5000
    });
  } else {
    toast.error(messageToShow, {
      description: descriptionToShow,
      duration: 8000
    });
  }

  return errorInfo;
}
