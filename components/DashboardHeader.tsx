'use client';

import { Usuario } from '@/lib/types';

interface DashboardHeaderProps {
  usuario: Usuario;
  onLogout: () => void;
}

export default function DashboardHeader({ usuario, onLogout }: DashboardHeaderProps) {
  // Obter as iniciais do nome do usuário para o avatar
  const iniciais = usuario.nome
    ? usuario.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-50 bg-slate-900/60 backdrop-blur-lg border-b border-white/10 text-white transition-all">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Marca / Logotipo */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 text-2xl p-2.5 rounded-xl shadow-md shadow-blue-500/10">
            📊
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
              Financeiro Casal
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
              Painel de Controle
            </p>
          </div>
        </div>

        {/* Perfil e Ações */}
        <div className="flex items-center gap-4">
          {/* Informações do Usuário com Avatar */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 pl-3 pr-4 py-1.5 rounded-full backdrop-blur-sm">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-inner">
              {iniciais}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs text-slate-400 font-medium">Conta ativa</p>
              <p className="text-sm font-semibold text-slate-200">{usuario.nome}</p>
            </div>
          </div>

          {/* Botão Sair */}
          <button
            onClick={onLogout}
            className="px-4 py-2 text-sm font-medium rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-300 active:scale-95 shadow-lg shadow-red-950/10"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
