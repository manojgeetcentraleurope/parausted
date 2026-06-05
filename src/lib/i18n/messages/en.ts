import type { MessagesShape } from './es';

export const enMessages = {
  common: {
    appName: 'ParaUsted',
  },
  auth: {
    loginTitle: 'Sign in',
    signupTitle: 'Create your account',
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
