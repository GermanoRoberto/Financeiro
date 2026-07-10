'use client';

import { Usuario } from '@/lib/types';

interface DashboardHeaderProps {
  usuario: Usuario;
  onLogout: () => void;
}

export default function DashboardHeader({ usuario, onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">💰 Financeiro Casal</h1>
          <p className="text-blue-100 text-sm mt-1">Bem-vindo, {usuario.nome}</p>
        </div>
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
