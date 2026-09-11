import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  FileText,
  Download,
  Calendar,
  DollarSign,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { generateCustomerStatementPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import { useCustomers, usePayments, useCompanies } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';

// Helper function to compute customer statements from real data
const computeCustomerStatements = (customers: any[], invoices: any[], payments: any[]) => {
  if (!customers || !invoices || !payments) return [];

  return customers.map(customer => {
    // Get customer invoices
    const customerInvoices = invoices.filter(inv => inv.customer_id === customer.id);
    const customerPayments = payments.filter(pay => pay.customer_id === customer.id);

    // Calculate totals
    const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const totalPaid = customerPayments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
    const currentBalance = totalInvoiced - totalPaid;

    // Calculate aging analysis
    const today = new Date();
    let current = 0, days30 = 0, days60 = 0, days90 = 0;

    customerInvoices.forEach(invoice => {
      const dueDate = new Date(invoice.due_date || invoice.invoice_date);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const unpaidAmount = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);

      if (daysPastDue <= 0) current += unpaidAmount;
      else if (daysPastDue <= 30) days30 += unpaidAmount;
      else if (daysPastDue <= 60) days60 += unpaidAmount;
      else days90 += unpaidAmount;
    });

    const overdueAmount = days30 + days60 + days90;

    const invoiceNumbers = new Map(customerInvoices.map(invoice => [invoice.id, invoice.invoice_number]));
    const paymentTransactions = customerPayments.flatMap(payment => {
      const allocations = payment.payment_allocations || [];
      const allocatedAmount = allocations.reduce((total: number, allocation: any) => total + Number(allocation.allocated_amount || allocation.amount_allocated || 0), 0);
      const allocatedTransactions = allocations
        .filter((allocation: any) => allocation.invoice_id && invoiceNumbers.has(allocation.invoice_id))
        .map((allocation: any) => {
          const invoiceNumber = invoiceNumbers.get(allocation.invoice_id);
          return {
            date: payment.payment_date,
            type: 'Payment',
            reference: `${payment.payment_number} · ${invoiceNumber}`,
            description: `Payment applied to invoice ${invoiceNumber}`,
            debit: 0,
            credit: Number(allocation.allocated_amount || allocation.amount_allocated || 0),
            balance: 0
          };
        });
      const unallocatedAmount = Math.max(0, Number(payment.amount || 0) - allocatedAmount);

      return unallocatedAmount > 0
        ? [...allocatedTransactions, {
            date: payment.payment_date,
            type: 'Payment',
            reference: payment.payment_number,
            description: 'Unallocated payment',
            debit: 0,
            credit: unallocatedAmount,
            balance: 0,
            currency: payment.currency || 'KES'
          }]
        : allocatedTransactions;
    });

    const allTransactions = [
      ...customerInvoices.map(inv => ({
        date: inv.invoice_date,
        type: 'Invoice',
        reference: inv.invoice_number,
        description: `Invoice - ${inv.invoice_number}`,
        debit: Number(inv.total_amount) || 0,
        credit: 0,
        balance: 0,
        currency: inv.currency || 'KES'
      })),
      ...paymentTransactions
    ];

    // Sort by date and calculate running balance
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0;
    allTransactions.forEach(trans => {
      runningBalance += trans.debit - trans.credit;
      trans.balance = runningBalance;
    });

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.customer_code,
      address: customer.address || '',
      email: customer.email || '',
      phone: customer.phone || '',
      creditLimit: Number(customer.credit_limit) || 0,
      currentBalance: currentBalance,
      overdueAmount: overdueAmount,
      lastStatementDate: new Date().toISOString().split('T')[0],
      transactions: allTransactions.slice(-10), // Show last 10 transactions
      agingAnalysis: {
        current: current,
        days30: days30,
        days60: days60,
        days90: days90,
        total: current + days30 + days60 + days90
      }
    };
  });
};

