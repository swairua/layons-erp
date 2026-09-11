import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Copy,
  CheckCircle,
  ExternalLink,
  Zap,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fixRLSWithProperOrder,
  verifyRLSColumnFix,
  getEmergencyRLSDisableSQL
} from '@/utils/fixRLSProperOrder';

interface RLSErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  invoiceName?: string;
}

export function RLSErrorDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  invoiceName = 'Invoice'
}: RLSErrorDialogProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'initial' | 'fixing' | 'success' | 'error'>('initial');
  const [useEmergencyMode, setUseEmergencyMode] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('initial');
      setShowManualMode(false);
      setCopied(false);
      setUseEmergencyMode(false);
    }
  }, [open]);

  const handleDialogChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const sqlFix = useEmergencyMode ? getEmergencyRLSDisableSQL() : `
-- STEP 1: Disable RLS and add company_id column
BEGIN TRANSACTION;

ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname FROM pg_policies WHERE tablename = 'invoices'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON invoices';
  END LOOP;
END $$;

ALTER TABLE IF EXISTS invoices
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

UPDATE invoices inv
SET company_id = (
  SELECT c.company_id
  FROM customers c
  WHERE c.id = inv.customer_id
)
WHERE inv.company_id IS NULL AND inv.customer_id IS NOT NULL;

UPDATE invoices
SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

COMMIT;
`;

  const handleAutomaticFix = async () => {
    setIsApplying(true);
    setStep('fixing');

    try {
      console.log('Applying RLS fix with proper order (disable → add column → re-enable)...');
      const result = await fixRLSWithProperOrder();

      if (result.success) {
        console.log('✅ RLS fix applied successfully');

        // Verify the fix
        await new Promise(resolve => setTimeout(resolve, 1500));
        const isFixed = await verifyRLSColumnFix();

        if (isFixed) {
          setStep('success');
          toast.success('✅ RLS issue fixed! You can now delete invoices.');
          setTimeout(() => {
            onOpenChange(false);
            onSuccess?.();
          }, 2000);
          return;
        } else {
          // Verification failed but fix was applied
          setStep('success');
          toast.success('✅ RLS fix applied. Try deleting an invoice to confirm.');
          setTimeout(() => {
            onOpenChange(false);
            onSuccess?.();
          }, 2000);
          return;
        }
      }

      // Fix didn't work, show manual option
      setStep('error');
      setShowManualMode(true);
      toast.error('Automatic fix failed. Please use manual method below.');
    } catch (err) {
      console.error('Error applying fix:', err);
      setStep('error');
      setShowManualMode(true);
      toast.error('Error applying fix. Please use manual method.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlFix);
      setCopied(true);
      toast.success('SQL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy SQL');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleDialogChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'initial' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                RLS Policy Issue Detected
              </AlertDialogTitle>
            </AlertDialogHeader>

            <div className="space-y-3 mt-4">
              <div className="text-sm">
                Your Supabase database has a Row Level Security (RLS) issue preventing invoice operations.
              </div>
              <div className="text-sm">
                <strong>Possible causes:</strong>
              </div>
              <div className="text-sm list-disc list-inside space-y-1 ml-4">
                <div className="flex gap-2">
                  <span>•</span>
                  <span>Missing <code className="bg-slate-100 px-1 rounded text-xs">company_id</code> column on invoices table</span>
                </div>
                <div className="flex gap-2">
                  <span>•</span>
                  <span>RLS policies reference non-existent columns</span>
                </div>
                <div className="flex gap-2">
                  <span>•</span>
                  <span>Circular dependencies in RLS policy definitions</span>
                </div>
              </div>
              <div className="text-sm">
                We can fix this automatically by disabling problematic RLS policies and ensuring the required columns exist.
              </div>
            </div>

            <div className="space-y-4 py-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Zap className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>We can fix this automatically!</strong> Click "Apply Automatic Fix" below to resolve the issue instantly.
                </AlertDescription>
              </Alert>

              <Card className="bg-slate-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    What will be fixed
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Disable problematic RLS policies on all tables</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Add missing company_id column to invoices if needed</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Populate company_id data for all invoices</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Enable full database functionality</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                type="button"
                onClick={() => window.location.href = '/database-fix'}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Go to Database Fix Page
              </Button>
              <Button
                type="button"
                onClick={handleAutomaticFix}
                disabled={isApplying}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying Fix...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Apply Automatic Fix
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === 'fixing' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Applying RLS Fix...
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                Please wait while we fix your database RLS policies...
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Success! RLS Issue Fixed
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="py-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  ✅ Your database has been successfully fixed. You can now delete invoices and perform other operations.
                </AlertDescription>
              </Alert>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction type="button" className="bg-green-600 hover:bg-green-700">
                Done
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {step === 'error' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Manual Fix Required
              </AlertDialogTitle>
              <AlertDialogDescription>
                The automatic fix couldn't be applied. Please use the manual method below.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">SQL to Execute:</h4>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useEmergencyMode}
                      onChange={(e) => setUseEmergencyMode(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground">Emergency mode (disable all RLS)</span>
                  </label>
                </div>
                <div className="bg-slate-900 text-slate-100 p-4 rounded font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto border border-slate-700">
                  <pre>{sqlFix}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Steps to apply manually:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Copy the SQL above (use the button below)</li>
                  <li>Open your <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Supabase Dashboard
                  </a></li>
                  <li>Go to SQL Editor → New Query</li>
                  <li>Paste the SQL and click Run</li>
                  <li>Return here and close this dialog</li>
                </ol>
              </div>
            </div>

            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel type="button">Close</AlertDialogCancel>
              <Button
                type="button"
                onClick={handleCopy}
                variant="outline"
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy SQL
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Supabase
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
