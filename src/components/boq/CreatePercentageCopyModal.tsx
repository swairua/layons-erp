import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useBOQs } from '@/hooks/useDatabase';
import { fetchBOQByNumber, createPercentageCopy, saveBOQCopy } from '@/utils/boqHelper';
import { generateNextBOQNumber } from '@/utils/boqNumberGenerator';

interface CreatePercentageCopyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: () => void;
}

export function CreatePercentageCopyModal({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: CreatePercentageCopyModalProps) {
  const { profile } = useAuth();
  const { data: availableBOQs = [] } = useBOQs(companyId);
  const [boqNumber, setBoqNumber] = useState('');
  const [percentage, setPercentage] = useState(40);
  const [newBoqNumber, setNewBoqNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const generateNewNumber = () => {
    const newNum = generateNextBOQNumber(availableBOQs);
    setNewBoqNumber(newNum);
  };

  useEffect(() => {
    if (open) {
      if (availableBOQs.length > 0 && !boqNumber) {
        setBoqNumber(availableBOQs[0].number);
      }
      generateNewNumber();
    }
  }, [open, availableBOQs]);

  const handleCreate = async () => {
    if (!boqNumber.trim()) {
      toast.error('Please enter a BOQ number to copy from');
      return;
    }
    if (!newBoqNumber.trim()) {
      toast.error('Please enter a new BOQ number');
      return;
    }
    if (percentage <= 0 || percentage > 100) {
      toast.error('Percentage must be between 0 and 100');
      return;
    }

    setLoading(true);
    try {
      const originalBOQ = await fetchBOQByNumber(boqNumber, companyId);
      if (!originalBOQ) {
        toast.error(`BOQ ${boqNumber} not found`);
        return;
      }

      const boqCopy = createPercentageCopy(originalBOQ, percentage, newBoqNumber);

      const savedBOQ = await saveBOQCopy(
        {
          number: boqCopy.number,
          boq_date: boqCopy.boq_date,
          client_name: boqCopy.client_name,
          client_email: boqCopy.client_email,
          client_phone: boqCopy.client_phone,
          client_address: boqCopy.client_address,
          client_city: boqCopy.client_city,
          client_country: boqCopy.client_country,
          contractor: boqCopy.contractor,
          project_title: boqCopy.project_title,
          currency: boqCopy.currency,
          subtotal: boqCopy.subtotal,
          tax_amount: boqCopy.tax_amount,
          total_amount: boqCopy.total_amount,
          data: boqCopy.data,
          company_id: companyId,
          attachment_url: originalBOQ.attachment_url,
        },
        profile?.id
      );

      if (!savedBOQ) {
        toast.error('Failed to save BOQ copy');
        return;
      }

      const origAmount = Number(originalBOQ.total_amount ?? 0);
      toast.success(
        `BOQ copy created: ${newBoqNumber} (${percentage}% of original: ${origAmount.toFixed(2)})`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error creating BOQ copy:', err);
      toast.error('Failed to create BOQ copy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create BOQ Copy with Percentage</DialogTitle>
          <DialogDescription>
            Create a new BOQ with specified percentage of quantities and totals
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="source-boq">Source BOQ</Label>
            {availableBOQs.length > 0 ? (
              <Select value={boqNumber} onValueChange={setBoqNumber}>
                <SelectTrigger id="source-boq">
                  <SelectValue placeholder="Select a BOQ" />
                </SelectTrigger>
                <SelectContent>
                  {availableBOQs.map((boq: any) => (
                    <SelectItem key={boq.id} value={boq.number}>
                      {boq.number} - {boq.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="source-boq"
                value={boqNumber}
                onChange={(e) => setBoqNumber(e.target.value)}
                placeholder="e.g., BOQ-001"
              />
            )}
          </div>

          <div>
            <Label htmlFor="percentage">Percentage of Original</Label>
            <div className="flex items-center gap-2">
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div>
            <Label htmlFor="new-boq">New BOQ Number</Label>
            <div className="flex items-center gap-2">
              <Input
                id="new-boq"
                value={newBoqNumber}
                onChange={(e) => setNewBoqNumber(e.target.value)}
                placeholder="Auto-generated"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateNewNumber}
              >
                Regenerate
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