const StatementOfAccounts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // Real data hooks
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: customers } = useCustomers(currentCompany?.id);
  const { data: invoiceResponse } = useInvoices(currentCompany?.id);
  const { data: paymentResponse } = usePayments(currentCompany?.id);
  const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.data ?? [];
  const payments = Array.isArray(paymentResponse) ? paymentResponse : paymentResponse?.data ?? [];

  // Compute statements from real data
  const computedStatements = computeCustomerStatements(customers || [], invoices, payments);

  const handleDownloadStatement = async (statement: any) => {
    try {
      // Find the real customer in database
      const customer = customers?.find(c => c.name === statement.customerName);
      if (!customer) {
        toast.error('Customer not found in database');
        return;
      }

      // Get real invoices and payments for this customer
      const customerInvoices = invoices?.filter(inv => inv.customer_id === customer.id) || [];
      const customerPayments = payments?.filter(pay => pay.customer_id === customer.id) || [];

      // Prepare company details for PDF
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        company_services: currentCompany.company_services
      } : undefined;

      // Generate PDF with real data
      await generateCustomerStatementPDF(customer, customerInvoices, customerPayments, {
        statement_date: new Date().toISOString().split('T')[0]
      }, companyDetails);

      toast.success(`Statement PDF generated for ${statement.customerName}`);
    } catch (error) {
      console.error('Error generating statement PDF:', error);
      toast.error('Failed to generate statement PDF. Please try again.');
    }
  };

  const filteredStatements = computedStatements.filter(statement => {
    const matchesSearch = statement.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         statement.customerCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || statement.customerId.toString() === selectedCustomer;
    const matchesOverdue = !showOverdueOnly || statement.overdueAmount > 0;
    return matchesSearch && matchesCustomer && matchesOverdue;
  });

  const getAccountStatus = (currentBalance: number, overdueAmount: number, creditLimit: number) => {
    if (overdueAmount > 0) {
      return { status: 'overdue', color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle };
    } else if (currentBalance > creditLimit * 0.8) {
      return { status: 'near_limit', color: 'bg-warning text-warning-foreground', icon: Clock };
    } else {
      return { status: 'good', color: 'bg-success text-success-foreground', icon: CheckCircle };
    }
  };

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const totalOutstanding = filteredStatements.reduce((sum, statement) => sum + statement.currentBalance, 0);
  const totalOverdue = filteredStatements.reduce((sum, statement) => sum + statement.overdueAmount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Statement of Accounts</h1>
          <p className="text-muted-foreground">
            Customer account statements and aging analysis
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button className="shadow-card">
            <Plus className="mr-2 h-4 w-4" />
            Generate Statements
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue Amount</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Customers</p>
                <p className="text-lg font-bold text-secondary">{filteredStatements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue Customers</p>
                <p className="text-lg font-bold text-warning">
                  {computedStatements.filter(s => s.overdueAmount > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Filter Customer Statements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {computedStatements.map((statement) => (
                  <SelectItem key={statement.customerId} value={statement.customerId.toString()}>
                    {statement.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant={showOverdueOnly ? "default" : "outline"}
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Overdue Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Statements List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Customer Account Statements</CardTitle>
          <CardDescription>
            Detailed account statements with aging analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredStatements.map((statement) => {
              const statusInfo = getAccountStatus(statement.currentBalance, statement.overdueAmount, statement.creditLimit);
              const StatusIcon = statusInfo.icon;

              return (
                <Card key={statement.customerId} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Building2 className="h-8 w-8 text-primary" />
                        <div>
                          <h3 className="text-lg font-semibold">{statement.customerName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {statement.customerCode} • {statement.email}
                          </p>
                          <p className="text-sm text-muted-foreground">{statement.address}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusInfo.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <div className="space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="mr-1 h-3 w-3" />
                            View Statement
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadStatement(statement)}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Account Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                        <p className="text-sm font-bold text-primary">{formatCurrency(statement.currentBalance)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Credit Limit</p>
                        <p className="text-sm font-bold">{formatCurrency(statement.creditLimit)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Available Credit</p>
                        <p className="text-sm font-bold text-success">
                          {formatCurrency(statement.creditLimit - statement.currentBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Overdue Amount</p>
                        <p className={`text-sm font-bold ${statement.overdueAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                          {formatCurrency(statement.overdueAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Aging Analysis */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold mb-3">Aging Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="text-center p-3 bg-success/10 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Current (0-30 days)</p>
                          <p className="text-sm font-bold text-success">{formatCurrency(statement.agingAnalysis.current)}</p>
                        </div>
                        <div className="text-center p-3 bg-warning/10 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">31-60 days</p>
                          <p className="text-sm font-bold text-warning">{formatCurrency(statement.agingAnalysis.days30)}</p>
                        </div>
                        <div className="text-center p-3 bg-orange-100 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">61-90 days</p>
                          <p className="text-sm font-bold text-orange-600">{formatCurrency(statement.agingAnalysis.days60)}</p>
                        </div>
                        <div className="text-center p-3 bg-destructive/10 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">90+ days</p>
                          <p className="text-sm font-bold text-destructive">{formatCurrency(statement.agingAnalysis.days90)}</p>
                        </div>
                        <div className="text-center p-3 bg-primary/10 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Total</p>
                          <p className="text-sm font-bold text-primary">{formatCurrency(statement.agingAnalysis.total)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent Transactions */}
                    <div>
                      <h4 className="text-md font-semibold mb-3">Recent Transactions</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statement.transactions.map((transaction, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{new Date(transaction.date).toLocaleDateString()}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={transaction.type === 'Payment' ? 'default' : 'secondary'}>
                                  {transaction.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{transaction.reference}</TableCell>
                              <TableCell>{transaction.description}</TableCell>
                              <TableCell className="text-right text-destructive">
                                {transaction.debit > 0 ? formatCurrency(transaction.debit, transaction.currency) : ''}
                              </TableCell>
                              <TableCell className="text-right text-success">
                                {transaction.credit > 0 ? formatCurrency(transaction.credit, transaction.currency) : ''}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(transaction.balance, transaction.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredStatements.length === 0 && (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No customer statements found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCustomer !== 'all' || showOverdueOnly
                  ? 'Try adjusting your search criteria'
                  : 'No customer statements available'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StatementOfAccounts;
