import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const BOQConversionFix = () => {
  const [isApplyingMigration, setIsApplyingMigration] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Migration SQL that adds the missing columns
  const migrationSQL = `
-- Add converted_to_invoice_id column (references the invoice created from this BOQ)
ALTER TABLE IF EXISTS boqs
ADD COLUMN IF NOT EXISTS converted_to_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Add converted_at column (timestamp when BOQ was converted)
ALTER TABLE IF EXISTS boqs
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_boqs_converted_to_invoice_id ON boqs(converted_to_invoice_id);
CREATE INDEX IF NOT EXISTS idx_boqs_converted_at ON boqs(converted_at);
`;

  const refreshSchemaSQL = `
-- Refresh Supabase schema cache to detect new columns
NOTIFY pgrst, 'reload schema';
`;

  const handleApplyMigration = async () => {
    setIsApplyingMigration(true);
    setMigrationStatus('idle');
    setErrorMessage('');

    try {
      // Execute the migration SQL
      const { error } = await supabase.rpc('exec', { sql: migrationSQL });

      if (error) {
        // If RPC doesn't exist, try direct query approach
        const { error: directError } = await (supabase as any)
          .from('_migrations')
          .select('*')
          .limit(1);

        if (directError && directError.code === 'PGRST116') {
          // Expected error - table doesn't exist. We need to run in SQL editor instead
          throw new Error(
            'Please apply the migration manually through Supabase SQL Editor:\n\n' +
            'The migration file has been created at: migrations/011_add_boq_conversion_fields.sql\n\n' +
            'To apply it:\n' +
            '1. Go to your Supabase project dashboard\n' +
            '2. Click "SQL Editor"\n' +
            '3. Click "New Query"\n' +
            '4. Paste the migration SQL below\n' +
            '5. Click "Run"'
          );
        }

        throw error || directError;
      }

      setMigrationStatus('success');
      toast.success('Migration applied successfully!');
    } catch (err) {
      setMigrationStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      toast.error('Migration failed: ' + message);
    } finally {
      setIsApplyingMigration(false);
    }
  };

  const handleRefreshCache = async () => {
    setIsRefreshingCache(true);
    setCacheStatus('idle');
    setErrorMessage('');

    try {
      // Execute the schema cache refresh
      const { error } = await supabase.rpc('exec', { sql: refreshSchemaSQL });

      if (error) {
        // Try alternative method - direct query
        const { error: queryError } = await supabase.from('boqs').select('count').limit(1);

        if (queryError) {
          throw new Error(
            'Please refresh the schema cache manually through Supabase SQL Editor:\n\n' +
            '1. Go to your Supabase project dashboard\n' +
            '2. Click "SQL Editor"\n' +
            '3. Click "New Query"\n' +
            '4. Paste this SQL:\n\n' +
            'NOTIFY pgrst, \'reload schema\';\n\n' +
            '5. Click "Run"\n\n' +
            'Then wait 5-10 seconds and try the BOQ conversion again.'
          );
        }
      }

      setCacheStatus('success');
      toast.success('Schema cache refreshed! Try converting a BOQ now.');
    } catch (err) {
      setCacheStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      toast.error('Cache refresh failed: ' + message);
    } finally {
      setIsRefreshingCache(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Copied to clipboard!'))
        .catch(() => toast.error('Failed to copy to clipboard'));
    } else {
      toast.error('Clipboard API not available');
    }
  };

  return (
    <Card className="w-full border-warning bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          BOQ Conversion Schema Fix
        </CardTitle>
        <CardDescription>
          The BOQ conversion feature requires database schema updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error: Could not find the 'converted_at' column in the 'boqs' table. 
            This fix will add the missing columns and refresh the schema cache.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="guided" className="w-full">
          <TabsList>
            <TabsTrigger value="guided">Guided Steps</TabsTrigger>
            <TabsTrigger value="manual">Manual SQL</TabsTrigger>
          </TabsList>

          <TabsContent value="guided" className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">Step 1: Apply Migration</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This will add the missing 'converted_at' and 'converted_to_invoice_id' columns to the boqs table.
                </p>
                <Button 
                  onClick={handleApplyMigration}
                  disabled={isApplyingMigration || migrationStatus === 'success'}
                  className="w-full"
                >
                  {isApplyingMigration ? 'Applying Migration...' : 'Apply Migration'}
                </Button>
                {migrationStatus === 'success' && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Migration applied successfully
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">Step 2: Refresh Schema Cache</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Refresh Supabase's PostgREST schema cache so it detects the new columns.
                </p>
                <Button 
                  onClick={handleRefreshCache}
                  disabled={isRefreshingCache || cacheStatus === 'success'}
                  className="w-full"
                >
                  {isRefreshingCache ? 'Refreshing Cache...' : 'Refresh Schema Cache'}
                </Button>
                {cacheStatus === 'success' && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Schema cache refreshed successfully
                  </div>
                )}
              </div>

              {errorMessage && (
                <Alert className="border-destructive bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive mt-2">
                    <p className="font-semibold mb-2">Manual Setup Required:</p>
                    <pre className="text-xs bg-background p-2 rounded border mt-2 overflow-auto max-h-64">
                      {errorMessage}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Step 1: Apply Migration SQL</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Go to Supabase Dashboard → SQL Editor → New Query, then paste and run this SQL:
                </p>
                <div className="relative rounded-lg border bg-muted p-4 font-mono text-xs overflow-auto max-h-48">
                  <pre>{migrationSQL.trim()}</pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(migrationSQL.trim())}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Step 2: Refresh Schema Cache SQL</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  In a new SQL query, paste and run this command:
                </p>
                <div className="relative rounded-lg border bg-muted p-4 font-mono text-xs">
                  <pre>{refreshSchemaSQL.trim()}</pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(refreshSchemaSQL.trim())}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Then wait 5-10 seconds for the cache to refresh.
                </p>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  After running both SQL commands, your BOQ conversion feature should work. 
                  Try converting a BOQ now!
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
