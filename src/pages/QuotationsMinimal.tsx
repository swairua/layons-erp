import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText } from 'lucide-react';
import { useQuotations } from '@/hooks/useDatabase';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function QuotationsMinimal() {
  const { profile } = useAuth();
  const { currentCompany } = useCurrentCompany();
  const { data: quotationResponse, isLoading, error } = useQuotations(currentCompany?.id);
  const quotations = Array.isArray(quotationResponse) ? quotationResponse : quotationResponse?.data ?? [];

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading quotations: {(error as any).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quotations</h1>
          <p className="text-muted-foreground">Create and manage quotations</p>
        </div>
        <Button className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Quotation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Quotations List</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading quotations...</p>
          ) : !quotations || quotations.length === 0 ? (
            <p className="text-muted-foreground">No quotations found</p>
          ) : (
            <div>
              <p>{quotations.length} quotations available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
