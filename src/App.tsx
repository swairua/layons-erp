import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PDFProgressDialog from "@/components/ui/PDFProgressDialog";
import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Component, ReactNode, ErrorInfo, ComponentType, lazy, Suspense } from "react";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useCurrentCompany } from "@/contexts/CompanyContext";
import { setFavicon } from "@/utils/setFavicon";
import { updateMetaTags } from "@/utils/updateMetaTags";

const lazyWithRetry = <T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
  retries = 2,
) =>
  lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  });

// Lazy load the page components to reduce initial bundle size and startup time
const Index = lazyWithRetry(() => import("./pages/Index"));
const Quotations = lazyWithRetry(() => import("./pages/Quotations"));
const Invoices = lazyWithRetry(() => import("./pages/Invoices"));
const Payments = lazyWithRetry(() => import("./pages/Payments"));
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const Customers = lazyWithRetry(() => import("./pages/Customers"));
const DeliveryNotes = lazyWithRetry(() => import("./pages/DeliveryNotes"));
const Proforma = lazyWithRetry(() => import("./pages/Proforma"));
const ReportsOverview = lazyWithRetry(() => import("./pages/reports/ReportsOverview"));
const SalesReports = lazyWithRetry(() => import("./pages/reports/SalesReports"));
const InventoryReports = lazyWithRetry(() => import("./pages/reports/InventoryReports"));
const StatementOfAccounts = lazyWithRetry(() => import("./pages/reports/StatementOfAccounts"));
const CompanySettings = lazyWithRetry(() => import("./pages/settings/CompanySettings"));
const UserManagement = lazyWithRetry(() => import("./pages/settings/UserManagement"));
const UserPermissions = lazyWithRetry(() => import("./pages/settings/UserPermissions"));
const UnitsSettings = lazyWithRetry(() => import("./pages/settings/Units"));
const UnitsNormalize = lazyWithRetry(() => import("./pages/settings/UnitsNormalize"));
const RemittanceAdvice = lazyWithRetry(() => import("./pages/RemittanceAdvice"));
const LPOs = lazyWithRetry(() => import("./pages/LPOs"));
const BOQs = lazyWithRetry(() => import("./pages/BOQs"));
const FixedBOQ = lazyWithRetry(() => import("./pages/FixedBOQ"));
const FixedBOQHierarchical = lazyWithRetry(() => import("./pages/FixedBOQHierarchical"));
const LCLTemplate = lazyWithRetry(() => import("./pages/LCLTemplate"));
const LCLBOQList = lazyWithRetry(() => import("./pages/LCLBOQList"));
const CreditNotes = lazyWithRetry(() => import("./pages/CreditNotes"));
const CashReceipts = lazyWithRetry(() => import("./pages/CashReceipts"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const PaymentSynchronizationPage = lazyWithRetry(() => import("./pages/PaymentSynchronization"));
const OptimizedInventory = lazyWithRetry(() => import("./pages/OptimizedInventory"));
const PerformanceOptimizerPage = lazyWithRetry(() => import("./pages/PerformanceOptimizerPage"));
const OptimizedCustomers = lazyWithRetry(() => import("./pages/OptimizedCustomers"));
const CustomerPerformanceOptimizerPage = lazyWithRetry(() => import("./pages/CustomerPerformanceOptimizerPage"));
const AuditLogs = lazyWithRetry(() => import("./pages/AuditLogs"));
const DatabaseFix = lazyWithRetry(() => import("./pages/DatabaseFix"));
const CompanyIdConsolidation = lazyWithRetry(() => import("./pages/CompanyIdConsolidation"));

export type AppErrorKind = 'module' | 'render';

const isLazyModuleError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return error.name === 'ChunkLoadError' ||
    message.includes('dynamically imported module') ||
    message.includes('failed to fetch dynamically imported') ||
    message.includes('importing a module script failed') ||
    message.includes('loading chunk');
};

// Error boundary class component to catch module loading and render errors
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; errorKind: AppErrorKind | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorKind: null };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
      errorKind: isLazyModuleError(error) ? 'module' : 'render',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorKind = isLazyModuleError(error) ? 'module' : 'render';
    console.error('[AppErrorBoundary] Application error', {
      kind: errorKind,
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <AppErrorFallback kind={this.state.errorKind || 'render'} error={this.state.error} />;
    }

    return this.props.children;
  }
}

