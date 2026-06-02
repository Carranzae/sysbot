export function formatPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

export function sanitizeText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateConfidence(score: number): number {
  return Math.min(Math.max(score, 0), 1);
}

export function isBusinessHoursOpen(businessHours: any): boolean {
  if (!businessHours) return true;

  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const daySchedule = businessHours[day];
  if (!daySchedule || !daySchedule.open) return false;

  const [openHour, openMin] = daySchedule.start.split(':').map(Number);
  const [closeHour, closeMin] = daySchedule.end.split(':').map(Number);

  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  return currentTime >= openTime && currentTime <= closeTime;
}
