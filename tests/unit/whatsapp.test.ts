import { describe, expect, it } from 'vitest';
import { buildWhatsAppShareUrl, normalizeWhatsAppPhone } from '../../src/utils/whatsapp';

describe('WhatsApp sharing helpers', () => {
  it('normalizes an international phone number', () => {
    expect(normalizeWhatsAppPhone('+961 (70) 123-456')).toBe('96170123456');
  });

  it('rejects phone numbers outside the WhatsApp length range', () => {
    expect(normalizeWhatsAppPhone('123')).toBeNull();
    expect(normalizeWhatsAppPhone('1234567890123456')).toBeNull();
  });

  it('builds an encoded wa.me URL', () => {
    expect(buildWhatsAppShareUrl('+961 70 123 456', 'Tomato: 2 kg'))
      .toBe('https://wa.me/96170123456?text=Tomato%3A%202%20kg');
  });
});
