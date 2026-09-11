import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { lclBoqService, LCLBOQRecord } from '@/services/lclBoqService';
import { AlertCircle, ChevronRight, Download } from 'lucide-react';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useCustomers } from '@/hooks/useDatabase';
import { downloadLCLBOQPDF } from '@/utils/lclBoqPdfGenerator';
import { LCLHierarchicalData, LCLTemplateStructure } from '@/types/lclTemplate';
import { formatNumberWithoutTrailingZeros } from '@/utils/numberFormatter';
import { toCollection } from '@/utils/collection';

interface EditLCLBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  boq: LCLBOQRecord;
  onSaved: () => Promise<void>;
  templateStructure?: LCLTemplateStructure;
}

interface InlineEdit {
  qty?: number;
  rate?: number;
  description?: string;
}

interface ItemSnapshot {
  section_id: string;
  section_name?: string;
  subsection_id: string;
  subsection_name?: string;
  item_number: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export function EditLCLBOQModal({
  isOpen,
  onClose,
  boq,
  onSaved,
  templateStructure,
}: EditLCLBOQModalProps) {
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const inlineEditsRef = useRef<{ [itemId: string]: InlineEdit }>({});

  const toggleSection = (letter: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) {
        next.delete(letter);
      } else {
        next.add(letter);
      }
      return next;
    });
  };
  const { toast } = useToast();
  const { currentCompany } = useCurrentCompany();
  const { data: customersResponse } = useCustomers(currentCompany?.id || '');
  const customers = toCollection(customersResponse);

  // Helper function to get section name from template or items snapshot
  const getSectionNameFromTemplate = (sectionId: string): string | undefined => {
    if (!templateStructure || !templateStructure.structure_data?.sections) {
      return undefined;
    }

    const section = templateStructure.structure_data.sections.find(
      s => s.id?.toLowerCase() === sectionId?.toLowerCase()
    );
    return section?.name;
  };

  const extractSections = (itemsSnapshot: ItemSnapshot[]): Array<{ letter: string; name?: string }> => {
    const sectionsMap = new Map<string, { letter: string; name?: string }>();
    itemsSnapshot.forEach((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      if (match) {
        const letter = match[1].toUpperCase();
        if (!sectionsMap.has(letter)) {
          // Use section_name from snapshot, or fallback to template
          const sectionName = item.section_name || getSectionNameFromTemplate(item.section_id);
          sectionsMap.set(letter, {
            letter,
            name: sectionName,
          });
        }
      }
    });
    return Array.from(sectionsMap.values()).sort((a, b) => a.letter.localeCompare(b.letter));
  };

  const getItemsForSection = (sectionLetter: string): ItemSnapshot[] => {
    return items.filter((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      return match && match[1].toUpperCase() === sectionLetter;
    });
  };

  const reconstructHierarchicalData = (): LCLHierarchicalData => {
    const sections: any[] = [];
    const sectionLetters = extractSections(items);

    sectionLetters.forEach((sectionObj) => {
      const sectionItems = getItemsForSection(sectionObj.letter);
      const subsectionsMap = new Map<string, ItemSnapshot[]>();

      sectionItems.forEach((item) => {
        if (!subsectionsMap.has(item.subsection_id)) {
          subsectionsMap.set(item.subsection_id, []);
        }
        subsectionsMap.get(item.subsection_id)?.push(item);
      });

      const subsections: any[] = [];
      let sectionTotal = 0;

      subsectionsMap.forEach((subsectionItems, subsectionId) => {
        let subtotal = 0;
        let preservedSubsectionName: string | undefined;

        const processedItems = subsectionItems.map((item) => {
          if (!preservedSubsectionName && item.subsection_name) {
            preservedSubsectionName = item.subsection_name;
          }
          return {
            ...item,
            amount: item.qty * item.rate,
          };
        });

        subsectionItems.forEach((item) => {
          subtotal += item.qty * item.rate;
        });

        subsections.push({
          subsection_id: subsectionId,
          subsection_name: preservedSubsectionName || subsectionId,
          items: processedItems,
          subtotal,
        });

        sectionTotal += subtotal;
      });

      sections.push({
        section_id: `section-${sectionObj.letter}`,
        section_name: sectionObj.name || `SECTION ${sectionObj.letter}`,
        subsections,
        total: sectionTotal,
      });
    });

    const grandTotal = sections.reduce((sum, sec) => sum + sec.total, 0);

    return {
      structure_id: 'reconstructed',
      structure_name: 'Bill of Quantities',
      sections,
      grand_total: grandTotal,
    };
  };

  useEffect(() => {
    if (isOpen && boq.items_snapshot) {
      setItems(boq.items_snapshot);
      setInlineEdits({});
      inlineEditsRef.current = {};
      const sections = extractSections(boq.items_snapshot);
      setExpandedSections(new Set(sections.map((s) => s.letter)));
    }
  }, [isOpen, boq]);

  useEffect(() => {
    inlineEditsRef.current = inlineEdits;
  }, [inlineEdits]);


  const handleQtyChange = (itemIndex: number, value: string) => {
    const qty = value === '' ? 0 : parseFloat(value);
    if (qty < 0) return;

    const itemId = `item-${itemIndex}`;
    const finalQty = isNaN(qty) ? 0 : qty;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: finalQty },
    }));
    setSaveStatus('unsaved');
  };

  const handleRateChange = (itemIndex: number, value: string) => {
    const rate = value === '' ? 0 : parseFloat(value);
    if (rate < 0) return;

    const itemId = `item-${itemIndex}`;
    const finalRate = isNaN(rate) ? 0 : rate;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], rate: finalRate },
    }));
    setSaveStatus('unsaved');
  };

  const handleDescriptionChange = (itemIndex: number, value: string) => {
    const itemId = `item-${itemIndex}`;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], description: value },
    }));
    setSaveStatus('unsaved');
  };


  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const customerInfo = boq.customer_id
        ? customers?.find((c) => c.id === boq.customer_id)
        : null;

      const hierarchicalData = reconstructHierarchicalData();

      await downloadLCLBOQPDF(
        hierarchicalData,
        boq.number,
        boq.boq_date || new Date().toISOString().split('T')[0],
        customerInfo?.name || 'Unknown Customer',
        boq.project_title || '',
        {
          name: currentCompany?.name || '',
          logo_url: currentCompany?.logo_url,
          address: currentCompany?.address,
          city: currentCompany?.city,
          country: currentCompany?.country,
          phone: currentCompany?.phone,
          email: currentCompany?.email,
        }
      );

      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveAll = async () => {
    // If no unsaved changes, just close
    if (Object.keys(inlineEdits).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      // Step 1: Validate boq.id exists before attempting save
      if (!boq.id) {
        console.error('CRITICAL: Cannot save BOQ - ID is missing', { boq });
        throw new Error('Cannot save: BOQ ID is missing. This is a critical data issue. Please reload and try again.');
      }

      console.log('Starting BOQ save', {
        boqId: boq.id,
        editsCount: Object.keys(inlineEdits).length,
        itemsCount: items.length
      });

      // Apply all inline edits to items
      const updatedItems = items.map((item, idx) => {
        const itemId = `item-${idx}`;
        const edit = inlineEdits[itemId];
        if (edit) {
          const qty = edit.qty !== undefined ? edit.qty : item.qty;
          const rate = edit.rate !== undefined ? edit.rate : item.rate;
          return {
            ...item,
            qty,
            rate,
            description: edit.description !== undefined ? edit.description : item.description,
            amount: qty * rate,
          };
        }
        return item;
      });

      const savePayload = {
        ...boq,
        items_snapshot: updatedItems,
        updated_at: new Date().toISOString(),
      };

      console.log('Save payload prepared', {
        id: savePayload.id,
        itemsCount: updatedItems.length,
        sampleItem: updatedItems[0]
      });

      const result = await lclBoqService.saveLCLBOQ(savePayload);

      console.log('Save completed successfully', {
        resultId: result.id,
        updatedAt: result.updated_at
      });

      setItems(updatedItems);
      setInlineEdits({});
      setSaveStatus(null);
      inlineEditsRef.current = {};

      toast({
        title: 'Success',
        description: 'BOQ updated successfully',
      });
      await onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving BOQ:', error);
      setSaveStatus('unsaved');
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save BOQ',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const sections = extractSections(items);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <DialogTitle>Edit LCL BOQ</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {sections.length} section{sections.length !== 1 ? 's' : ''} &mdash; click to expand/collapse
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">BOQ Number</p>
                <p className="text-sm font-semibold">{boq.number}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={downloading}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloading ? 'Downloading...' : 'Download PDF'}
              </Button>
            </div>
          </div>
          <DialogDescription>
            Edit line items below. BOQ number and other header details cannot be changed.
          </DialogDescription>
        </DialogHeader>

        {saveStatus === 'unsaved' && (
          <div className="flex items-center gap-2 p-3 rounded text-sm bg-yellow-50 text-yellow-900 mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Unsaved changes</span>
          </div>
        )}

        <div className="space-y-4">
          {sections.map((sectionObj) => {
            const sectionLetter = sectionObj.letter;
            const sectionItems = getItemsForSection(sectionLetter);
            const isExpanded = expandedSections.has(sectionLetter);

            // Build subsection map
            const subsectionsMap = new Map<string, ItemSnapshot[]>();
            sectionItems.forEach((item) => {
              if (!subsectionsMap.has(item.subsection_id)) {
                subsectionsMap.set(item.subsection_id, []);
              }
              subsectionsMap.get(item.subsection_id)?.push(item);
            });

            // Pre-compute item amounts with inline edits for all items in this section
            const getInlineItem = (item: ItemSnapshot) => {
              const fullIndex = items.findIndex(
                (i) => i.item_number === item.item_number && i.description === item.description
              );
              const itemId = `item-${fullIndex}`;
              const edit = inlineEdits[itemId];
              const qty = edit?.qty !== undefined ? edit.qty : item.qty;
              const rate = edit?.rate !== undefined ? edit.rate : item.rate;
              const amount = qty * rate;
              return { item, fullIndex, itemId, edit, qty, rate, amount };
            };

            let sectionTotal = 0;
            const subsectionEntries = Array.from(subsectionsMap.entries()).map(([ssId, ssItems]) => {
              let subsectionName = '';
              let subtotal = 0;
              const itemsWithAmount = ssItems.map((item) => {
                const ia = getInlineItem(item);
                if (!subsectionName && item.subsection_name) {
                  subsectionName = item.subsection_name;
                }
                subtotal += ia.amount;
                return ia;
              });
              sectionTotal += subtotal;
              return { subsectionId: ssId, subsectionName, itemsWithAmount, subtotal };
            });

            return (
              <div key={sectionLetter} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(sectionLetter)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    <span className="font-semibold text-sm truncate">
                      {sectionObj.name ? `SECTION ${sectionLetter}: ${sectionObj.name}` : `SECTION ${sectionLetter}`}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {formatNumberWithoutTrailingZeros(sectionTotal)}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {subsectionEntries.map((entry) => (
                      <div key={entry.subsectionId} className="mt-4">
                        <div className="text-sm font-medium text-muted-foreground mb-2">
                          &rarr; {entry.subsectionName || entry.subsectionId}
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-1/3">Description</TableHead>
                                <TableHead className="w-20">Unit</TableHead>
                                <TableHead className="w-24">Qty</TableHead>
                                <TableHead className="w-24">Rate</TableHead>
                                <TableHead className="w-24 text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.itemsWithAmount.map((ia, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <Input
                                      value={ia.edit?.description !== undefined ? ia.edit.description : ia.item.description}
                                      onChange={(e) => handleDescriptionChange(ia.fullIndex, e.target.value)}
                                      className="text-sm"
                                    />
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {ia.item.unit}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(ia.qty)}
                                      onChange={(e) => handleQtyChange(ia.fullIndex, e.target.value)}
                                      className="text-sm w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                      min="0"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(ia.rate)}
                                      onChange={(e) => handleRateChange(ia.fullIndex, e.target.value)}
                                      className="text-sm w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                      min="0"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-sm tabular-nums">
                                    {formatNumberWithoutTrailingZeros(ia.amount)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={4} className="text-right text-sm font-medium text-muted-foreground">
                                  Subtotal
                                </TableCell>
                                <TableCell className="text-right font-medium text-sm tabular-nums">
                                  {formatNumberWithoutTrailingZeros(entry.subtotal)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end mt-4 pt-2 border-t">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Section Total</div>
                        <div className="text-lg font-bold tabular-nums">
                          {formatNumberWithoutTrailingZeros(sectionTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || Object.keys(inlineEdits).length === 0}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
