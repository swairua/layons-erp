import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FloatingItemPreview } from '@/components/ui/floating-item-preview';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  Package,
  User,
  Building2,
  Calendar,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useCreateLPO, useGenerateLPONumber, useAllSuppliersAndCustomers, useProducts, useCompanies, useCreateCustomer } from '@/hooks/useDatabase';
import { toast } from '@/utils/safeToast';
import { validateLPO } from '@/utils/lpoValidation';
import { validateSupplierSelection, ValidationResult } from '@/utils/customerSupplierValidation';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toCollection } from '@/utils/collection';

function formatErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message && typeof error.message === 'string') return error.message;
  return 'An unexpected error occurred';
}

interface LPOItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  unit_of_measure: string;
}

interface CreateLPOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateLPOModal = ({ 
  open, 
  onOpenChange, 
  onSuccess
}: CreateLPOModalProps) => {
  const [formData, setFormData] = useState({
    supplier_id: '',
    lpo_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    delivery_address: '',
    contact_person: '',
    contact_phone: '',
    notes: '',
    terms_and_conditions: 'Payment terms: Net 30 days\nDelivery: As per agreed schedule\nQuality: All items must meet specified standards',
  });

  const [items, setItems] = useState<LPOItem[]>([]);
  const [currency, setCurrency] = useState('KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [lpoNumber, setLpoNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierValidation, setSupplierValidation] = useState<ValidationResult | null>(null);
  const [isValidatingSupplier, setIsValidatingSupplier] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: ''
  });
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newlyCreatedSupplierId, setNewlyCreatedSupplierId] = useState<string | null>(null);

  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: supplierData } = useAllSuppliersAndCustomers(currentCompany?.id);
  const suppliers = supplierData?.all || [];
  const { data: productsResponse } = useProducts(currentCompany?.id);
  const products = toCollection(productsResponse);
  const createLPO = useCreateLPO();
  const generateLPONumber = useGenerateLPONumber();
  const createCustomer = useCreateCustomer();

  useEffect(() => {
    if (open && currentCompany?.id) {
      // Generate LPO number when modal opens
      generateLPONumber.mutate(currentCompany.id, {
        onSuccess: (number) => {
          setLpoNumber(number);
        },
        onError: (error) => {
          console.error('Failed to generate LPO number:', error);
          // Fallback LPO number generation
          const fallbackNumber = `LPO-${new Date().getFullYear()}-${Date.now()}`;
          setLpoNumber(fallbackNumber);
          toast.error('Failed to generate LPO number. Using fallback number.');
        }
      });
    }
  }, [open, currentCompany?.id]);

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Validate supplier selection for customer/supplier conflicts
  // Create new supplier (customer) function
  const handleCreateNewSupplier = async () => {
    if (!currentCompany?.id) {
      toast.error('Company not found');
      return;
    }

    if (!newSupplierData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setIsCreatingSupplier(true);
    try {
      // Generate customer code
      const customerCode = `SUP-${newSupplierData.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const customerData = {
        company_id: currentCompany.id,
        customer_code: customerCode,
        name: newSupplierData.name.trim(),
        email: newSupplierData.email.trim() || null,
        phone: newSupplierData.phone.trim() || null,
        address: newSupplierData.address.trim() || null,
        city: newSupplierData.city.trim() || null,
        country: newSupplierData.country.trim() || null,
        is_active: true
      };

      const newCustomer = await createCustomer.mutateAsync(customerData);

      // Set as selected supplier and mark as newly created
      setFormData(prev => ({ ...prev, supplier_id: newCustomer.id }));
      setNewlyCreatedSupplierId(newCustomer.id);

      // Reset form
      setNewSupplierData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: ''
      });
      setShowCreateSupplier(false);

      toast.success(`Supplier "${newCustomer.name}" created and selected!`);

      // Validate the new supplier selection (mark as newly created)
      await validateSupplier(newCustomer.id, true);

    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error('Failed to create supplier. Please try again.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const validateSupplier = async (supplierId: string, isNewlyCreated: boolean = false) => {
    if (!supplierId || !currentCompany?.id) return;

    setIsValidatingSupplier(true);
    try {
      const supplier = suppliers?.find(s => s.id === supplierId);
      const result = await validateSupplierSelection(
        supplierId,
        currentCompany.id,
        supplier?.name,
        isNewlyCreated
      );
      setSupplierValidation(result);

      // Show toast for critical errors only
      if (!result.isValid && result.errors.length > 0) {
        toast.error('Supplier validation failed: ' + result.errors[0]);
      } else if (result.warnings.length > 0 && !isNewlyCreated) {
        // Only show warning toast for existing suppliers with conflicts
        toast.warning('Supplier conflict detected - please review the warnings below');
      }
    } catch (error) {
      console.error('Error validating supplier:', error);
      toast.error('Failed to validate supplier selection');
    } finally {
      setIsValidatingSupplier(false);
    }
  };

  const addItem = (product: any) => {
    const newItem: LPOItem = {
      id: `item-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 16, // Default VAT rate
      tax_amount: 0,
      line_total: 0,
      unit_of_measure: product.unit_of_measure || 'pcs',
    };

    setItems(prev => [...prev, newItem]);
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const updateItem = (id: string, field: keyof LPOItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate totals when quantity, unit_price, or tax_rate changes
        if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
          const subtotal = updatedItem.quantity * updatedItem.unit_price;
          updatedItem.tax_amount = (subtotal * updatedItem.tax_rate) / 100;
          updatedItem.line_total = subtotal + updatedItem.tax_amount;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
  const totalAmount = subtotal + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCompany?.id) {
      toast.error('Company not found. Please refresh and try again.');
      return;
    }

    // Validate LPO data
    const validationResult = validateLPO({
      supplier_id: formData.supplier_id,
      lpo_date: formData.lpo_date,
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description,
      }))
    });

    if (!validationResult.isValid) {
      validationResult.errors.forEach(error => toast.error(formatErrorMessage(error)));
      return;
    }

    // Check supplier validation - only block on critical errors
    if (supplierValidation && !supplierValidation.isValid && supplierValidation.errors.length > 0) {
      toast.error('Please resolve supplier validation errors before creating LPO');
      return;
    }

    // Show final warning for supplier conflicts (only for existing suppliers with significant conflicts)
    if (supplierValidation && supplierValidation.warnings.length > 0 &&
        supplierValidation.conflictData?.customerInvoiceCount &&
        supplierValidation.conflictData.customerInvoiceCount >= 5 &&
        formData.supplier_id !== newlyCreatedSupplierId) {
      const proceed = window.confirm(
        `WARNING: This supplier "${supplierValidation.conflictData.entityName}" has ${supplierValidation.conflictData.customerInvoiceCount} invoice(s) as a customer. ` +
        `This creates a customer/supplier conflict. Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    try {
      const lpoData = {
        company_id: currentCompany.id,
        supplier_id: formData.supplier_id,
        lpo_number: lpoNumber,
        lpo_date: formData.lpo_date,
        delivery_date: formData.delivery_date || null,
        status: 'draft' as const,
        subtotal,
        tax_amount: totalTax,
        total_amount: totalAmount,
        delivery_address: formData.delivery_address,
        contact_person: formData.contact_person,
        contact_phone: formData.contact_phone,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
        currency: currency,
        exchange_rate: exchangeRate,
      };

      const lpoItems = items.map(item => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
      }));

      await createLPO.mutateAsync({
        lpo: lpoData,
        items: lpoItems
      });

      toast.success('Local Purchase Order created successfully!');
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error creating LPO:', error);
      toast.error('Failed to create LPO. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    // Handle create new supplier option
    if (supplierId === '__create_new__') {
      setShowCreateSupplier(true);
      return;
    }

    setFormData(prev => ({ ...prev, supplier_id: supplierId }));

    // Clear previous validation and validate new supplier
    setSupplierValidation(null);
    if (supplierId) {
      // Check if this is the newly created supplier
      const isNewlyCreated = supplierId === newlyCreatedSupplierId;
      validateSupplier(supplierId, isNewlyCreated);
    }
  };

  const handleClose = () => {
    setFormData({
      supplier_id: '',
      lpo_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      delivery_address: '',
      contact_person: '',
      contact_phone: '',
      notes: '',
      terms_and_conditions: 'Payment terms: Net 30 days\nDelivery: As per agreed schedule\nQuality: All items must meet specified standards',
    });
    setCurrency(currentCompany?.currency || 'KES');
    setExchangeRate(1);
    setItems([]);
    setSearchTerm('');
    setShowProductSearch(false);
    setSupplierValidation(null);
    setNewlyCreatedSupplierId(null);
    setShowCreateSupplier(false);
    setNewSupplierData({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: ''
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            Create a new Local Purchase Order for supplier
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lpo_number">LPO Number</Label>
              <Input
                id="lpo_number"
                value={lpoNumber}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={handleSupplierChange}
                disabled={isValidatingSupplier}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierData?.existing && supplierData.existing.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 border-b">
                        ✓ Current Suppliers
                      </div>
                      {supplierData.existing.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {supplier.name}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {supplierData?.potential && supplierData.potential.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-orange-600 bg-orange-50 border-b border-t">
                        ⚠ Customers (Will Create Supplier Role)
                      </div>
                      {supplierData.potential.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            {customer.name}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {/* Create New Supplier Option */}
                  <div className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border-b border-t">
                    ➕ Add New Supplier
                  </div>
                  <SelectItem value="__create_new__">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Create New Supplier...
                    </div>
                  </SelectItem>

                  {(!supplierData?.existing?.length && !supplierData?.potential?.length) && (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                      No existing suppliers found. Use "Create New Supplier" above to add one.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lpo_date">LPO Date</Label>
              <Input
                id="lpo_date"
                type="date"
                value={formData.lpo_date}
                onChange={(e) => setFormData(prev => ({ ...prev, lpo_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Supplier Validation Alerts */}
          {supplierValidation && (supplierValidation.warnings.length > 0 || supplierValidation.errors.length > 0) && (
            <div className="space-y-3">
              {supplierValidation.errors.length > 0 && (
                <Alert className="border-red-500 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">⚠️ Critical Issue - Action Required</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      {supplierValidation.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                          {error}
                        </div>
                      ))}
                      <div className="text-xs text-red-600 font-medium mt-2">
                        ⛔ You must resolve these issues before creating the LPO.
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {supplierValidation.warnings.length > 0 && (
                <div className="space-y-2">
                  {supplierValidation.warnings.map((warning, index) => {
                    // Determine alert type based on warning content
                    const isDataModelNotice = warning.includes('DATA MODEL NOTICE');
                    const isMinorConflict = warning.includes('MINOR CONFLICT');
                    const isModerateConflict = warning.includes('MODERATE CONFLICT');
                    const isTip = warning.includes('TIP:');

                    if (isDataModelNotice) {
                      return (
                        <Alert key={index} className="border-blue-300 bg-blue-50">
                          <AlertTriangle className="h-4 w-4 text-blue-600" />
                          <AlertTitle className="text-blue-800">ℹ️ System Information</AlertTitle>
                          <AlertDescription className="text-sm text-blue-700">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      );
                    } else if (isMinorConflict) {
                      return (
                        <Alert key={index} className="border-yellow-300 bg-yellow-50">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <AlertTitle className="text-yellow-800">ℹ️ Minor Conflict - Informational</AlertTitle>
                          <AlertDescription className="text-sm text-yellow-700">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      );
                    } else if (isModerateConflict) {
                      return (
                        <Alert key={index} className="border-orange-400 bg-orange-50">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <AlertTitle className="text-orange-800">⚠️ Moderate Conflict - Please Review</AlertTitle>
                          <AlertDescription className="text-sm text-orange-700">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      );
                    } else if (isTip) {
                      return (
                        <Alert key={index} className="border-green-300 bg-green-50">
                          <AlertTriangle className="h-4 w-4 text-green-600" />
                          <AlertTitle className="text-green-800">💡 Helpful Suggestion</AlertTitle>
                          <AlertDescription className="text-sm text-green-700">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      );
                    } else {
                      return (
                        <Alert key={index} className="border-orange-500 bg-orange-50">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <AlertTitle className="text-orange-800">⚠️ Warning</AlertTitle>
                          <AlertDescription className="text-sm text-orange-700">
                            {warning}
                          </AlertDescription>
                        </Alert>
                      );
                    }
                  })}

                  {supplierValidation.conflictData && supplierValidation.conflictData.customerInvoiceCount > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="font-medium text-sm text-gray-800">📊 Conflict Summary:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        <div className="bg-white p-2 rounded">
                          <div className="font-medium text-gray-600">Entity Name</div>
                          <div className="text-gray-800">{supplierValidation.conflictData.entityName}</div>
                        </div>
                        <div className="bg-white p-2 rounded">
                          <div className="font-medium text-gray-600">Customer Invoices</div>
                          <div className="text-gray-800">{supplierValidation.conflictData.customerInvoiceCount}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create New Supplier Form */}
          {showCreateSupplier && (
            <Card className="border-blue-500 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-blue-700">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Create New Supplier
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreateSupplier(false);
                      setNewSupplierData({
                        name: '',
                        email: '',
                        phone: '',
                        address: '',
                        city: '',
                        country: ''
                      });
                    }}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_supplier_name">Supplier Name *</Label>
                    <Input
                      id="new_supplier_name"
                      value={newSupplierData.name}
                      onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter supplier name"
                      disabled={isCreatingSupplier}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_supplier_email">Email</Label>
                    <Input
                      id="new_supplier_email"
                      type="email"
                      value={newSupplierData.email}
                      onChange={(e) => setNewSupplierData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="supplier@example.com"
                      disabled={isCreatingSupplier}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_supplier_phone">Phone</Label>
                    <Input
                      id="new_supplier_phone"
                      value={newSupplierData.phone}
                      onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254 700 000000"
                      disabled={isCreatingSupplier}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_supplier_city">City</Label>
                    <Input
                      id="new_supplier_city"
                      value={newSupplierData.city}
                      onChange={(e) => setNewSupplierData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Nairobi"
                      disabled={isCreatingSupplier}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new_supplier_address">Address</Label>
                    <Input
                      id="new_supplier_address"
                      value={newSupplierData.address}
                      onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Street address"
                      disabled={isCreatingSupplier}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateSupplier(false);
                      setNewSupplierData({
                        name: '',
                        email: '',
                        phone: '',
                        address: '',
                        city: '',
                        country: ''
                      });
                    }}
                    disabled={isCreatingSupplier}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateNewSupplier}
                    disabled={isCreatingSupplier || !newSupplierData.name.trim()}
                  >
                    {isCreatingSupplier ? 'Creating...' : 'Create Supplier'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Expected Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="Contact person at supplier"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_address">Delivery Address</Label>
              <Textarea
                id="delivery_address"
                value={formData.delivery_address}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                placeholder="Delivery address..."
                rows={3}
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+254 700 000000"
                />
              </div>
            </div>
          </div>

          {/* Currency Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items to Purchase
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProductSearch(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showProductSearch && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Add Product</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {filteredProducts?.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50"
                            onClick={() => addItem(product)}
                          >
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {product.product_code} • Stock: {product.stock_quantity}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowProductSearch(false)}
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to start.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table className="table-fixed min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-40">Qty</TableHead>
                        <TableHead className="w-48">Unit Price</TableHead>
                        <TableHead className="w-32">Tax %</TableHead>
                        <TableHead className="w-40">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product_name}
                            <div className="text-xs text-muted-foreground">{item.unit_of_measure}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Description"
                              className="min-w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-28 h-10 text-sm px-2"
                              placeholder="1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-36 h-10 text-sm px-2"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.tax_rate}
                              onChange={(e) => updateItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                              className="w-28 h-10 text-sm px-2"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            KES {item.line_total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>KES {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>KES {totalTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>KES {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
              <Textarea
                id="terms_and_conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                placeholder="Terms and conditions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.supplier_id || items.length === 0}>
              {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