const AppErrorFallback = ({ kind, error }: { kind: AppErrorKind; error: Error | null }) => {
  const isModuleError = kind === 'module';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full p-6 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {isModuleError ? 'This page could not be loaded' : 'Something went wrong'}
          </h1>
          <p className="text-muted-foreground">
            {isModuleError
              ? 'This page update did not finish loading. Retry the current page, or return to the home page.'
              : 'The application encountered an unexpected error. Reload the page or return to the home page.'}
          </p>
          {import.meta.env.DEV && error?.name && (
            <p className="text-xs text-muted-foreground">
              Error type: {error.name}{error.message ? ` — ${error.message}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors font-medium"
          >
            {isModuleError ? 'Retry current page' : 'Reload page'}
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors font-medium"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const { currentCompany } = useCurrentCompany();

  useEffect(() => {
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
      <PDFProgressDialog />
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Routes>
          {/* Dashboard */}
          <Route
            path="/"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Sales & Customer Management */}
          <Route
            path="/quotations"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Quotations />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/quotations/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Quotations />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/customers"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/customers/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Financial Management */}
          <Route
            path="/invoices"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/invoices/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/cash-receipts"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <CashReceipts />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/cash-receipts/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <CashReceipts />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/payments"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="payments">
                  <Payments />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/payments/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="payments">
                  <Payments />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/receipts"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="payments">
                  <Payments />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/credit-notes"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <CreditNotes />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/credit-notes/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <CreditNotes />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/proforma"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <Proforma />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Procurement & Inventory */}
          <Route
            path="/boqs"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <BOQs />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/fixed-boq"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <FixedBOQ />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/boq/hierarchical"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <FixedBOQHierarchical />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/lcl-template"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <LCLTemplate />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/lcl-boq-list"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <LCLBOQList />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/lpos"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <LPOs />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/lpos/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <LPOs />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/inventory"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="products">
                  <Inventory />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/inventory/new"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="products">
                  <Inventory />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/delivery-notes"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="delivery-notes">
                  <DeliveryNotes />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Additional Features */}
          <Route
            path="/remittance"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <RemittanceAdvice />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Reports */}
          <Route
            path="/reports"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="reports-overview">
                  <ReportsOverview />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/reports/sales"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="reports-sales">
                  <SalesReports />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/reports/inventory"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="reports-inventory">
                  <InventoryReports />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/reports/statements"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="reports-statements">
                  <StatementOfAccounts />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Settings */}
          <Route
            path="/settings/company"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="settings-company">
                  <CompanySettings />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/settings/users"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="settings-users">
                  <UserManagement />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/settings/units"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="settings-company">
                  <UnitsSettings />
                </ProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/settings/units/normalize"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="settings-company">
                  <UnitsNormalize />
                </ProtectedRoute>
              </Suspense>
            }
          />

          <Route
            path="/settings/permissions"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="manage-permissions">
                  <UserPermissions />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Database Fix - Admin only */}
          <Route path="/database-fix" element={<ProtectedRoute><DatabaseFix /></ProtectedRoute>} />

          {/* Company ID Consolidation Tool - Admin only */}
          <Route path="/company-id-consolidation" element={<ProtectedRoute><CompanyIdConsolidation /></ProtectedRoute>} />

          {/* Audit Logs */}
          <Route
            path="/audit-logs"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute requiredFeature="audit-logs">
                  <AuditLogs />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Payment Synchronization - Admin only */}
          <Route path="/payment-sync" element={<ProtectedRoute><Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}><PaymentSynchronizationPage /></Suspense></ProtectedRoute>} />


          {/* Optimized Inventory - Performance-optimized inventory page */}
          <Route
            path="/optimized-inventory"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <OptimizedInventory />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Performance Optimizer - Admin only */}
          <Route path="/performance-optimizer" element={<ProtectedRoute><Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}><PerformanceOptimizerPage /></Suspense></ProtectedRoute>} />


          {/* Optimized Customers - Performance-optimized customers page */}
          <Route
            path="/optimized-customers"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                <ProtectedRoute>
                  <OptimizedCustomers />
                </ProtectedRoute>
              </Suspense>
            }
          />

          {/* Customer Performance Optimizer - Admin only */}
          <Route path="/customer-performance-optimizer" element={<ProtectedRoute><Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}><CustomerPerformanceOptimizerPage /></Suspense></ProtectedRoute>} />




          {/* 404 Page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </Layout>
    </TooltipProvider>
  );
};

export default App;
