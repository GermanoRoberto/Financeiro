import { supabase } from './supabaseClient';
import { Usuario } from './types';
import { AuthorizationService } from '@/services/AuthorizationService';

export async function verificarAcessoAutorizado(email: string): Promise<boolean> {
  return AuthorizationService.verificarAcesso(email);
}

export async function obterOuCriarUsuario(email: string, nome: string): Promise<Usuario | null> {
  return AuthorizationService.obterUsuario(email, nome);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
