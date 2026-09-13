import { useEffect, useRef } from 'react';

/**
 * Converts all monetary values in items/sections when currency changes.
 *
 * Rate semantics: useExchangeRate('USD', 'KES') returns ~130, meaning
 *   1 USD = 130 KES. When switching currencies, amounts are converted
 *   using: newValue = oldValue * (previousRate / newRate).
 *
 * @param exchangeRate - current exchange rate (1 for base currency)
 * @param isOpen - whether the modal is open
 * @param setSections - setter for sectioned data (quotation, invoice)
 * @param sections - current sections array
 * @param setItems - setter for flat data (LPO, proforma)
 * @param items - current flat items array
 * @param setAmount - setter for single amount (payment)
 * @param amount - current amount value
 */
interface UseCurrencyConversionOptions {
  exchangeRate: number;
  isOpen: boolean;
  setSections?: (sections: any[]) => void;
  sections?: any[];
  setItems?: (items: any[]) => void;
  items?: any[];
  setAmount?: (amount: number | '') => void;
  amount?: number | '';
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function convertSectionItems(sections: any[], factor: number): any[] {
  return sections.map(section => ({
    ...section,
    labor_cost: section.labor_cost !== undefined && section.labor_cost !== ''
      ? roundToTwo(Number(section.labor_cost) * factor)
      : section.labor_cost,
    subsections: section.subsections?.map((sub: any) => ({
      ...sub,
      items: sub.items?.map((item: any) => ({
        ...item,
        rate: roundToTwo((Number(item.rate) || 0) * factor),
      })),
    })),
    items: section.items?.map((item: any) => {
      const converted: any = {
        ...item,
        unit_price: roundToTwo((Number(item.unit_price) || 0) * factor),
        line_total: roundToTwo((Number(item.line_total) || 0) * factor),
      };
      if (item.tax_amount !== undefined) {
        converted.tax_amount = roundToTwo((Number(item.tax_amount) || 0) * factor);
      }
      return converted;
    }),
  }));
}

function convertFlatItems(items: any[], factor: number): any[] {
  return items.map(item => ({
    ...item,
    unit_price: roundToTwo((Number(item.unit_price) || 0) * factor),
    line_total: roundToTwo((Number(item.line_total) || 0) * factor),
    tax_amount: item.tax_amount !== undefined
      ? roundToTwo((Number(item.tax_amount) || 0) * factor)
      : item.tax_amount,
    discount_amount: item.discount_amount !== undefined
      ? roundToTwo((Number(item.discount_amount) || 0) * factor)
      : item.discount_amount,
  }));
}

export function useCurrencyConversion({
  exchangeRate,
  isOpen,
  setSections,
  sections,
  setItems,
  items,
  setAmount,
  amount,
}: UseCurrencyConversionOptions) {
  const previousRateRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      previousRateRef.current = 0;
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || exchangeRate <= 0) return;

    const hasData =
      (setSections && sections && sections.length > 0) ||
      (setItems && items && items.length > 0) ||
      (setAmount && amount !== undefined && amount !== '');

    if (!hasData) {
      previousRateRef.current = exchangeRate;
      return;
    }

    const prevRate = previousRateRef.current;

    if (prevRate > 0 && Math.abs(prevRate - exchangeRate) > 0.0001) {
      const factor = Number((prevRate / exchangeRate).toFixed(4));

      if (factor !== 1) {
        if (setSections && sections && sections.length > 0) {
          setSections(convertSectionItems(sections, factor));
        } else if (setItems && items && items.length > 0) {
          setItems(convertFlatItems(items, factor));
        } else if (setAmount && amount !== undefined && amount !== '') {
          setAmount(roundToTwo(Number(amount) * factor));
        }
      }
    }

    previousRateRef.current = exchangeRate;
  }, [exchangeRate, isOpen, sections, items, amount, setSections, setItems, setAmount]);
}
