import type { MessagesShape } from './es';

export const enMessages = {
  common: {
    appName: 'ParaUsted',
  },
  auth: {
    loginTitle: 'Sign in',
    signupTitle: 'Create your account',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    loginWithPassword: 'Sign in with password',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    createAccount: 'Create account',
    alreadyHaveAccount: 'Already have an account?',
    needAccount: 'Need an account?',
    checkYourEmail: 'Check your email to continue.',
    genericError: 'We could not complete that action. Please try again.',
  },
  dashboard: {
    title: 'Merchant dashboard',
    nextStep: 'Next step: complete your business profile.',
  },
  seo: {
    defaultTitle: 'ParaUsted — Gift cards for local businesses',
    defaultDescription:
      'Create, sell, and deliver personalized digital gift cards for local businesses in Spain.',
  },
} as const satisfies MessagesShape;
