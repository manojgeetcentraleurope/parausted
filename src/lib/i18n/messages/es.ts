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
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    loginWithPassword: 'Iniciar sesión con contraseña',
    sendMagicLink: 'Enviar enlace de acceso',
    continueWithGoogle: 'Continuar con Google',
    createAccount: 'Crear cuenta',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    needAccount: '¿Necesitas una cuenta?',
    checkYourEmail: 'Revisa tu correo para continuar.',
    genericError: 'No hemos podido completar esa acción. Vuelve a intentarlo.',
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
  purchases: {
    title: 'Centro de Pagos',
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    expired: 'Expirado',
    noPending: 'No hay compras pendientes.',
    searchPlaceholder: 'Buscar por código de referencia...',
    referenceCode: 'Código de referencia',
    giftCard: 'Tarjeta regalo',
    amount: 'Importe',
    paymentMethod: 'Método de pago',
    buyerEmail: 'Email del comprador',
    recipientName: 'Nombre del destinatario',
    createdAt: 'Fecha de creación',
    expiresAt: 'Expira',
    status: 'Estado',
    confirmPayment: 'Confirmar pago',
    rejectPayment: 'Rechazar',
    confirmTitle: '¿Confirmar este pago?',
    confirmMessage: 'Se generará un vale para el destinatario. Esta acción no se puede deshacer.',
    rejectTitle: '¿Rechazar este pago?',
    rejectMessage: 'La compra será cancelada. Esta acción no se puede deshacer.',
    rejectReasonLabel: 'Motivo (opcional)',
    rejectReasonPlaceholder: 'Pago no recibido, datos incorrectos...',
    confirm: 'Confirmar',
    reject: 'Rechazar',
    cancel: 'Volver',
    successConfirmed: 'Pago confirmado correctamente.',
    successRejected: 'Compra rechazada.',
    errorAlreadyProcessed: 'Esta compra ya fue procesada.',
    errorExpired: 'Esta compra ha expirado y no se puede confirmar.',
    errorNotFound: 'Compra no encontrada.',
    errorUnauthorized: 'No tienes permiso para esta acción.',
    errorUnknown: 'Error inesperado. Inténtalo de nuevo.',
    bizumDirect: 'Bizum',
    bankTransfer: 'Transferencia bancaria',
    cash: 'Efectivo',
  },
} as const;

export type MessagesShape = DeepStringValues<typeof esMessages>;
