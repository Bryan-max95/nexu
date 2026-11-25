'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  CreditCard,
  FileCheck,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/fiscal-engine';

interface SuperAdminPanelProps {
  token: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
  onSwitchAccount: (email: string) => void;
  onLogout: () => void;
}

type AdminSection =
  | 'DASHBOARD'
  | 'EMPRESAS'
  | 'ACTIVACIONES'
  | 'SUSCRIPCIONES'
  | 'PAGOS'
  | 'USUARIOS'
  | 'NOTIFICACIONES'
  | 'AUDITORIA'
  | 'CONFIGURACION'
  | 'SOPORTE';

export default function SuperAdminPanel({
  token,
  currentUser,
  onSwitchAccount,
  onLogout,
}: SuperAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminSection>('DASHBOARD');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'OK' | 'ERR'; text: string } | null>(null);

  const [data, setData] = useState<{
    dashboard: {
      totalCompanies: number;
      activeCompaniesCount: number;
      pendingActivationsCount: number;
      expiredCompaniesCount: number;
      totalApprovedRevenue: string;
      monthlyRecurringRunRate: string;
    };
    companies: Array<{
      id: string;
      legalName: string;
      commercialName: string;
      rtn: string;
      department: string;
      municipality: string;
      email: string;
      whatsapp: string;
      representative: string;
      createdAtUtc: string;
      emittedCount: number;
      activeCais: number;
      membersCount: number;
      subscription: {
        id: string;
        status: string;
        activationPaid: boolean;
        nextPaymentDate: string;
      } | null;
    }>;
    payments: Array<{
      id: string;
      companyId: string;
      companyName: string;
      companyRtn: string;
      paymentType: 'ACTIVACION_UNICA' | 'MENSUALIDAD';
      amountHnl: string;
      bankReference: string;
      bankName: string;
      receiptFilename: string;
      receiptDataUrl?: string;
      notes: string;
      status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
      rejectionReason?: string;
      reviewedBy?: string;
      reviewedAtUtc?: string;
      createdAtUtc: string;
    }>;
    users: Array<{
      id: string;
      name: string;
      email: string;
      whatsapp: string;
      emailVerified: boolean;
      isSuperAdmin: boolean;
      mfaEnabled: boolean;
      createdAtUtc: string;
    }>;
    auditLogs: Array<{
      id: string;
      companyId: string | null;
      actorName: string;
      actorRole: string;
      operation: string;
      details: string;
      createdAtUtc: string;
    }>;
    supportTickets: Array<{
      id: string;
      companyId: string;
      companyName: string;
      subject: string;
      message: string;
      status: string;
      adminJustification?: string;
      createdAtUtc: string;
    }>;
    systemConfig: {
      activationPriceHnl: string;
      monthlyPriceHnl: string;
      graceDays: number;
      pricesIncludeTax: boolean;
      bankInstructions: string;
      supportWhatsapp: string;
      supportEmail: string;
      honorariosEnabled: boolean;
    };
  } | null>(null);

  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [supportJustifications, setSupportJustifications] = useState<Record<string, string>>({});

  // Projection simulator (Section 18 example: 100 active companies x L 350 + 10 activations x L 4,000 = L 75,000)
  const [projActiveCompanies, setProjActiveCompanies] = useState(100);
  const [projNewActivations, setProjNewActivations] = useState(10);

  const loadAdminData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments/approve', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setFeedback({ type: 'ERR', text: json.error || 'Error al cargar panel BWP.' });
      }
    } catch {
      setFeedback({ type: 'ERR', text: 'Error de red al consultar panel superadministrador.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadAdminData();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadAdminData]);

  async function handleReviewPayment(paymentId: string, decision: 'APROBAR' | 'RECHAZAR') {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'REVIEW_PAYMENT',
          paymentId,
          decision,
          rejectionReason: rejectReasonMap[paymentId] || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'No se pudo procesar el pago.' });
      } else {
        setFeedback({ type: 'OK', text: json.message });
        await loadAdminData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetCompanyStatus(companyId: string, status: string) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'SET_COMPANY_STATUS',
          companyId,
          status,
          justification: `Cambio manual de estado a ${status} desde Panel Superadministrador BWP`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al actualizar estado.' });
      } else {
        setFeedback({ type: 'OK', text: `Estado comercial actualizado a ${status}.` });
        await loadAdminData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'BROADCAST_NOTIFICATION',
          title: broadcastTitle,
          message: broadcastMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al enviar comunicado.' });
      } else {
        setFeedback({
          type: 'OK',
          text: `Comunicado general enviado exitosamente a ${json.sentCount} empresas.`,
        });
        setBroadcastTitle('');
        setBroadcastMessage('');
        await loadAdminData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveSystemConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'UPDATE_SYSTEM_CONFIG',
          ...data.systemConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al guardar configuración.' });
      } else {
        setFeedback({ type: 'OK', text: 'Parámetros comerciales y políticas actualizados.' });
        await loadAdminData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolveTicket(ticketId: string) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'RESOLVE_SUPPORT_TICKET',
          ticketId,
          justification: supportJustifications[ticketId] || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'ERR', text: json.error || 'Error al resolver ticket.' });
      } else {
        setFeedback({ type: 'OK', text: 'Ticket atendido y registrado en auditoría.' });
        await loadAdminData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  const navItems: Array<{ id: AdminSection; label: string; icon: React.ReactNode }> = [
    { id: 'DASHBOARD', label: 'Dashboard Comercial', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'EMPRESAS', label: 'Empresas', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ACTIVACIONES', label: 'Activaciones L 4,000', icon: <FileCheck className="w-4 h-4" /> },
    { id: 'SUSCRIPCIONES', label: 'Suscripciones L 350', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'PAGOS', label: 'Pagos y Conciliación', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'USUARIOS', label: 'Usuarios y MFA', icon: <Users className="w-4 h-4" /> },
    { id: 'NOTIFICACIONES', label: 'Comunicados', icon: <Bell className="w-4 h-4" /> },
    { id: 'AUDITORIA', label: 'Auditoría', icon: <Shield className="w-4 h-4" /> },
    { id: 'CONFIGURACION', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
    { id: 'SOPORTE', label: 'Consultas y soporte', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#141414] flex flex-col lg:flex-row">
      {/* Sidebar Navigation (260px) */}
      <aside className="w-full lg:w-64 bg-neutral-950 text-white border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 border-b border-neutral-800">
            <div className="font-display font-bold text-lg tracking-tight text-white">
              BWP NEXO · ADMIN
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">
              Panel Superadministrador BWP Software
            </div>
          </div>

          <nav className="p-3 space-y-1 flex lg:flex-col overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 w-full text-left cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#7A1C24] text-white font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-neutral-800 space-y-3 text-xs">
          <div className="text-neutral-400">
            <div className="font-semibold text-white">{currentUser.name}</div>
            <div className="truncate">{currentUser.email}</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Sesión administrativa</div>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={onLogout}
              className="w-full py-2 px-3 bg-neutral-900 hover:bg-red-950 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between gap-6">
          <div className="text-xs text-neutral-600">
            <span>Superadministración BWP Software</span>
            <span className="mx-2">/</span>
            <strong className="text-neutral-950">
              {navItems.find((n) => n.id === activeTab)?.label}
            </strong>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadAdminData}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-300 hover:bg-neutral-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Actualizar datos
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Security & Privacy Boundary Banner (Section 18 & 26) */}
          <div className="p-3.5 bg-neutral-100 border border-neutral-300 text-xs text-neutral-700 flex items-center justify-between gap-4">
            <span>
              <strong>Política de Integridad BWP (Sección 18 y 26):</strong> Ningún usuario
              administrativo puede alterar ni eliminar documentos fiscales emitidos. Todo acceso de
              soporte queda justificado y auditado.
            </span>
          </div>

          {feedback && (
            <div
              className={`p-3.5 border text-xs font-medium flex items-center justify-between ${
                feedback.type === 'OK'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{feedback.text}</span>
              <button onClick={() => setFeedback(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading || !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-24 bg-white border border-neutral-200 animate-pulse p-4" />
              ))}
            </div>
          ) : (
            <>
              {/* 1. DASHBOARD */}
              {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-neutral-200 p-5">
                      <div className="text-xs text-neutral-500">Empresas Activas</div>
                      <div className="font-display font-bold text-2xl text-emerald-700 font-mono tabular-nums mt-1">
                        {data.dashboard.activeCompaniesCount}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        De {data.dashboard.totalCompanies} registradas en plataforma
                      </div>
                    </div>

                    <div className="bg-white border border-neutral-200 p-5">
                      <div className="text-xs text-neutral-500">Pendientes de Activación (L 4,000)</div>
                      <div className="font-display font-bold text-2xl text-amber-700 font-mono tabular-nums mt-1">
                        {data.dashboard.pendingActivationsCount}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Esperando aprobación de comprobante
                      </div>
                    </div>

                    <div className="bg-white border border-neutral-200 p-5">
                      <div className="text-xs text-neutral-500">Empresas Vencidas / Suspendidas</div>
                      <div className="font-display font-bold text-2xl text-red-700 font-mono tabular-nums mt-1">
                        {data.dashboard.expiredCompaniesCount}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Emisión bloqueada · Histórico accesible
                      </div>
                    </div>

                    <div className="bg-white border border-neutral-200 p-5">
                      <div className="text-xs text-neutral-500">Ingresos Conciliados BWP</div>
                      <div className="font-display font-bold text-2xl text-[#7A1C24] font-mono tabular-nums mt-1">
                        {formatCurrency(data.dashboard.totalApprovedRevenue)}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        MRR actual: {formatCurrency(data.dashboard.monthlyRecurringRunRate)} / mes
                      </div>
                    </div>
                  </div>

                  {/* Commercial Projection Calculator (Section 18, Page 13) */}
                  <div className="bg-white border border-neutral-200 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-[#7A1C24]">
                          Sección 18 · Modelo Comercial BWP Software
                        </div>
                        <h3 className="font-display font-bold text-base text-neutral-950">
                          Calculadora de Ingresos Recurrentes y Activaciones
                        </h3>
                      </div>
                      <span className="text-xs text-neutral-500">
                        Activación L 4,000.00 · Mensualidad L 350.00
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Empresas activas recurrentes (x L 350.00)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={projActiveCompanies}
                          onChange={(e) => setProjActiveCompanies(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm font-mono border border-neutral-300"
                        />
                        <div className="text-xs text-neutral-500 mt-1 font-mono tabular-nums">
                          Recurrente mensual: {formatCurrency(projActiveCompanies * 350)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Nuevas activaciones del mes (x L 4,000.00)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={projNewActivations}
                          onChange={(e) => setProjNewActivations(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm font-mono border border-neutral-300"
                        />
                        <div className="text-xs text-neutral-500 mt-1 font-mono tabular-nums">
                          Ingresos por activación: {formatCurrency(projNewActivations * 4000)}
                        </div>
                      </div>

                      <div className="bg-neutral-50 border border-neutral-200 p-4 flex flex-col justify-center">
                        <div className="text-xs text-neutral-500">
                          Total Bruto Mensual Estimado (antes de gastos e impuestos)
                        </div>
                        <div className="font-display font-bold text-2xl text-[#7A1C24] font-mono tabular-nums mt-1">
                          {formatCurrency(projActiveCompanies * 350 + projNewActivations * 4000)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pending Approvals Quick Table */}
                  <div className="bg-white border border-neutral-200 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-base text-neutral-950">
                        Comprobantes Pendientes de Aprobación
                      </h3>
                      <button
                        onClick={() => setActiveTab('PAGOS')}
                        className="text-xs font-semibold text-[#7A1C24] hover:underline cursor-pointer"
                      >
                        Ver historial completo de pagos
                      </button>
                    </div>

                    {data.payments.filter((p) => p.status === 'PENDIENTE').length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-200">
                        No hay comprobantes pendientes de revisión en este momento.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-neutral-200 text-neutral-500">
                              <th className="py-2.5 px-3">Empresa / RTN</th>
                              <th className="py-2.5 px-3">Concepto</th>
                              <th className="py-2.5 px-3">Banco / Referencia</th>
                              <th className="py-2.5 px-3 text-right">Importe</th>
                              <th className="py-2.5 px-3">Motivo rechazo (si aplica)</th>
                              <th className="py-2.5 px-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {data.payments
                              .filter((p) => p.status === 'PENDIENTE')
                              .map((p) => (
                                <tr key={p.id} className="hover:bg-neutral-50">
                                  <td className="py-3 px-3">
                                    <div className="font-semibold text-neutral-900">
                                      {p.companyName}
                                    </div>
                                    <div className="font-mono text-[11px] text-neutral-500">
                                      RTN {p.companyRtn}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">{p.paymentType}</td>
                                  <td className="py-3 px-3">
                                    <div>{p.bankName}</div>
                                    <div className="font-mono text-[11px] text-neutral-600">
                                      Ref: {p.bankReference} · {p.receiptDataUrl ? <a href={p.receiptDataUrl} download={p.receiptFilename} className="underline">Descargar comprobante</a> : p.receiptFilename}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                                    {formatCurrency(p.amountHnl)}
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="text"
                                      placeholder="Motivo si rechaza..."
                                      value={rejectReasonMap[p.id] || ''}
                                      onChange={(e) =>
                                        setRejectReasonMap((prev) => ({
                                          ...prev,
                                          [p.id]: e.target.value,
                                        }))
                                      }
                                      className="px-2 py-1 text-xs border border-neutral-300 w-44"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                                    <button
                                      disabled={actionLoading}
                                      onClick={() => handleReviewPayment(p.id, 'APROBAR')}
                                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                                    >
                                      Aprobar
                                    </button>
                                    <button
                                      disabled={actionLoading}
                                      onClick={() => handleReviewPayment(p.id, 'RECHAZAR')}
                                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                                    >
                                      Rechazar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. EMPRESAS, 3. ACTIVACIONES, 4. SUSCRIPCIONES */}
              {(activeTab === 'EMPRESAS' ||
                activeTab === 'ACTIVACIONES' ||
                activeTab === 'SUSCRIPCIONES') && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Gestión de Empresas, Activaciones (L 4,000) y Suscripciones (L 350)
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Consultar, activar, suspender o renovar empresas. Recuerde: suspender o vencer una
                      empresa bloquea nuevas emisiones pero conserva intacto el acceso a documentos
                      históricos.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 px-3">Empresa / Razón Social</th>
                          <th className="py-2.5 px-3">RTN</th>
                          <th className="py-2.5 px-3">Contacto</th>
                          <th className="py-2.5 px-3">Activación L 4,000</th>
                          <th className="py-2.5 px-3">Estado Suscripción</th>
                          <th className="py-2.5 px-3">Próximo Pago</th>
                          <th className="py-2.5 px-3 text-right">Docs. Emitidos</th>
                          <th className="py-2.5 px-3 text-right">Acciones Comerciales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {data.companies.map((c) => (
                          <tr key={c.id} className="hover:bg-neutral-50">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-neutral-950">{c.commercialName}</div>
                              <div className="text-[11px] text-neutral-500">{c.legalName}</div>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums">{c.rtn}</td>
                            <td className="py-3 px-3">
                              <div>{c.representative}</div>
                              <div className="text-[11px] text-neutral-500">{c.email}</div>
                            </td>
                            <td className="py-3 px-3">
                              {c.subscription?.activationPaid ? (
                                <span className="text-emerald-700 font-semibold">Pagada</span>
                              ) : (
                                <span className="text-amber-700 font-semibold">Pendiente</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              {c.subscription?.status || 'SIN_SUSCRIPCION'}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums">
                              {c.subscription?.nextPaymentDate || 'N/A'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {c.emittedCount}
                            </td>
                            <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                disabled={actionLoading}
                                onClick={() => handleSetCompanyStatus(c.id, 'ACTIVA')}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Activar / Renovar
                              </button>
                              <button
                                disabled={actionLoading}
                                onClick={() => handleSetCompanyStatus(c.id, 'VENCIDA')}
                                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Marcar Vencida
                              </button>
                              <button
                                disabled={actionLoading}
                                onClick={() => handleSetCompanyStatus(c.id, 'SUSPENDIDA')}
                                className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Suspender
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. PAGOS */}
              {activeTab === 'PAGOS' && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Historial y Conciliación de Pagos (Activaciones L 4,000 y Mensualidades L 350)
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Protección activa contra doble aprobación: un pago ya aprobado no puede aprobarse dos
                      veces.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 px-3">Fecha UTC</th>
                          <th className="py-2.5 px-3">Empresa / RTN</th>
                          <th className="py-2.5 px-3">Concepto</th>
                          <th className="py-2.5 px-3">Banco / Referencia</th>
                          <th className="py-2.5 px-3 text-right">Importe</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {data.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50">
                            <td className="py-3 px-3 font-mono text-[11px] text-neutral-500">
                              {p.createdAtUtc.slice(0, 16).replace('T', ' ')}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold">{p.companyName}</div>
                              <div className="font-mono text-[11px] text-neutral-500">{p.companyRtn}</div>
                            </td>
                            <td className="py-3 px-3">{p.paymentType}</td>
                            <td className="py-3 px-3">
                              <div>{p.bankName}</div>
                              <div className="font-mono text-[11px] text-neutral-500">
                                Ref: {p.bankReference}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                              {formatCurrency(p.amountHnl)}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              {p.status}
                              {p.rejectionReason && (
                                <div className="text-[11px] text-red-700 font-normal">
                                  Motivo: {p.rejectionReason}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {p.status === 'PENDIENTE' ? (
                                <button
                                  onClick={() => handleReviewPayment(p.id, 'APROBAR')}
                                  className="px-2.5 py-1 bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Aprobar
                                </button>
                              ) : (
                                <span className="text-[11px] text-neutral-400">
                                  Revisado por {p.reviewedBy || 'BWP'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. USUARIOS */}
              {activeTab === 'USUARIOS' && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <h3 className="font-display font-bold text-lg text-neutral-950">
                    Cuentas de Usuario y Seguridad MFA
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 px-3">Nombre</th>
                          <th className="py-2.5 px-3">Correo</th>
                          <th className="py-2.5 px-3">WhatsApp</th>
                          <th className="py-2.5 px-3">Correo Verificado</th>
                          <th className="py-2.5 px-3">MFA</th>
                          <th className="py-2.5 px-3">Tipo Cuenta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {data.users.map((u) => (
                          <tr key={u.id}>
                            <td className="py-2.5 px-3 font-semibold">{u.name}</td>
                            <td className="py-2.5 px-3 font-mono">{u.email}</td>
                            <td className="py-2.5 px-3 font-mono">{u.whatsapp || 'N/A'}</td>
                            <td className="py-2.5 px-3">
                              {u.emailVerified ? 'Verificado' : 'Pendiente'}
                            </td>
                            <td className="py-2.5 px-3">
                              {u.mfaEnabled ? 'MFA Habilitado' : 'Estándar'}
                            </td>
                            <td className="py-2.5 px-3">
                              {u.isSuperAdmin ? 'Superadministrador BWP' : 'Usuario Empresarial'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7. NOTIFICACIONES */}
              {activeTab === 'NOTIFICACIONES' && (
                <div className="bg-white border border-neutral-200 p-6 max-w-2xl space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Emitir Comunicado General a Empresas
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Envía un aviso oficial al panel de notificaciones de todas las empresas suscritas en
                      BWP NEXO.
                    </p>
                  </div>

                  <form onSubmit={handleSendBroadcast} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Título del comunicado
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Mantenimiento programado o recordatorio fiscal SAR"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Mensaje detallado
                      </label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Escriba el contenido del comunicado oficial..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold cursor-pointer"
                    >
                      Enviar comunicado a todas las empresas
                    </button>
                  </form>
                </div>
              )}

              {/* 8. AUDITORIA */}
              {activeTab === 'AUDITORIA' && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Bitácora Inmutable de Auditoría (Append-Only)
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Registro cronológico de eventos sensibles administrativos y fiscales. No manipulable
                      desde la interfaz.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 px-3">Timestamp UTC</th>
                          <th className="py-2.5 px-3">Actor / Rol</th>
                          <th className="py-2.5 px-3">Operación</th>
                          <th className="py-2.5 px-3">Detalle Auditado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {data.auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-neutral-50">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                              {log.createdAtUtc.slice(0, 19).replace('T', ' ')}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-neutral-900">{log.actorName}</span>
                              <span className="mx-1 text-neutral-400">·</span>
                              <span className="text-neutral-500">{log.actorRole}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-[#7A1C24]">
                              {log.operation}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-700">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 9. CONFIGURACION */}
              {activeTab === 'CONFIGURACION' && (
                <form
                  onSubmit={handleSaveSystemConfig}
                  className="bg-white border border-neutral-200 p-6 max-w-2xl space-y-4"
                >
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Parámetros Comerciales y Políticas BWP NEXO
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Configuración general de precios, días de gracia y cumplimiento normativo SAR.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Activación Única (HNL)
                      </label>
                      <input
                        type="text"
                        value={data.systemConfig.activationPriceHnl}
                        onChange={(e) =>
                          setData({
                            ...data,
                            systemConfig: {
                              ...data.systemConfig,
                              activationPriceHnl: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Mensualidad (HNL)
                      </label>
                      <input
                        type="text"
                        value={data.systemConfig.monthlyPriceHnl}
                        onChange={(e) =>
                          setData({
                            ...data,
                            systemConfig: {
                              ...data.systemConfig,
                              monthlyPriceHnl: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Días de Gracia
                      </label>
                      <input
                        type="number"
                        value={data.systemConfig.graceDays}
                        onChange={(e) =>
                          setData({
                            ...data,
                            systemConfig: {
                              ...data.systemConfig,
                              graceDays: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Instrucciones Bancarias para Transferencias
                    </label>
                    <textarea
                      rows={3}
                      value={data.systemConfig.bankInstructions}
                      onChange={(e) =>
                        setData({
                          ...data,
                          systemConfig: {
                            ...data.systemConfig,
                            bankInstructions: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-neutral-300"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-neutral-700">
                    <input
                      type="checkbox"
                      checked={data.systemConfig.honorariosEnabled}
                      onChange={(e) =>
                        setData({
                          ...data,
                          systemConfig: {
                            ...data.systemConfig,
                            honorariosEnabled: e.target.checked,
                          },
                        })
                      }
                      className="accent-[#7A1C24]"
                    />
                    <span>
                      Habilitar Recibo por Honorarios (Sección 9 y 28: mantener deshabilitado por defecto
                      hasta confirmar modalidad autorizada con SAR)
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-[#7A1C24] hover:bg-[#60141B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Guardar configuración global
                  </button>
                </form>
              )}

              {/* 10. SOPORTE */}
              {activeTab === 'SOPORTE' && (
                <div className="bg-white border border-neutral-200 p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-neutral-950">
                      Consultas empresariales y soporte
                    </h3>
                    <p className="text-xs text-neutral-600">
                      Revisa las consultas recibidas desde la web y registra la atención con una justificación auditable.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {data.supportTickets.map((t) => (
                      <div key={t.id} className="p-5 border border-neutral-200 rounded-xl space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-950">
                            {t.companyName} · {t.subject}
                          </span>
                          <span className="font-mono text-neutral-500">{t.status}</span>
                        </div>
                        <p className="font-mono text-xs text-neutral-400">Referencia: {t.id}{t.id.startsWith('BWP-CON-') ? ' · Formulario público' : ''}</p>
                        <p className="text-neutral-700 whitespace-pre-line break-words leading-relaxed">{t.message}</p>
                        {t.status !== 'RESUELTO' ? (
                          <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <input
                              type="text"
                              placeholder="Justificación obligatoria de soporte para auditoría..."
                              value={supportJustifications[t.id] || ''}
                              onChange={(e) =>
                                setSupportJustifications((prev) => ({
                                  ...prev,
                                  [t.id]: e.target.value,
                                }))
                              }
                              className="flex-1 px-3 py-1.5 border border-neutral-300 text-xs"
                            />
                            <button
                              disabled={actionLoading}
                              onClick={() => handleResolveTicket(t.id)}
                              className="px-4 py-1.5 bg-[#7A1C24] text-white font-semibold cursor-pointer"
                            >
                              Registrar atención auditada
                            </button>
                          </div>
                        ) : (
                          <div className="text-emerald-800 bg-emerald-50 p-2 border border-emerald-200">
                            Resuelto · Justificación auditada: {t.adminJustification}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
