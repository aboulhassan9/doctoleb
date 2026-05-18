export function formatBillingReference(payment) {
  const rawReference = payment?.client_request_id || payment?.id;
  if (!rawReference) return 'Pending server reference';

  const compact = String(rawReference).replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!compact) return 'Posted payment';

  return `PAY-${compact.slice(0, 12)}`;
}
