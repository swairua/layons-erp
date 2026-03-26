import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Component, ReactNode, ErrorInfo } from "react";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useCurrentCompany } from "@/contexts/CompanyContext";
import { setFavicon } from "@/utils/setFavicon";
import { updateMetaTags } from "@/utils/updateMetaTags";
import { verifyInvoiceCompanyIdColumn } from "@/utils/fixMissingInvoiceCompanyId";
import { verifyInvoiceRLSFix } from "@/utils/fixInvoiceRLSPolicy";
import { verifyRLSDisabled } from "@/utils/disableInvoiceRLS";
import { fixRLSWithProperOrder, verifyRLSColumnFix } from "@/utils/fixRLSProperOrder";
import { fixQuotationsRLS, verifyQuotationsRLS } from "@/utils/fixQuotationsRLS";

// Lazy load the page components to reduce initial bundle size and startup time
import { lazy, Suspense } from "react";

const Index = lazy(() => import("./pages/Index"));
const Quotations = lazy(() => import("./pages/Quotations"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Payments = lazy(() => import("./pages/Payments"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Customers = lazy(() => import("./pages/Customers"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const Proforma = lazy(() => import("./pages/Proforma"));
const SalesReports = lazy(() => import("./pages/reports/SalesReports"));
const InventoryReports = lazy(() => import("./pages/reports/InventoryReports"));
const StatementOfAccounts = lazy(() => import("./pages/reports/StatementOfAccounts"));
const CompanySettings = lazy(() => import("./pages/settings/CompanySettings"));
const UserManagement = lazy(() => import("./pages/settings/UserManagement"));
const UnitsSettings = lazy(() => import("./pages/settings/Units"));
const UnitsNormalize = lazy(() => import("./pages/settings/UnitsNormalize"));
const RemittanceAdvice = lazy(() => import("./pages/RemittanceAdvice"));
const LPOs = lazy(() => import("./pages/LPOs"));
const BOQs = lazy(() => import("./pages/BOQs"));
const FixedBOQ = lazy(() => import("./pages/FixedBOQ"));
const CreditNotes = lazy(() => import("./pages/CreditNotes"));
const CashReceipts = lazy(() => import("./pages/CashReceipts"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaymentSynchronizationPage = lazy(() => import("./pages/PaymentSynchronization"));
const OptimizedInventory = lazy(() => import("./pages/OptimizedInventory"));
const PerformanceOptimizerPage = lazy(() => import("./pages/PerformanceOptimizerPage"));
const OptimizedCustomers = lazy(() => import("./pages/OptimizedCustomers"));
const CustomerPerformanceOptimizerPage = lazy(() => import("./pages/CustomerPerformanceOptimizerPage"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const DatabaseFix = lazy(() => import("./pages/DatabaseFix"));

// Error boundary class component to catch module loading errors
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);

    // Check if this is a module loading error
    const isModuleError =
      error.message.includes('dynamically imported module') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('network');

    if (isModuleError) {
      console.warn('⚠️ Module loading error detected - attempting recovery');
      console.warn('Error details:', error.message);
      console.warn('This may be due to:');
      console.warn('1. Network connectivity issues');
      console.warn('2. Browser cache issues');
      console.warn('3. Dev server configuration issues');

      // Clear service worker cache if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister());
        }).catch(err => console.warn('Could not clear service workers:', err));
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return <ModuleErrorFallback />;
    }

    return this.props.children;
  }
}

// Error recovery component for module loading failures
const ModuleErrorFallback = () => {
  const [retryCount, setRetryCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    window.location.reload();
  };

  const handleHardRefresh = async () => {
    setIsClearing(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Force hard refresh (Ctrl+Shift+R equivalent)
      window.location.reload(true);
    } catch (err) {
      console.error('Error clearing cache:', err);
      // Fallback to normal reload
      window.location.reload();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full p-6 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Module Loading Error</h1>
          <p className="text-muted-foreground">
            There was an issue loading the page content. This can happen if the connection was interrupted or your browser cache is outdated.
          </p>
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded p-4">
          <p className="text-sm text-destructive/80 font-medium mb-2">Troubleshooting steps:</p>
          <ul className="text-xs text-destructive/70 space-y-1">
            <li>• Check your internet connection</li>
            <li>• Try a hard refresh (Ctrl+Shift+R)</li>
            <li>• Clear your browser cache</li>
            <li>• Try a different browser</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={isClearing}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
          >
            {isClearing ? 'Clearing cache...' : 'Hard Refresh (Clear Cache)'}
          </button>
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors font-medium"
          >
            Soft Refresh
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors font-medium"
          >
            Go to Home Page
          </button>
        </div>

        {retryCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Refresh attempts: {retryCount}
          </p>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const { currentCompany } = useCurrentCompany();

  useEffect(() => {
    // Initialize on app startup
    // Non-blocking async initialization
    (async () => {
      try {
        // Check if RLS is properly disabled (fixes infinite recursion)
        const rslDisabled = await verifyRLSDisabled();
        if (!rslDisabled) {
          console.error('❌ RLS RECURSION ERROR DETECTED');
          console.error('The database has RLS policies that cause infinite recursion.');
          console.error('');
          console.error('📋 IMMEDIATE FIX REQUIRED:');
          console.error('1. Open your Supabase Dashboard');
          console.error('2. Go to SQL Editor');
          console.error('3. Copy and run the SQL from: FINAL_RLS_RECURSION_FIX.sql');
          console.error('4. Then refresh this page');
          console.error('');
          console.error('OR use the ManualSQLSetup page at /setup-test');
        } else {
          console.log('✅ RLS check passed - database is accessible');
        }

        // Verify invoices table is accessible
        // Note: company_id column may not exist - invoices are linked through customers
        try {
          const companyIdExists = await verifyInvoiceCompanyIdColumn();
          if (!companyIdExists) {
            console.warn('⚠️ invoices table verification issue - attempting to continue');
          }
        } catch (err) {
          console.warn('⚠️ could not verify invoices table - will attempt normal operation', err);
        }

        // Fix RLS policy for invoice deletion (handles company_id column issue)
        try {
          const isFixed = await verifyRLSColumnFix();
          if (!isFixed) {
            console.log('🔧 RLS column issue detected. Attempting to fix (disable → add column → re-enable)...');
            const fixResult = await fixRLSWithProperOrder();
            if (fixResult.success) {
              console.log('✅ RLS column fix applied successfully');
            } else if (fixResult.requiresManualFix) {
              console.warn('⚠️ Manual RLS fix required. User will see a fix dialog when they try to delete an invoice.');
            }
          } else {
            console.log('✅ RLS column verification passed - database is ready');
          }
        } catch (err) {
          console.warn('⚠️ Could not automatically fix RLS column issue', err);
        }

        // Verify invoice RLS policy doesn't have infinite recursion
        await verifyInvoiceRLSFix();

        // Fix quotations RLS policy issue
        try {
          const quotationsRLSFixed = await verifyQuotationsRLS();
          if (!quotationsRLSFixed) {
            console.log('🔧 Quotations RLS issue detected. Attempting to fix...');
            const fixResult = await fixQuotationsRLS();
            if (fixResult.success) {
              console.log('✅ Quotations RLS fix applied successfully');
            } else if (fixResult.requiresManualFix) {
              console.warn('⚠️ Manual quotations RLS fix required. Please run the SQL in Supabase.');
            }
          } else {
            console.log('✅ Quotations RLS verification passed');
          }
        } catch (err) {
          console.warn('⚠️ Could not automatically fix quotations RLS issue', err);
        }
      } catch (error) {
        console.warn('Database schema verification completed with issues (non-critical)', error);
      }
    })();
  }, []);

  useEffect(() => {
    // Update favicon when company logo changes
    setFavicon(currentCompany?.logo_url);
  }, [currentCompany?.logo_url]);

  useEffect(() => {
    // Update meta tags when company details change
    updateMetaTags(currentCompany);
  }, [currentCompany]);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Routes>
          {/* Dashboard */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } 
          />

          {/* Sales & Customer Management */}
          <Route 
            path="/quotations" 
            element={
              <ProtectedRoute>
                <Quotations />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/quotations/new" 
            element={
              <ProtectedRoute>
                <Quotations />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/customers" 
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/customers/new" 
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            } 
          />

          {/* Financial Management */}
          <Route 
            path="/invoices" 
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/invoices/new"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cash-receipts"
            element={
              <ProtectedRoute>
                <CashReceipts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cash-receipts/new"
            element={
              <ProtectedRoute>
                <CashReceipts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments" 
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/payments/new"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receipts"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-notes" 
            element={
              <ProtectedRoute>
                <CreditNotes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/credit-notes/new" 
            element={
              <ProtectedRoute>
                <CreditNotes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/proforma" 
            element={
              <ProtectedRoute>
                <Proforma />
              </ProtectedRoute>
            } 
          />

          {/* Procurement & Inventory */}
          <Route
            path="/boqs"
            element={
              <ProtectedRoute>
                <BOQs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fixed-boq"
            element={
              <ProtectedRoute>
                <FixedBOQ />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lpos"
            element={
              <ProtectedRoute>
                <LPOs />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/lpos/new" 
            element={
              <ProtectedRoute>
                <LPOs />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/inventory/new" 
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/delivery-notes" 
            element={
              <ProtectedRoute>
                <DeliveryNotes />
              </ProtectedRoute>
            } 
          />

          {/* Additional Features */}
          <Route 
            path="/remittance" 
            element={
              <ProtectedRoute>
                <RemittanceAdvice />
              </ProtectedRoute>
            } 
          />

          {/* Reports */}
          <Route 
            path="/reports/sales" 
            element={
              <ProtectedRoute>
                <SalesReports />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports/inventory" 
            element={
              <ProtectedRoute>
                <InventoryReports />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports/statements" 
            element={
              <ProtectedRoute>
                <StatementOfAccounts />
              </ProtectedRoute>
            } 
          />

          {/* Settings */}
          <Route
            path="/settings/company"
            element={
              <ProtectedRoute>
                <CompanySettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/units"
            element={
              <ProtectedRoute>
                <UnitsSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/units/normalize"
            element={
              <ProtectedRoute>
                <UnitsNormalize />
              </ProtectedRoute>
            }
          />

          {/* Database Fix - No protection needed (for troubleshooting) */}
          <Route path="/database-fix" element={<DatabaseFix />} />

          {/* Audit Logs */}
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Payment Synchronization - No protection needed for setup */}
          <Route path="/payment-sync" element={<PaymentSynchronizationPage />} />


          {/* Optimized Inventory - Performance-optimized inventory page */}
          <Route
            path="/optimized-inventory"
            element={
              <ProtectedRoute>
                <OptimizedInventory />
              </ProtectedRoute>
            }
          />

          {/* Performance Optimizer - Database and inventory performance optimization */}
          <Route path="/performance-optimizer" element={<PerformanceOptimizerPage />} />


          {/* Optimized Customers - Performance-optimized customers page */}
          <Route
            path="/optimized-customers"
            element={
              <ProtectedRoute>
                <OptimizedCustomers />
              </ProtectedRoute>
            }
          />

          {/* Customer Performance Optimizer - Database and customer performance optimization */}
          <Route path="/customer-performance-optimizer" element={<CustomerPerformanceOptimizerPage />} />




          {/* 404 Page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </Layout>
    </TooltipProvider>
  );
};

export default App;
