import { databaseRoute } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanySession } from '@/lib/api-auth';
import { calculateDaysRemaining } from '@/lib/fiscal-engine';
import { getDb } from '@/lib/server-store';

async function handleGET(req: NextRequest) {
  try {
    const { company } = requireCompanySession(req);
    const db = getDb();

    const sub = db.subscriptions.find((s) => s.companyId === company.id);
    const payments = db.subscriptionPayments.filter((p) => p.companyId === company.id);

    const daysRemaining = sub ? calculateDaysRemaining(sub.nextPaymentDate) : 0;

    return NextResponse.json({
      subscription: sub || null,
      daysRemaining,
      payments,
      bankInstructions: db.systemConfig.bankInstructions,
      pricing: {
        activationPriceHnl: db.systemConfig.activationPriceHnl,
        monthlyPriceHnl: db.systemConfig.monthlyPriceHnl,
        pricesIncludeTax: db.systemConfig.pricesIncludeTax,
        graceDays: db.systemConfig.graceDays,
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || 'Error al consultar suscripción.' },
      { status: e.status || 500 }
    );
  }
}

export const GET = databaseRoute(handleGET);
