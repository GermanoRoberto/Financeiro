'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { obterOuCriarUsuario } from '@/lib/auth';
import { Usuario } from '@/lib/types';
import DashboardPage from '@/components/DashboardPage';

export default function DashboardRoute() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function verificarSessao() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          router.push('/');
          return;
        }
        const user = await obterOuCriarUsuario(
          session.user.email,
          session.user.user_metadata?.name || session.user.email
        );
        if (!user) {
          router.push('/');
          return;
        }
        setUsuario(user);
      } catch (error) {
        console.error('Erro na rota de dashboard:', error);
        router.push('/');
      } finally {
        setCarregando(false);
      }
    }
    verificarSessao();
  }, [router]);

  if (carregando || !usuario) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <DashboardPage usuario={usuario} />;
}
