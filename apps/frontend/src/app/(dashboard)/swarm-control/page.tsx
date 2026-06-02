"use client";

import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Users, Trash2, Plus, RefreshCw, Cpu, Activity, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';

export default function SwarmControlPage() {
  const { toast } = useToast();
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);

  // States
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Inputs para bloquear
  const [targetType, setTargetType] = useState<'IP' | 'PHONE'>('IP');
  const [targetValue, setTargetValue] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Simular agentes activos
  const swarmAgents = [
    { name: 'Agente de Empatía', role: 'Análisis de tono y humor del cliente', latency: '4ms', status: 'ACTIVE' },
    { name: 'Agente de Negociación', role: 'Reglas de precios y reservas directas', latency: '12ms', status: 'ACTIVE' },
    { name: 'Agente de Reconocimiento de Errores', role: 'Auditor de alucinaciones y RAG', latency: '8ms', status: 'ACTIVE' },
    { name: 'Agente de Buena Conducta', role: 'Escudo anti-inyecciones y fraudes', latency: '2ms', status: 'SHIELD_ACTIVE' },
  ];

  useEffect(() => {
    if (!selectedBusiness) return;
    refreshBlocklist();
  }, [selectedBusiness]);

  const refreshBlocklist = () => {
    setIsLoading(true);
    setTimeout(() => {
      setBlocklist([
        {
          id: 'block-1',
          targetType: 'IP',
          targetValue: '192.168.12.43',
          reason: 'Intento flagrante de Prompt Injection (system prompt query bypass)',
          severity: 'CRITICAL',
          blockedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'block-2',
          targetType: 'PHONE',
          targetValue: '+51 988 777 666',
          reason: 'Sospecha de estafa en pagos repetitivos de comprobantes fraudulentos',
          severity: 'HIGH',
          blockedAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
      setIsLoading(false);
    }, 800);
  };

  const handleBlockTarget = async () => {
    if (!targetValue || !blockReason) {
      toast({
        title: 'Error de validación',
        description: 'Por favor complete el valor y la razón del bloqueo.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const newBlock = {
        id: `block-${Date.now()}`,
        targetType,
        targetValue,
        reason: blockReason,
        severity: 'HIGH',
        blockedAt: new Date().toISOString(),
      };
      setBlocklist([newBlock, ...blocklist]);
      setTargetValue('');
      setBlockReason('');
      setIsLoading(false);
      toast({
        title: 'Objetivo Bloqueado',
        description: `Se ha restringido el acceso a ${targetValue} por seguridad perimetral.`,
      });
    }, 600);
  };

  const handleUnblock = (id: string, value: string) => {
    setBlocklist(blocklist.filter(b => b.id !== id));
    toast({
      title: 'Objetivo Desbloqueado',
      description: `Se ha restablecido el acceso de manera exitosa para ${value}.`,
    });
  };

  if (!selectedBusiness) {
    return (
      <div className="p-8 text-center bg-[#0d0f14] min-h-screen text-slate-400">
        <p className="text-lg">Selecciona un negocio para entrar al Centro de Control de Seguridad del Enjambre.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0b0c10] text-slate-100 min-h-screen space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Seguridad & Swarm Control</h1>
            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono">
              🛡️ Escudo Perimetral Activo
            </Badge>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-wider">
            Supervisa el procesamiento paralelo de sub-agentes en milisegundos y gestiona la lista de bloqueo anti-fraudes
          </p>
        </div>
        <Button
          onClick={refreshBlocklist}
          variant="outline"
          className="border-white/10 text-slate-300 hover:bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest px-6 h-12 bg-slate-900/40"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Sincronizar Escudo
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Monitoreo del Enjambre (Swarm Status) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-sky-400">
              <Cpu className="h-6 w-6" />
              <h2 className="text-lg font-black uppercase tracking-wider font-mono">Estado de Sub-Agentes en Paralelo</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {swarmAgents.map((agent, i) => (
                <div key={i} className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{agent.name}</span>
                    <Badge className={
                      agent.status === 'SHIELD_ACTIVE'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-mono text-[9px]'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[9px]'
                    }>
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">{agent.role}</p>
                  
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5">
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" /> Latencia: {agent.latency}</span>
                    <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-sky-400" /> CPU: 0.1%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulario de Bloqueo Manual */}
          <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
              <h2 className="text-lg font-black uppercase tracking-wider">Registrar Bloqueo Preventivo Manual</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Bloqueo</label>
                <select 
                  value={targetType}
                  onChange={(e: any) => setTargetType(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="IP">Dirección IP</option>
                  <option value="PHONE">Número Telefónico</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor (IP o Celular)</label>
                <input 
                  type="text"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={targetType === 'IP' ? 'Ej: 192.168.1.100' : 'Ej: +51999888777'}
                  className="w-full bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo o Razón de Seguridad</label>
              <input 
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ej: Detectada inyección repetitiva de prompts maliciosos en chat..."
                className="w-full bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <Button 
              onClick={handleBlockTarget}
              disabled={isLoading || !targetValue || !blockReason}
              className="w-full bg-rose-500 hover:bg-rose-600 text-slate-950 rounded-2xl font-black uppercase text-[11px] tracking-widest h-14"
            >
              Aplicar Bloqueo y Sincronizar Reglas de Red
            </Button>
          </div>
        </div>

        {/* Lista de Bloqueos Activos (Security Blocklist) */}
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Shield className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-wider">Objetivos Bloqueados</h2>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {blocklist.length > 0 ? (
                blocklist.map((item) => (
                  <div key={item.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative">
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-0.5">
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-black font-mono px-2 rounded-full uppercase">
                          {item.targetType}
                        </Badge>
                        <div className="text-xs font-black text-white mt-1">{item.targetValue}</div>
                      </div>
                      <button 
                        onClick={() => handleUnblock(item.id, item.targetValue)}
                        className="text-slate-500 hover:text-rose-400 p-2 hover:bg-white/5 rounded-xl transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
                      <strong>Motivo:</strong> {item.reason}
                    </div>

                    <div className="text-[9px] text-slate-600 font-mono">
                      Bloqueado: {new Date(item.blockedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-600 font-bold uppercase text-[10px] py-12">
                  No hay direcciones IP ni teléfonos bloqueados.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
