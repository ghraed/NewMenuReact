export const normalizeWhatsAppPhone = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
};

export const buildWhatsAppShareUrl = (phone: string, message: string): string | null => {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};
