import React from 'react';
import { AuditManagement } from '@/components/AuditManagement';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { hasFeature } from '@/utils/rolePermissions';
import type { UserRole } from '@/utils/rolePermissions';

export function AuditLogs() {
  const { user, profile, loading, isAdmin, permissions } = useAuth();

  // Show loading state while profile is being fetched
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return (
      <div className="space-y-6 p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            You must be signed in to access audit logs.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Audit Log Viewer</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              Please sign in to access audit logs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = (profile?.role || 'user') as UserRole;
  if (!hasFeature(role, 'audit-logs', permissions)) {
    return (
      <div className="space-y-6 p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            You don't have permission to access audit logs.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Audit Log Viewer</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              Audit logs contain sensitive information about user activities. Access is restricted to system administrators.
            </p>
            <p className="text-slate-600 mt-4">
              If you believe you should have access, please contact your system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AuditManagement />
    </div>
  );
}

export default AuditLogs;
