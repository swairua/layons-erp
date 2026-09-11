import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  CreditCard,
  Calendar,
  Receipt,
  User,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { parseErrorMessageWithCodes } from '@/utils/errorHelpers';
import { useCreatePayment } from '@/hooks/useDatabase';
import { toNumber } from '@/utils/numericFormHelpers';
import { toCollection } from '@/utils/collection';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentAllocationQuickFix } from './PaymentAllocationQuickFix';
import { autoCreateCashReceipt } from '@/utils/autoCreateCashReceipt';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoice?: any;
}

export function RecordPaymentModal({ open, onOpenChange, onSuccess, invoice }: RecordPaymentModalProps) {
  const [paymentData, setPaymentData] = useState<{
    invoice_id: string;
    amount: number | '';
    payment_date: string;
    payment_method: string;
    reference_number: string;
    notes: string;
    customer_name: string;
  }>({
    invoice_id: invoice?.id || '',
    amount: invoice?.balance_due || 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
    customer_name: invoice?.customers?.name || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocationFailed, setAllocationFailed] = useState(false);
  const [currency, setCurrency] = useState('KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);

  // Reset allocation failed state when modal closes
  useEffect(() => {
    if (!open) {
      setAllocationFailed(false);
    }
  }, [open]);

  // Fetch all available invoices for selection
  const { currentCompany } = useCurrentCompany();
  const { profile } = useAuth();
  const { data: invoiceResponse } = useInvoices(currentCompany?.id);
  const invoices = toCollection(invoiceResponse);
  const createPaymentMutation = useCreatePayment();
  
  // Include all invoices for manual payment adjustments (including fully paid ones)
  const availableInvoices = invoices.filter(inv =>
    inv.total_amount !== null && inv.total_amount !== undefined
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleInputChange = (field: string, value: any) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    // Convert amount to number
    const amount = toNumber(paymentData.amount, 0);

    // Validate that an invoice is selected
    if (!paymentData.invoice_id) {
      toast.error('Please select an invoice. Payments can only be made against invoices.');
      return;
    }

    if (!amount || amount === 0) {
      toast.error('Please enter a valid payment amount (can be negative for refunds/adjustments)');
      return;
    }

    const selectedInvoice = availableInvoices.find(inv => inv.id === paymentData.invoice_id);
    const currentBalance = selectedInvoice?.balance_due || (selectedInvoice?.total_amount || 0) - (selectedInvoice?.paid_amount || 0);

    // Allow manual adjustments: warn about overpayments but don't prevent them
    if (amount > currentBalance && currentBalance > 0) {
      console.warn(`Payment amount (${amount}) exceeds outstanding balance (${currentBalance}) - this will create an overpayment`);
    }

    if (!paymentData.payment_method) {
      toast.error('Please select a payment method');
      return;
    }

    if (!currentCompany?.id) {
      toast.error('Company not found. Please refresh and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate payment number
      const paymentNumber = `PAY-${Date.now()}`;

      // Map UI payment method values to database enum values
      const mapPaymentMethod = (method: string) => {
        switch (method) {
          case 'mpesa':
            return 'mobile_money';
          default:
            return method;
        }
      };

      const paymentRecord = {
        company_id: selectedInvoice?.company_id || currentCompany.id,
        customer_id: selectedInvoice?.customer_id || null,
        invoice_id: paymentData.invoice_id, // Required for payment allocation
        payment_number: paymentNumber,
        payment_date: paymentData.payment_date,
        amount: amount,
        payment_method: mapPaymentMethod(paymentData.payment_method),
        reference_number: paymentData.reference_number || paymentNumber,
        notes: paymentData.notes,
        currency: currency,
        exchange_rate: exchangeRate,
      };

      const result = await createPaymentMutation.mutateAsync(paymentRecord);

      // Auto-create a cash receipt for audit trail
      if (result.success && selectedInvoice) {
        const receiptResult = await autoCreateCashReceipt({
          company_id: selectedInvoice.company_id || currentCompany!.id,
          customer_id: selectedInvoice.customer_id,
          invoice_id: selectedInvoice.id,
          payment_date: paymentData.payment_date,
          amount: amount,
          payment_method: paymentData.payment_method,
          reference_number: paymentData.reference_number || result.payment_id,
          notes: paymentData.notes || undefined,
          created_by: profile?.id
        });

        if (receiptResult) {
          console.log('✅ Cash receipt auto-created:', receiptResult.receipt_number);
        }
      }

      // Check if payment was recorded but allocation might have failed
      if (result.fallback_used) {
        if (result.allocation_failed) {
          setAllocationFailed(true);
          toast.error(`Payment recorded but invoice allocation failed!`, {
            duration: 8000,
            description: `Payment amount: ${formatCurrency(paymentData.amount)}. Invoice was not linked. Click below to fix this.`
          });

          // Log detailed error info
          if (result.allocation_error) {
            console.error('Allocation error details:', result.allocation_error);
          }
        } else if (result.allocation_created) {
          toast.success(`Payment of ${formatCurrency(paymentData.amount)} recorded and allocated successfully!`);
          setAllocationFailed(false);
        } else {
          toast.success(`Payment of ${formatCurrency(paymentData.amount)} recorded successfully!`, {
            description: "Invoice allocation status is pending. Check the payments list."
          });
        }
      } else {
        toast.success(`Payment of ${formatCurrency(paymentData.amount)} recorded successfully!`);
        setAllocationFailed(false);
      }
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error recording payment:', error);

      let errorMessage = 'Failed to record payment';

      // Handle network errors first
      if (error instanceof TypeError) {
        if ((error as any).message?.includes('Failed to fetch')) {
          errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again. If the problem persists, Supabase may be temporarily unavailable.';
        } else {
          errorMessage = `Network error: ${(error as any).message || 'Failed to fetch data'}`;
        }
      } else if (error instanceof Error) {
        // Try to use the custom error parser first
        const parsedMessage = parseErrorMessageWithCodes(error, 'payment');
        errorMessage = parsedMessage;
      } else {
        // Fallback for unknown error types
        console.error('Error details:', JSON.stringify(error, null, 2));
        const fallback = parseErrorMessageWithCodes(error, 'payment');
        errorMessage = fallback;
      }

      toast.error(errorMessage, {
        duration: 6000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPaymentData({
      invoice_id: invoice?.id || '',
      amount: invoice?.balance_due || 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      reference_number: '',
      notes: '',
      customer_name: invoice?.customers?.name || ''
    });
    setCurrency('KES');
    setExchangeRate(1);
    setAllocationFailed(false);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="h-4 w-4" />;
      case 'bank_transfer':
        return <CreditCard className="h-4 w-4" />;
      case 'mpesa':
        return <DollarSign className="h-4 w-4" />;
      case 'cheque':
        return <Receipt className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-success" />
            <span>Record Payment</span>
          </DialogTitle>
          <DialogDescription>
            Record a payment against an invoice. All payments must be linked to an invoice.
          </DialogDescription>
          {!invoice && (
            <div className="bg-warning-light border border-warning/20 rounded-lg p-3 mt-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-warning">Invoice Required</span>
              </div>
              <p className="text-xs text-warning mt-1">
                Payments can only be recorded against existing invoices. Please select an invoice below.
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoice Selection and Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Receipt className="h-4 w-4" />
                <span>Invoice Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!invoice && (
                <div className="space-y-2">
                  <Label htmlFor="invoice_select">Select Invoice *</Label>
                  <Select 
                    value={paymentData.invoice_id} 
                    onValueChange={(value) => {
                      const selectedInv = availableInvoices.find(inv => inv.id === value);
                      handleInputChange('invoice_id', value);
                      handleInputChange('amount', selectedInv?.balance_due || selectedInv?.total_amount || 0);
                      handleInputChange('customer_name', selectedInv?.customers?.name || '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an invoice to pay" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{inv.invoice_number} - {inv.customers?.name}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {formatCurrency(inv.balance_due || inv.total_amount || 0)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableInvoices.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No invoices found.
                    </p>
                  )}
                </div>
              )}
              
              {(invoice || paymentData.invoice_id) && (() => {
                const displayInvoice = invoice || availableInvoices.find(inv => inv.id === paymentData.invoice_id);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Invoice Number:</span>
                        <div className="font-medium">{displayInvoice?.invoice_number}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <div className="font-medium">{displayInvoice?.customers?.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Invoice Date:</span>
                        <div className="font-medium">
                          {displayInvoice?.invoice_date ? new Date(displayInvoice.invoice_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date:</span>
                        <div className="font-medium">
                          {displayInvoice?.due_date ? new Date(displayInvoice.due_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-muted-foreground text-sm">Total Amount:</span>
                          <div className="font-bold text-lg">{formatCurrency(displayInvoice?.total_amount || 0)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-sm">Paid Amount:</span>
                          <div className="font-bold text-lg text-success">{formatCurrency(displayInvoice?.paid_amount || 0)}</div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-sm">Balance Due:</span>
                          <div className="font-bold text-xl text-destructive">{formatCurrency(displayInvoice?.balance_due || (displayInvoice?.total_amount || 0) - (displayInvoice?.paid_amount || 0))}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <CreditCard className="h-4 w-4" />
                <span>Payment Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Currency Selection */}
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_SELECT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isForeignCurrency && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {rateLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Fetching exchange rate...</span>
                      </>
                    ) : (
                      <span>
                        1 {currency} = {exchangeRate.toFixed(4)} {currentCompany?.currency || 'KES'}
                        <span className="text-xs ml-1">(locked at creation)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Payment Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (KES) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={paymentData.amount ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange('amount', '');
                    } else {
                      const num = parseFloat(value);
                      if (!isNaN(num)) {
                        handleInputChange('amount', num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange('amount', 0);
                    }
                  }}
                  min="0"
                  max={undefined}
                  step="0.01"
                  placeholder="0.00"
                  disabled={!paymentData.invoice_id}
                />
                <div className="text-xs text-muted-foreground">
                  {paymentData.invoice_id ? (
                    <>Outstanding: {formatCurrency((() => {
                      const selectedInv = invoice || availableInvoices.find(inv => inv.id === paymentData.invoice_id);
                      return selectedInv?.balance_due || (selectedInv?.total_amount || 0) - (selectedInv?.paid_amount || 0);
                    })())} • Use negative amounts for refunds/adjustments</>
                  ) : (
                    'Select an invoice first'
                  )}
                </div>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => handleInputChange('payment_date', e.target.value)}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select value={paymentData.payment_method} onValueChange={(value) => handleInputChange('payment_method', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Cash</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Bank Transfer</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="mpesa">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4" />
                        <span>M-Pesa</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque">
                      <div className="flex items-center space-x-2">
                        <Receipt className="h-4 w-4" />
                        <span>Cheque</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reference Number */}
              <div className="space-y-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  value={paymentData.reference_number}
                  onChange={(e) => handleInputChange('reference_number', e.target.value)}
                  placeholder="Transaction ID, Cheque number, etc."
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={paymentData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  placeholder="Additional notes about this payment..."
                />
              </div>

              {/* Payment Summary */}
              {paymentData.invoice_id && (
                <div className="border-t pt-4 bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Payment Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Payment Amount:</span>
                      <span className="font-semibold">{formatCurrency(paymentData.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining Balance:</span>
                      <span className="font-semibold">
                        {formatCurrency((() => {
                          const selectedInv = invoice || availableInvoices.find(inv => inv.id === paymentData.invoice_id);
                          const balance = selectedInv?.balance_due || selectedInv?.total_amount || 0;
                          return Math.max(0, balance - paymentData.amount);
                        })())}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <div className="flex items-center space-x-1">
                        {getMethodIcon(paymentData.payment_method)}
                        <span className="font-semibold capitalize">
                          {paymentData.payment_method.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Show quick fix if allocation failed */}
        {allocationFailed && (
          <PaymentAllocationQuickFix className="mt-4" />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !paymentData.amount || paymentData.amount === 0 || !paymentData.invoice_id}
            className="bg-success hover:bg-success/90"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Recording...' : !paymentData.invoice_id ? 'Select Invoice First' : paymentData.amount < 0 ? 'Record Adjustment/Refund' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
