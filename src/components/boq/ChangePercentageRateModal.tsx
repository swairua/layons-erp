import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ChangePercentageRateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boq: any;
  onDownload: (data: { percentage: number; multiplier: number }) => Promise<void>;
}

export function ChangePercentageRateModal({
  open,
  onOpenChange,
  boq,
  onDownload
}: ChangePercentageRateModalProps) {
  const [percentage, setPercentage] = useState(40);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    if (percentage < 0 || percentage > 100) {
      toast.error('Percentage must be between 0 and 100');
      return;
    }

    setIsLoading(true);
    try {
      await onDownload({ percentage, multiplier: percentage / 100 });
      onOpenChange(false);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPercentage(40);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Invoice PDF</DialogTitle>
          <DialogDescription>
            Set the percentage rate for {boq?.number} invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="percentage">Percentage Rate (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                step="1"
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value) || 0)}
                className="flex-1"
              />
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The invoice amount will be {percentage}% of the BOQ total
            </p>
          </div>

          <div className="bg-muted/50 rounded-md p-3 space-y-2">
            <p className="text-sm font-medium">Invoice Details</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Currency: EUR</li>
              <li>• Client: Global Crop Diversity Trust</li>
              <li>• Location: Bonn, Germany</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading}
            className="gradient-primary text-primary-foreground"
          >
            {isLoading ? 'Downloading...' : 'Download PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
