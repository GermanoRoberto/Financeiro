'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface LoginPageProps {
  onLoginSuccess: (email: string, nome: string) => Promise<void>;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          const email = session.user.email;
          const nome = session.user.user_metadata?.name || session.user.email;
          await onLoginSuccess(email, nome);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [onLoginSuccess]);

  const handleGoogleLogin = async () => {
    try {
      setCarregando(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
        },
      });

      if (error) {
        toast.error('Erro ao fazer login: ' + error.message);
      }
    } catch (error: any) {
      toast.error('Erro ao fazer login');
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">💰 Financeiro</h1>
          <p className="text-gray-600 mt-2">Controle financeiro do casal</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={carregando}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {carregando ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Entrando...
            </>
          ) : (
            <>
              🔐 Entrar com Google
            </>
          )}
        </button>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">ℹ️ Dica:</span> Use sua conta Google para fazer login. Apenas emails autorizados podem acessar.
          </p>
        </div>
      </div>
    </div>
  );
}
