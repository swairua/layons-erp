import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Users, 
  ShoppingCart,
  Database,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useLPOs, useCustomers } from '@/hooks/useDatabase';
import { useInvoicesFixed } from '@/hooks/useInvoicesFixed';
import { useCurrentCompanyId } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface AuditResult {
  conflictingEntities: Array<{
    entityId: string;
    entityName: string;
    asCustomerInvoices: number;
    asSupplierLPOs: number;
    totalConflicts: number;
  }>;
  lposWithCustomerSuppliers: Array<{
    lpoId: string;
    lpoNumber: string;
    supplierName: string;
    supplierId: string;
    hasInvoicesAsCustomer: boolean;
    invoiceCount: number;
  }>;
  summary: {
    totalLPOs: number;
    totalCustomers: number;
    conflictingEntities: number;
    lposWithConflicts: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

export const LPOCustomerSupplierAudit = () => {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const companyId = useCurrentCompanyId();
  const { data: lpos } = useLPOs(companyId, { fetchAll: true });
  const { data: customers } = useCustomers(companyId, { fetchAll: true });
  const { data: invoiceResponse } = useInvoicesFixed(companyId);
  const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.data ?? [];

  const performAudit = () => {
    if (!lpos || !customers || !invoices) {
      toast.error('Data not loaded yet. Please wait and try again.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create maps for faster lookups
      const customerMap = new Map(customers.map(c => [c.id, c]));
      const invoicesByCustomer = new Map<string, number>();
      const lposBySupplier = new Map<string, Array<{ id: string; number: string }>>();

      // Count invoices per customer
      invoices.forEach(invoice => {
        const count = invoicesByCustomer.get(invoice.customer_id) || 0;
        invoicesByCustomer.set(invoice.customer_id, count + 1);
      });

      // Group LPOs by supplier
      lpos.forEach(lpo => {
        if (!lposBySupplier.has(lpo.supplier_id)) {
          lposBySupplier.set(lpo.supplier_id, []);
        }
        lposBySupplier.get(lpo.supplier_id)!.push({
          id: lpo.id,
          number: lpo.lpo_number
        });
      });

      // Find conflicting entities (appear as both customer and supplier)
      const conflictingEntities: AuditResult['conflictingEntities'] = [];
      const lposWithCustomerSuppliers: AuditResult['lposWithCustomerSuppliers'] = [];

      // Check each entity that appears as a supplier
      lposBySupplier.forEach((lpoList, supplierId) => {
        const customer = customerMap.get(supplierId);
        const customerInvoiceCount = invoicesByCustomer.get(supplierId) || 0;
        
        if (customer) {
          // This entity has LPOs as supplier
          if (customerInvoiceCount > 0) {
            // This entity ALSO has invoices as customer - CONFLICT!
            conflictingEntities.push({
              entityId: supplierId,
              entityName: customer.name,
              asCustomerInvoices: customerInvoiceCount,
              asSupplierLPOs: lpoList.length,
              totalConflicts: customerInvoiceCount + lpoList.length
            });
          }

          // Add to LPOs with customer suppliers list
          lpoList.forEach(lpo => {
            lposWithCustomerSuppliers.push({
              lpoId: lpo.id,
              lpoNumber: lpo.number,
              supplierName: customer.name,
              supplierId: supplierId,
              hasInvoicesAsCustomer: customerInvoiceCount > 0,
              invoiceCount: customerInvoiceCount
            });
          });
        }
      });

      // Sort by conflict severity
      conflictingEntities.sort((a, b) => b.totalConflicts - a.totalConflicts);
      lposWithCustomerSuppliers.sort((a, b) => b.invoiceCount - a.invoiceCount);

      // Determine risk level
      let riskLevel: AuditResult['summary']['riskLevel'] = 'LOW';
      if (conflictingEntities.length > 0) {
        if (conflictingEntities.length >= 10 || conflictingEntities.some(e => e.totalConflicts >= 20)) {
          riskLevel = 'CRITICAL';
        } else if (conflictingEntities.length >= 5 || conflictingEntities.some(e => e.totalConflicts >= 10)) {
          riskLevel = 'HIGH';
        } else if (conflictingEntities.length >= 1) {
          riskLevel = 'MEDIUM';
        }
      }

      const result: AuditResult = {
        conflictingEntities,
        lposWithCustomerSuppliers,
        summary: {
          totalLPOs: lpos.length,
          totalCustomers: customers.length,
          conflictingEntities: conflictingEntities.length,
          lposWithConflicts: lposWithCustomerSuppliers.filter(lpo => lpo.hasInvoicesAsCustomer).length,
          riskLevel
        }
      };

      setAuditResult(result);
      
      if (result.summary.conflictingEntities > 0) {
        toast.warning(`Found ${result.summary.conflictingEntities} entities used as both customers and suppliers!`);
      } else {
        toast.success('No customer/supplier conflicts detected.');
      }

    } catch (error) {
      console.error('Audit error:', error);
      toast.error('Error performing audit');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run audit when data is available
    if (lpos && customers && invoices && companyId) {
      performAudit();
    }
  }, [lpos, customers, invoices, companyId]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="bg-red-600"><AlertTriangle className="h-3 w-3 mr-1" />CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />HIGH RISK</Badge>;
      case 'MEDIUM':
        return <Badge variant="outline" className="border-orange-500 text-orange-600"><AlertCircle className="h-3 w-3 mr-1" />MEDIUM RISK</Badge>;
      case 'LOW':
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />LOW RISK</Badge>;
      default:
        return <Badge variant="secondary">UNKNOWN</Badge>;
    }
  };

  if (!companyId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No company selected for audit.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              LPO Customer vs Supplier Audit
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={performAudit}
              disabled={isLoading || !lpos || !customers || !invoices}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Running...' : 'Refresh Audit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!auditResult ? (
            <div className="text-center py-8">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Click "Refresh Audit" to analyze customer vs supplier data integrity.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Card */}
              <Alert className={`border-2 ${
                auditResult.summary.riskLevel === 'CRITICAL' ? 'border-red-500 bg-red-50' :
                auditResult.summary.riskLevel === 'HIGH' ? 'border-orange-500 bg-orange-50' :
                auditResult.summary.riskLevel === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50' :
                'border-green-500 bg-green-50'
              }`}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  Data Integrity Audit Results
                  {getRiskBadge(auditResult.summary.riskLevel)}
                </AlertTitle>
                <AlertDescription>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{auditResult.summary.totalLPOs}</div>
                      <div className="text-sm text-muted-foreground">Total LPOs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{auditResult.summary.totalCustomers}</div>
                      <div className="text-sm text-muted-foreground">Total Customers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{auditResult.summary.conflictingEntities}</div>
                      <div className="text-sm text-muted-foreground">Conflicting Entities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{auditResult.summary.lposWithConflicts}</div>
                      <div className="text-sm text-muted-foreground">LPOs with Conflicts</div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Core Issue Explanation */}
              <Alert className="border-blue-500 bg-blue-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Data Model Issue Detected</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    <strong>Critical Problem:</strong> The system stores suppliers in the same table as customers, 
                    without any distinction. This causes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Customers can be accidentally selected as suppliers in Purchase Orders</li>
                    <li>Business relationship confusion (same entity as both customer and supplier)</li>
                    <li>Potential financial and operational errors</li>
                    <li>Data integrity issues in reporting and analytics</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Show details toggle */}
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showDetails ? 'Hide Details' : 'Show Detailed Analysis'}
                </Button>
              </div>

              {/* Detailed Results */}
              {showDetails && (
                <div className="space-y-6">
                  {/* Conflicting Entities */}
                  {auditResult.conflictingEntities.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          Entities Used as Both Customer and Supplier
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entity Name</TableHead>
                              <TableHead>As Customer (Invoices)</TableHead>
                              <TableHead>As Supplier (LPOs)</TableHead>
                              <TableHead>Total Conflicts</TableHead>
                              <TableHead>Risk Level</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditResult.conflictingEntities.map((entity) => (
                              <TableRow key={entity.entityId}>
                                <TableCell className="font-medium">{entity.entityName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                                    <Users className="h-3 w-3 mr-1" />
                                    {entity.asCustomerInvoices} invoices
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                                    <ShoppingCart className="h-3 w-3 mr-1" />
                                    {entity.asSupplierLPOs} LPOs
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-bold">{entity.totalConflicts}</TableCell>
                                <TableCell>
                                  {entity.totalConflicts >= 20 ? (
                                    <Badge variant="destructive">CRITICAL</Badge>
                                  ) : entity.totalConflicts >= 10 ? (
                                    <Badge variant="destructive" className="bg-orange-600">HIGH</Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">MEDIUM</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* All LPOs using customers as suppliers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        All LPOs Using Customer Records as Suppliers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>LPO Number</TableHead>
                            <TableHead>Supplier Name</TableHead>
                            <TableHead>Also Customer?</TableHead>
                            <TableHead>Customer Invoices</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditResult.lposWithCustomerSuppliers.map((lpo) => (
                            <TableRow key={lpo.lpoId}>
                              <TableCell className="font-medium">{lpo.lpoNumber}</TableCell>
                              <TableCell>{lpo.supplierName}</TableCell>
                              <TableCell>
                                {lpo.hasInvoicesAsCustomer ? (
                                  <Badge variant="destructive">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    YES - CONFLICT
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-green-500 text-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    No
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {lpo.invoiceCount > 0 ? (
                                  <span className="font-medium text-red-600">{lpo.invoiceCount}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {lpo.hasInvoicesAsCustomer ? (
                                  <Badge variant="destructive">NEEDS REVIEW</Badge>
                                ) : (
                                  <Badge variant="outline">SUPPLIER ONLY</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Recommendations */}
              <Alert className="border-blue-500 bg-blue-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recommended Solutions</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 text-sm">
                    <p><strong>Short-term fix:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Add an <code>entity_type</code> field to customers table ('customer', 'supplier', 'both')</li>
                      <li>Update LPO creation to filter by entity_type = 'supplier' or 'both'</li>
                      <li>Add validation to prevent inappropriate selections</li>
                    </ul>
                    <p><strong>Long-term solution:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Create a separate <code>suppliers</code> table with proper supplier-specific fields</li>
                      <li>Migrate existing supplier data from customers table</li>
                      <li>Update LPO foreign key to reference suppliers table</li>
                      <li>Implement proper business entity relationship management</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
