'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { verificarAcessoAutorizado, obterOuCriarUsuario, logout } from '@/lib/auth';
import { Usuario } from '@/lib/types';
import LoginPage from './login/page';
import DashboardPage from './dashboard/page';
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const [autenticado, setAutenticado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    verificarSessao();

    // Escutar mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          await processarLogin(session.user.email, session.user.user_metadata?.name || session.user.email);
        } else if (event === 'SIGNED_OUT') {
          setAutenticado(false);
          setUsuario(null);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const verificarSessao = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        await processarLogin(session.user.email, session.user.user_metadata?.name || session.user.email);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setCarregando(false);
    }
  };

  const processarLogin = async (email: string, nome: string) => {
    try {
      const autorizado = await verificarAcessoAutorizado(email);
      if (!autorizado) {
        toast.error('Email não autorizado para acessar o sistema');
        await logout();
        setAutenticado(false);
        setCarregando(false);
        return;
      }

      const usuarioData = await obterOuCriarUsuario(email, nome);
      if (usuarioData) {
        setUsuario(usuarioData);
        setAutenticado(true);
      } else {
        toast.error('Erro ao carregar dados do usuário');
        await logout();
        setAutenticado(false);
      }
    } catch (error: any) {
      console.error('Erro ao processar login:', error.message);
      toast.error(error.message || 'Erro ao fazer login');
      await logout();
      setAutenticado(false);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-blue-600">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      {autenticado && usuario ? (
        <DashboardPage usuario={usuario} />
      ) : (
        <LoginPage onLoginSuccess={procesarLogin} />
      )}
    </>
  );
}
