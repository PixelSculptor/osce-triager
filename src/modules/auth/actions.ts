'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { signIn, signOut } from '@/modules/auth/auth';
import { registerUser } from '@/modules/auth/user.util';

export type LoginState = {
  errors?: {
    email?: string;
    password?: string;
    _form?: string;
  };
} | null;

export type RegisterState = {
  errors?: {
    email?: string;
    password?: string;
    _form?: string;
  };
} | null;

export async function loginAction(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: NonNullable<LoginState>['errors'] = {};

  if (!email || !email.includes('@')) {
    errors.email = 'Podaj prawidłowy adres email';
  }
  if (!password) {
    errors.password = 'Hasło jest wymagane';
  }

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { errors: { _form: 'Nieprawidłowy email lub hasło' } };
  }

  return null;
}

export async function registerAction(
  prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: NonNullable<RegisterState>['errors'] = {};

  if (!email || !email.includes('@')) {
    errors.email = 'Podaj prawidłowy adres email';
  }
  if (!password || password.length < 8) {
    errors.password = 'Hasło musi mieć minimum 8 znaków';
  }

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await registerUser(email, password);
  } catch (e) {
    if (e instanceof Error && e.message === 'EMAIL_TAKEN') {
      return { errors: { email: 'Ten adres email jest już zajęty' } };
    }
    return { errors: { _form: 'Wystąpił błąd. Spróbuj ponownie.' } };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return {
      errors: { _form: 'Konto zostało utworzone. Zaloguj się na /login.' },
    };
  }

  return null;
}

export async function logoutAction(): Promise<void> {
  try {
    await signOut({ redirectTo: '/' });
  } catch (e) {
    if (isRedirectError(e)) throw e;
  }
}
