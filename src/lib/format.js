export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatDate(date, options = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(d);
}

export function formatDateTime(date, options = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(d);
}

export function formatMonthYear(month, year) {
  if (!month || !year) return '—';
  return `${getMonthName(month)} ${year}`;
}

export function formatRelativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

export function formatStatus(status) {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getMonthName(monthNum) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return months[monthNum - 1] || '—';
}

// Bed numbers are auto-generated as "<roomNumber>-<n>" (e.g. "101-A"). The
// tenant UI shows the room separately, so display only the bed part ("A").
// Explicit bed numbers that don't carry the room prefix pass through unchanged.
export function formatBedNumber(bedNumber, roomNumber) {
  if (!bedNumber) return '—';
  const bed = String(bedNumber).trim();
  if (roomNumber) {
    const prefix = `${String(roomNumber).trim()}-`;
    if (bed.startsWith(prefix)) return bed.slice(prefix.length) || bed;
  }
  return bed;
}