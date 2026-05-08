// ABOUTME: Promotion that applies a percentage discount to eligible products
// ABOUTME: Calculates discount per line with ROUND_HALF_UP rounding

import { Promotion } from './Promotion';
import { PromotionId } from '../domain/PromotionId';
import { Percentage } from '../domain/Percentage';
import { Sku } from '../domain/Sku';
import { Cart } from '../domain/Cart';
import { Money } from '../domain/Money';
import { PricingContext, AppliedDiscount } from '../pricing';

export class PercentOffPromotion implements Promotion {
  constructor(
    private readonly promotionId: PromotionId,
    private readonly percentage: Percentage,
    private readonly eligibleSkus: ReadonlySet<Sku>
  ) {}

  id(): PromotionId {
    return this.promotionId;
  }

  isApplicable(cart: Cart, _context: PricingContext): boolean {
    // Promotion is applicable if cart contains at least one eligible SKU
    return cart.lines.some((line) =>
      Array.from(this.eligibleSkus).some((sku) => sku.equals(line.product.sku))
    );
  }

  apply(cart: Cart, _context: PricingContext): AppliedDiscount[] {
    // Calculate discount for each eligible line item
    const allocations = new Map<Sku, Money>();
    let totalDiscount = Money.euros(0);

    for (const line of cart.lines) {
      // Check if this line's SKU is eligible
      const isEligible = Array.from(this.eligibleSkus).some((sku) => sku.equals(line.product.sku));

      if (isEligible) {
        // Calculate discount for this line: unit_price × quantity × percentage
        const lineSubtotal = line.subtotal();
        const lineDiscount = lineSubtotal.multiply(this.percentage.asDecimal());

        allocations.set(line.product.sku, lineDiscount);
        totalDiscount = totalDiscount.add(lineDiscount);
      }
    }

    // If no eligible SKUs found, return empty array
    if (allocations.size === 0) {
      return [];
    }

    // Build details string
    const skuList = Array.from(allocations.keys())
      .map((sku) => sku.value)
      .join(', ');
    const details = `${this.percentage.value}% off ${skuList}`;

    // Return single AppliedDiscount with per-SKU allocations
    return [new AppliedDiscount(this.promotionId, totalDiscount, 'line', details, allocations)];
  }
}
