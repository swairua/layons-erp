import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  FileText, 
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Download,
  Edit,
  Send
} from 'lucide-react';
import { BiolegendLogo } from '@/components/ui/biolegend-logo';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyFormatter';

interface ViewQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: any;
  onEdit: () => void;
  onDownload: () => void;
  onSend: () => void;
}

export function ViewQuotationModal({
  open,
  onOpenChange,
  quotation,
  onEdit,
  onDownload,
  onSend
}: ViewQuotationModalProps) {
  // Get company data for logo
  const { currentCompany } = useCurrentCompany();

  if (!quotation) return null;

  const formatCurrency = (amount: number, currency?: string | null) =>
    formatCurrencyUtil(amount, currency);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-muted text-muted-foreground border-muted-foreground/20';
      case 'sent':
        return 'bg-warning-light text-warning border-warning/20';
      case 'accepted':
        return 'bg-success-light text-success border-success/20';
      case 'rejected':
        return 'bg-destructive-light text-destructive border-destructive/20';
      case 'expired':
        return 'bg-destructive-light text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-muted-foreground/20';
    }
  };

  // Group quotation items by section
  const groupedSections = quotation.quotation_items ?
    quotation.quotation_items.reduce((acc: any, item: any) => {
      const sectionName = item.section_name || 'General Items';
      if (!acc[sectionName]) {
        acc[sectionName] = [];
      }
      acc[sectionName].push(item);
      return acc;
    }, {} as Record<string, any[]>)
    : {};

  const sectionNames = Object.keys(groupedSections).sort();

  const calculateSectionMaterials = (items: any[]) => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const calculateSectionTotal = (items: any[]) => {
    const materialsTotal = calculateSectionMaterials(items);
    const laborCost = items[0]?.section_labor_cost || 0;
    return materialsTotal + laborCost;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Quotation {quotation.quotation_number}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className={getStatusColor(quotation.status)}>
                {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
              </Badge>
              <div className="flex space-x-1">
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={onDownload}>
                  <Download className="h-4 w-4" />
                </Button>
                {quotation.status === 'draft' && (
                  <Button variant="outline" size="sm" onClick={onSend}>
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            View quotation details and manage quotation status
          </DialogDescription>
        </DialogHeader>

        {/* Quotation Content - Styled consistently with brand invoice */}
        <div className="bg-background border rounded-lg p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              {currentCompany?.logo_url ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={currentCompany.logo_url}
                    alt={`${currentCompany.name} Logo`}
                    className="h-20 w-auto object-contain"
                    onError={(e) => {
                      // Fallback to BiolegendLogo if company logo fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLElement).nextElementSibling?.setAttribute('style', 'display: block');
                    }}
                  />
                  <BiolegendLogo size="lg" showText={true} style={{ display: 'none' }} />
                </div>
              ) : (
                <BiolegendLogo size="lg" showText={true} />
              )}
              <div className="text-sm text-muted-foreground space-y-1">
                {currentCompany ? (
                  <>
                    {currentCompany.tax_number && <div>PIN: {currentCompany.tax_number}</div>}
                    {currentCompany.address && <div>{currentCompany.address}</div>}
                    {(currentCompany.city || currentCompany.country) && (
                      <div>
                        {currentCompany.city}{currentCompany.city && currentCompany.country ? ', ' : ''}{currentCompany.country}
                      </div>
                    )}
                    {currentCompany.phone && <div>Tel: {currentCompany.phone}</div>}
                    {currentCompany.email && <div>Email: {currentCompany.email}</div>}
                    {currentCompany.website && <div>Website: {currentCompany.website}</div>}
                  </>
                ) : (
                  <>
                    <div>P.O Box 85988-00200, Nairobi, Kenya</div>
                    <div>Tel: 0741 207 690/0780 165 490</div>
                    <div>Email: biolegend@biolegendscientific.co.ke/info@biolegendscientific.co.ke</div>
                    <div>Website: www.biolegendscientific.co.ke</div>
                    <div className="text-xs italic text-primary/70">Delivering Discoveries.... and more</div>
                  </>
                )}
              </div>
            </div>
            
            <div className="text-right space-y-2">
              <h1 className="text-2xl font-bold text-primary">QUOTATION</h1>
              <div className="space-y-1 text-sm">
                <div><span className="font-semibold">Quote No:</span> {quotation.quotation_number}</div>
                <div><span className="font-semibold">Date:</span> {formatDate(quotation.quotation_date)}</div>
                {quotation.valid_until && (
                  <div><span className="font-semibold">Valid Until:</span> {formatDate(quotation.valid_until)}</div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <User className="h-5 w-5 text-primary" />
                  <span>Quote To:</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="font-semibold text-lg">{quotation.customers?.name}</div>
                {quotation.customers?.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{quotation.customers.email}</span>
                  </div>
                )}
                {quotation.customers?.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{quotation.customers.phone}</span>
                  </div>
                )}
                {quotation.customers?.address && (
                  <div className="flex items-start space-x-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div>{quotation.customers.address}</div>
                      {quotation.customers?.city && (
                        <div>{quotation.customers.city}, {quotation.customers?.country || 'Kenya'}</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>Quotation Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={getStatusColor(quotation.status)}>
                    {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quote Date:</span>
                  <span>{formatDate(quotation.quotation_date)}</span>
                </div>
                {quotation.valid_until && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid Until:</span>
                    <span>{formatDate(quotation.valid_until)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold text-primary">{formatCurrency(quotation.total_amount || 0, quotation.currency || 'KES')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items by Sections */}
          {quotation.quotation_items && quotation.quotation_items.length > 0 ? (
            <div className="space-y-6">
              {sectionNames.map((sectionName) => {
                const sectionItems = groupedSections[sectionName];
                const materialsCost = calculateSectionMaterials(sectionItems);
                const laborCost = sectionItems[0]?.section_labor_cost || 0;
                const sectionTotal = calculateSectionTotal(sectionItems);

                return (
                  <Card key={sectionName} className="break-inside-avoid">
                    <CardHeader className="bg-muted/50 pb-3">
                      <CardTitle className="text-lg">{sectionName}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {/* Subsection A: Materials */}
                      <div className="mb-3 font-semibold">A. Materials</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Description</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-center">Unit</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectionItems.map((item: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.description}</div>
                                  {item.products?.name && item.products.name !== item.description && (
                                    <div className="text-sm text-muted-foreground">{item.products.name}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-center">{item.unit_of_measure || item.products?.unit_of_measure || 'Each'}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unit_price, quotation.currency || 'KES')}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(item.line_total, quotation.currency || 'KES')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Subsection B: Labour */}
                      {laborCost > 0 && (
                        <div className="mt-6">
                          <div className="mb-2 font-semibold">B. Labour</div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Labour for {sectionName}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(laborCost, quotation.currency || 'KES')}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Section Totals */}
                      <div className="mt-6 border-t pt-4">
                        <div className="flex justify-end">
                          <div className="w-80 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total {sectionName} Materials:</span>
                              <span className="font-semibold">{formatCurrency(materialsCost, quotation.currency || 'KES')}</span>
                            </div>
                            {laborCost > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{sectionName} Labour:</span>
                                <span className="font-semibold">{formatCurrency(laborCost, quotation.currency || 'KES')}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-2">
                              <span className="font-semibold">Section Total:</span>
                              <span className="font-bold text-primary">{formatCurrency(sectionTotal, quotation.currency || 'KES')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Grand Totals */}
              <Card>
                <CardHeader className="bg-primary/10 pb-3">
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between">
                        <span>Total Materials:</span>
                        <span className="font-semibold">{formatCurrency(quotation.subtotal || 0, quotation.currency || 'KES')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span className="font-semibold">{formatCurrency(quotation.tax_amount || 0, quotation.currency || 'KES')}</span>
                      </div>
                      <div className="flex justify-between text-lg border-t pt-2">
                        <span className="font-bold">Grand Total:</span>
                        <span className="font-bold text-primary">{formatCurrency(quotation.total_amount || 0, quotation.currency || 'KES')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No items found for this quotation
              </CardContent>
            </Card>
          )}

          {/* Notes and Terms */}
          {(quotation.notes || quotation.terms_and_conditions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quotation.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
                  </CardContent>
                </Card>
              )}

              {quotation.terms_and_conditions && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Terms and Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.terms_and_conditions}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-6 border-t">
            <div className="mb-2 flex justify-center">
              {currentCompany?.logo_url ? (
                <img
                  src={currentCompany.logo_url}
                  alt={`${currentCompany.name} Logo`}
                  className="h-12 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to BiolegendLogo if company logo fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLElement).nextElementSibling?.setAttribute('style', 'display: block');
                  }}
                />
              ) : null}
              <BiolegendLogo size="sm" showText={true} className="justify-center" style={{ display: currentCompany?.logo_url ? 'none' : 'block' }} />
            </div>
            <div>{currentCompany?.name || 'Your Medical & Laboratory Supplies Partner'}</div>
            {currentCompany?.business_description ? (
              <div className="mt-1">{currentCompany.business_description}</div>
            ) : (
              <div className="mt-1">Medical Supplies • Laboratory Supplies • Technical Equipment</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
