import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { resources } from '../../src/i18n/resources';

describe('POS localization', () => {
  it('resolves Arabic complaint/report controls and interpolates timezone and settlement', async () => {
    const translator = i18next.createInstance();
    await translator.init({ lng: 'ar', fallbackLng: 'en', resources, interpolation: { escapeValue: false } });
    expect(translator.t('cashierPosPage.extra.postSale')).toBe('شكوى / هدية بعد البيع');
    expect(translator.t('cashierPosPage.extra.reportTitle')).toBe('لوحة الشكاوى والتعويضات');
    expect(translator.t('cashierPosPage.extra.datesUse', { timezone: 'Asia/Beirut' })).toContain('Asia/Beirut');
    expect(translator.t('cashierPosPage.extra.lastCheckout', { reference: 'QA_RUN_invoice', amount: '$0.00' })).toBe('آخر عملية دفع: QA_RUN_invoice · المدفوع $0.00');
    expect(translator.t('cashierPosPage.extra.reasons.quality_issue')).toBe('مشكلة في الجودة');
  });
});
