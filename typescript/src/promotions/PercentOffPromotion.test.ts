// ABOUTME: Unit tests for PercentOffPromotion
// ABOUTME: Tests discount calculation, rounding, applicability, and explainability

import { describe, it, expect, beforeEach } from 'vitest';
import { PercentOffPromotion } from './PercentOffPromotion';
import { Cart, LineItem, Product, Sku, Quantity, Money, PromotionId, Percentage } from '../domain';
import { PricingContext } from '../pricing';

describe('PercentOffPromotion', () => {
  let context: PricingContext;
  let productA: Product;
  let productB: Product;

  beforeEach(() => {
    context = new PricingContext(
      new Date('2025-12-18T10:00:00Z'),
      'online',
      'CUST001',
      new Set(['new'])
    );

    productA = new Product(new Sku('SKU-A'), 'Product A', 'electronics');
    productB = new Product(new Sku('SKU-B'), 'Product B', 'electronics');
  });

  describe('isApplicable', () => {
    it('should be applicable when cart contains eligible SKU', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      expect(promotion.isApplicable(cart, context)).toBe(true);
    });

    it('should not be applicable when cart does not contain eligible SKU', () => {
      const cart = new Cart([new LineItem(productB, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      expect(promotion.isApplicable(cart, context)).toBe(false);
    });

    it('should be applicable when cart contains one of multiple eligible SKUs', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-AB'),
        new Percentage(10),
        new Set([new Sku('SKU-A'), new Sku('SKU-B')])
      );

      expect(promotion.isApplicable(cart, context)).toBe(true);
    });

    it('should not be applicable when cart is empty', () => {
      const cart = new Cart([]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      expect(promotion.isApplicable(cart, context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should calculate discount for single eligible line item', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      expect(discounts[0].amount.amount.toFixed(2)).toBe('1.00');
      expect(discounts[0].promotionId.equals(new PromotionId('PROMO-10-OFF-A'))).toBe(true);
    });

    it('should calculate discount for multiple quantities of same SKU', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(2), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // 2 × €10.00 × 10% = €2.00
      expect(discounts[0].amount.amount.toFixed(2)).toBe('2.00');
    });

    it('should calculate discount for multiple eligible line items', () => {
      const cart = new Cart([
        new LineItem(productA, new Quantity(1), Money.euros('10.00')),
        new LineItem(productB, new Quantity(1), Money.euros('20.00')),
      ]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-AB'),
        new Percentage(10),
        new Set([new Sku('SKU-A'), new Sku('SKU-B')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // (€10.00 × 10%) + (€20.00 × 10%) = €1.00 + €2.00 = €3.00
      expect(discounts[0].amount.amount.toFixed(2)).toBe('3.00');
    });

    it('should apply discount only to eligible SKUs in mixed cart', () => {
      const cart = new Cart([
        new LineItem(productA, new Quantity(1), Money.euros('10.00')),
        new LineItem(productB, new Quantity(1), Money.euros('20.00')),
      ]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // Only SKU-A: €10.00 × 10% = €1.00
      expect(discounts[0].amount.amount.toFixed(2)).toBe('1.00');
    });

    it('should return empty array when no eligible SKUs in cart', () => {
      const cart = new Cart([new LineItem(productB, new Quantity(1), Money.euros('20.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(0);
    });
  });

  describe('rounding', () => {
    it('should round discount per line using ROUND_HALF_UP', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(3), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-33-OFF-A'),
        new Percentage(33.33),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // €30.00 × 33.33% = €9.999 → €10.00 (rounded HALF_UP)
      expect(discounts[0].amount.amount.toFixed(2)).toBe('10.00');
    });

    it('should handle rounding with 0.5 cents correctly', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.05'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-50-OFF-A'),
        new Percentage(50),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // €10.05 × 50% = €5.025 → €5.03 (rounded HALF_UP)
      expect(discounts[0].amount.amount.toFixed(2)).toBe('5.03');
    });

    it('should handle rounding with multiple line items', () => {
      const cart = new Cart([
        new LineItem(productA, new Quantity(1), Money.euros('10.01')),
        new LineItem(productB, new Quantity(1), Money.euros('10.01')),
      ]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-33-OFF-AB'),
        new Percentage(33.33),
        new Set([new Sku('SKU-A'), new Sku('SKU-B')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // (€10.01 × 33.33%) + (€10.01 × 33.33%) = €3.34 + €3.34 = €6.68
      expect(discounts[0].amount.amount.toFixed(2)).toBe('6.68');
    });
  });

  describe('edge cases', () => {
    it('should handle 0% discount', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('100.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-0-OFF-A'),
        new Percentage(0),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      expect(discounts[0].amount.amount.toFixed(2)).toBe('0.00');
    });

    it('should handle 100% discount', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('100.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-100-OFF-A'),
        new Percentage(100),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      expect(discounts[0].amount.amount.toFixed(2)).toBe('100.00');
    });

    it('should handle very small percentages', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('100.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-0.01-OFF-A'),
        new Percentage(0.01),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // €100.00 × 0.01% = €0.01
      expect(discounts[0].amount.amount.toFixed(2)).toBe('0.01');
    });

    it('should handle very large amounts', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('999999.99'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts).toHaveLength(1);
      // €999999.99 × 10% = €100000.00
      expect(discounts[0].amount.amount.toFixed(2)).toBe('100000.00');
    });
  });

  describe('explainability', () => {
    it('should include promotion ID in applied discount', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts[0].promotionId.equals(new PromotionId('PROMO-10-OFF-A'))).toBe(true);
    });

    it('should include details in applied discount', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts[0].details).toBeDefined();
      expect(discounts[0].details.length).toBeGreaterThan(0);
      // Details should mention percentage and SKU
      expect(discounts[0].details).toContain('10');
      expect(discounts[0].details).toContain('SKU-A');
    });

    it('should include per-SKU allocations in applied discount', () => {
      const cart = new Cart([
        new LineItem(productA, new Quantity(1), Money.euros('10.00')),
        new LineItem(productB, new Quantity(1), Money.euros('20.00')),
      ]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-AB'),
        new Percentage(10),
        new Set([new Sku('SKU-A'), new Sku('SKU-B')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts[0].allocations).toBeDefined();
      expect(discounts[0].allocations?.size).toBe(2);

      // Verify SKU-A allocation
      const skuAAllocation = Array.from(discounts[0].allocations?.entries() || []).find(
        ([sku]) => sku.value === 'SKU-A'
      );
      expect(skuAAllocation).toBeDefined();
      expect(skuAAllocation?.[1].amount.toFixed(2)).toBe('1.00');

      // Verify SKU-B allocation
      const skuBAllocation = Array.from(discounts[0].allocations?.entries() || []).find(
        ([sku]) => sku.value === 'SKU-B'
      );
      expect(skuBAllocation).toBeDefined();
      expect(skuBAllocation?.[1].amount.toFixed(2)).toBe('2.00');
    });

    it('should have line target in applied discount', () => {
      const cart = new Cart([new LineItem(productA, new Quantity(1), Money.euros('10.00'))]);

      const promotion = new PercentOffPromotion(
        new PromotionId('PROMO-10-OFF-A'),
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      const discounts = promotion.apply(cart, context);

      expect(discounts[0].target).toBe('line');
    });
  });

  describe('id method', () => {
    it('should return the promotion ID', () => {
      const promotionId = new PromotionId('PROMO-10-OFF-A');
      const promotion = new PercentOffPromotion(
        promotionId,
        new Percentage(10),
        new Set([new Sku('SKU-A')])
      );

      expect(promotion.id().equals(promotionId)).toBe(true);
    });
  });
});
