import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { EnhancedLogin } from '@/components/auth/EnhancedLogin';
import { clearAuthTokens } from '@/utils/authHelpers';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [loadingStartTime] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showStuckRecovery, setShowStuckRecovery] = useState(false);

  // Safety net: if the app is ever stuck in the loading+authenticated state
  // for an extended period, surface a manual reset so the user is never trapped.
  useEffect(() => {
    if (loading && isAuthenticated) {
      const timer = setTimeout(() => setShowStuckRecovery(true), 6000);
      return () => {
        clearTimeout(timer);
        setShowStuckRecovery(false);
      };
    }
    setShowStuckRecovery(false);
  }, [loading, isAuthenticated]);

  // Routes that don't require authentication
  const publicRoutes = ['/auth-test', '/manual-setup', '/database-fix-page', '/auto-fix', '/audit', '/auto-payment-sync', '/payment-sync', '/admin-recreate'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  // Prefetch data for child pages once company is known
  const queryClient = useQueryClient();
  const { currentCompany } = useCurrentCompany();

  useEffect(() => {
    const cId = currentCompany?.id;
    if (!cId || !isAuthenticated) return;

    queryClient.prefetchQuery({
      queryKey: ['units', cId],
      queryFn: async () => {
        const { data } = await supabase.from('units').select('*').eq('company_id', cId).order('name', { ascending: true });
        return data || [];
      },
      staleTime: 5 * 60_000,
    });
  }, [currentCompany?.id, isAuthenticated, queryClient]);

  // Show login when auth init is complete and user is not authenticated
  if (!loading && !isAuthenticated && !isPublicRoute) {
    return <EnhancedLogin />;
  }

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">App appears to be stuck in loading state...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mt-4"></div>
          {showStuckRecovery && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                The app is taking too long to respond. You can reset your session to continue.
              </p>
              <Button
                variant="default"
                onClick={() => {
                  clearAuthTokens();
                  window.location.reload();
                }}
              >
                Reset session and reload
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show loading spinner if loading and no authentication state yet
  if (loading) {
    const loadingDuration = Math.floor((Date.now() - loadingStartTime) / 1000);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-2 w-full max-w-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium text-foreground">Starting up...</p>
          <p className="text-sm text-muted-foreground">This should only take a moment</p>
          {loadingDuration > 2 && (
            <p className="text-sm text-muted-foreground mt-2">Almost ready...</p>
          )}
        </div>
      </div>
    );
  }

  // Show simple layout for public routes
  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-background">
        <main className="w-full">
          {children}
        </main>
      </div>
    );
  }

  // Show authenticated layout
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar isMobile={false} isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="md:hidden">
        <Sidebar
          isMobile={true}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
