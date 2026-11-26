import type { SubscriptionPaymentRecord, SubscriptionRecord, SystemConfigRecord } from './server-store';

export function getSubscriptionCharge(
  subscription: Pick<SubscriptionRecord, 'companyId' | 'activationPaid'>,
  payments: ReadonlyArray<Pick<SubscriptionPaymentRecord, 'companyId' | 'paymentType' | 'status' | 'bankReference'>>,
  pricing: Pick<SystemConfigRecord, 'activationPriceHnl' | 'monthlyPriceHnl'>,
) {
  const belongsToCompany = payments.filter((payment) => payment.companyId === subscription.companyId);
  const activated = subscription.activationPaid || belongsToCompany.some(
    (payment) => payment.paymentType === 'ACTIVACION_UNICA' && payment.status === 'APROBADO',
  );
  const paymentType: SubscriptionPaymentRecord['paymentType'] = activated ? 'MENSUALIDAD' : 'ACTIVACION_UNICA';
  const pending = belongsToCompany.find((payment) => payment.paymentType === paymentType && payment.status === 'PENDIENTE');

  return {
    paymentType,
    amountHnl: activated ? pricing.monthlyPriceHnl : pricing.activationPriceHnl,
    pendingReference: pending?.bankReference ?? null,
  };
}

export function nextMonthlyDueDate(startDate: string): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
