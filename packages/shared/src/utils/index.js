"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhoneNumber = formatPhoneNumber;
exports.generateOrderNumber = generateOrderNumber;
exports.chunkText = chunkText;
exports.sanitizeText = sanitizeText;
exports.calculateConfidence = calculateConfidence;
exports.isBusinessHoursOpen = isBusinessHoursOpen;
function formatPhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}
function generateOrderNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `ORD-${timestamp}-${random}`.toUpperCase();
}
function chunkText(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.substring(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}
function sanitizeText(text) {
    return text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function calculateConfidence(score) {
    return Math.min(Math.max(score, 0), 1);
}
function isBusinessHoursOpen(businessHours) {
    if (!businessHours)
        return true;
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const daySchedule = businessHours[day];
    if (!daySchedule || !daySchedule.open)
        return false;
    const [openHour, openMin] = daySchedule.start.split(':').map(Number);
    const [closeHour, closeMin] = daySchedule.end.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    return currentTime >= openTime && currentTime <= closeTime;
}
//# sourceMappingURL=index.js.map