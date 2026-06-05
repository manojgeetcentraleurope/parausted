type DeepStringValues<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringValues<T[K]>;
};

export const esMessages = {
  common: {
    appName: 'ParaUsted',
  },
  auth: {
    loginTitle: 'Inicia sesión',
    signupTitle: 'Crea tu cuenta',
  },
  dashboard: {
    title: 'Panel de comerciante',
    nextStep: 'Próximo paso: completar perfil del negocio.',
  },
  seo: {
    defaultTitle: 'ParaUsted — Tarjetas regalo para negocios locales',
    defaultDescription:
      'Crea, vende y entrega tarjetas regalo digitales personalizadas para negocios locales en España.',
  },
} as const;

export type MessagesShape = DeepStringValues<typeof esMessages>;
