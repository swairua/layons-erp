import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface BOQSaveIndicatorProps {
  isSaving: boolean;
  lastSavedTime: string | null;
  hasUnsavedChanges: boolean;
  saveError?: string | null;
  isConflict?: boolean;
}

export function BOQSaveIndicator({
  isSaving,
  lastSavedTime,
  hasUnsavedChanges,
  saveError,
  isConflict = false,
}: BOQSaveIndicatorProps) {
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);

  useEffect(() => {
    if (hasUnsavedChanges && !isSaving && !saveError) {
      // Wait 1 second before showing "Autosaving in progress..." to avoid flicker
      // (the 5-second debounce timer is counting down)
      const timer = setTimeout(() => {
        setShowSavingIndicator(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowSavingIndicator(false);
    }
  }, [hasUnsavedChanges, isSaving, saveError]);

  if (saveError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600" title={saveError}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{isConflict ? 'Changed in another tab — close and reopen' : 'Save failed — will retry'}</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Saving draft...</span>
      </div>
    );
  }

  if (hasUnsavedChanges && showSavingIndicator) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600">
        <Clock className="h-4 w-4" />
        <span>Autosaving in progress...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <AlertCircle className="h-4 w-4" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSavedTime) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>Saved at {lastSavedTime}</span>
      </div>
    );
  }

  return null;
}
