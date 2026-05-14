import { describe, expect, it } from 'vitest';
import { buildCompensationDashboardReport, type CompensationLedgerEntry } from '../../src/services/complaintCompensationService';

const makeEntry = (overrides: Partial<CompensationLedgerEntry>): CompensationLedgerEntry => ({
  id: `entry-${Math.random().toString(16).slice(2)}`,
  created_at: '2026-05-14T10:00:00.000Z',
  source: 'pos',
  dish_name: 'Dish',
  quantity: 1,
  status: 'compensated',
  compensation_type: 'partial_discount',
  original_amount: 10,
  final_amount: 8,
  loss_amount: 2,
  is_complimentary: false,
  action: 'checkout',
  ...overrides,
});

describe('complaint compensation reporting', () => {
  it('aggregates cancelled dishes and complaint reasons', () => {
    const report = buildCompensationDashboardReport([
      makeEntry({
        dish_name: 'Grilled Salmon',
        quantity: 2,
        status: 'cancelled',
        compensation_type: 'full_waiver',
        compensation_reason: 'quality_issue',
        original_amount: 36,
        final_amount: 0,
        loss_amount: 36,
      }),
      makeEntry({
        dish_name: 'Grilled Salmon',
        quantity: 1,
        status: 'cancelled',
        compensation_type: 'full_waiver',
        compensation_reason: 'quality_issue',
        original_amount: 18,
        final_amount: 0,
        loss_amount: 18,
      }),
      makeEntry({
        dish_name: 'Chocolate Cake',
        status: 'compensated',
        compensation_type: 'complimentary',
        compensation_reason: 'late_service',
        is_complimentary: true,
        original_amount: 7,
        final_amount: 0,
        loss_amount: 7,
      }),
    ]);

    expect(report.total_compensation_cost).toBe(61);
    expect(report.complaint_loss_total).toBe(54);
    expect(report.complimentary_value_total).toBe(7);
    expect(report.cancelled_item_count).toBe(3);
    expect(report.complimentary_item_count).toBe(1);
    expect(report.most_cancelled_dishes[0]).toEqual({ dish_name: 'Grilled Salmon', count: 3 });
    expect(report.most_common_reasons[0]).toEqual({ reason: 'quality_issue', count: 2 });
  });

  it('returns zeroed metrics when no records exist', () => {
    const report = buildCompensationDashboardReport([]);
    expect(report.total_compensation_cost).toBe(0);
    expect(report.cancelled_item_count).toBe(0);
    expect(report.most_cancelled_dishes).toEqual([]);
    expect(report.most_common_reasons).toEqual([]);
    expect(report.daily_losses).toEqual([]);
    expect(report.weekly_losses).toEqual([]);
    expect(report.monthly_losses).toEqual([]);
  });
});

