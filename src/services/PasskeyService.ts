// WebAuthn (Passkey) service con integración backend
const API_BASE = (import.meta.env.PUBLIC_API_URL || 'http://localhost:3000') + '/api';

/**
 * Convierte un ArrayBuffer a base64url
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convierte base64url a Uint8Array
 */
function fromBase64Url(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

/**
 * Interfaz para opciones de registro
 */
interface RegisterOptions {
  id: string;
  name: string;
  displayName?: string;
}

/**
 * Interfaz para respuesta de registro
 */
interface RegisterResponse {
  id: string;
  rawId: string;
  clientDataJSON: string;
  attestationObject: string;
}

/**
 * Interfaz para respuesta de autenticación
 */
interface AuthenticateResponse {
  id: string;
  rawId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string | null;
}

/**
 * Valida soporte del navegador para WebAuthn
 */
function validateWebAuthnSupport(): void {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn no es soportado en este navegador');
  }
}

/**
 * Registra una nueva credencial Passkey
 */
export async function registerPasskey(opts: RegisterOptions): Promise<RegisterResponse> {
  validateWebAuthnSupport();

  if (!opts.id || !opts.name) {
    throw new Error('ID y nombre de usuario son requeridos');
  }

  try {
    // 1. Solicitar opciones de registro al backend
    const optionsResponse = await fetch(`${API_BASE}/passkey/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: opts.name,
        displayName: opts.displayName || opts.name
      })
    });

    if (!optionsResponse.ok) {
      throw new Error('Error obteniendo opciones de registro');
    }

    const { challenge, sessionId, userId } = await optionsResponse.json();

    // 2. Crear credencial con WebAuthn
    // Decode challenge (base64url) to Uint8Array
    const challengeArray = typeof challenge === 'string' ? fromBase64Url(challenge) : new Uint8Array(challenge);
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challengeArray,
      rp: {
        name: 'CenVote dApp',
        id: window.location.hostname // Ensure rp.id matches the domain to avoid "invalid domain" errors
      },
      user: {
        id: new TextEncoder().encode(opts.id),
        name: opts.name,
        displayName: opts.displayName || opts.name
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    } as any;

    console.log('[PasskeyService] Registrando passkey...');

    const cred = (await navigator.credentials.create({
      publicKey
    } as any)) as PublicKeyCredential | null;

    if (!cred) {
      throw new Error('No se pudo crear la credencial');
    }

    const attResp: any = cred.response as any;

    // 3. Verificar credencial en el backend
    const verifyResponse = await fetch(`${API_BASE}/passkey/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        credentialId: toBase64Url(cred.rawId as ArrayBuffer),
        publicKey: toBase64Url(attResp.attestationObject),
        username: opts.name,
        displayName: opts.displayName || opts.name,
        aaguid: ''
      })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(error.error || 'Error verificando credencial');
    }

    const result = await verifyResponse.json();

    // Guardar token en localStorage
    if (result.userId) {
      localStorage.setItem('passkey_user_id', result.userId);
      localStorage.setItem('passkey_username', result.username);
      localStorage.setItem('passkey_display_name', result.displayName);
    }

    console.log('[PasskeyService] ✓ Registro exitoso');

    return {
      id: cred.id,
      rawId: toBase64Url(cred.rawId as ArrayBuffer),
      clientDataJSON: toBase64Url(attResp.clientDataJSON),
      attestationObject: toBase64Url(attResp.attestationObject)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';

    if (message.includes('User cancelled')) {
      throw new Error('El registro fue cancelado');
    } else if (message.includes('NotAllowedError')) {
      throw new Error('No se permite registrar un passkey aquí');
    } else if (message.includes('NotSupportedError')) {
      throw new Error('Este dispositivo no soporta passkeys');
    }

    throw error;
  }
}

/**
 * Autentica con una credencial Passkey existente
 */
export async function authenticatePasskey(
  _serverChallenge?: string | Uint8Array
): Promise<AuthenticateResponse> {
  validateWebAuthnSupport();

  try {
    // 1. Solicitar challenge al backend
    const optionsResponse = await fetch(`${API_BASE}/passkey/authenticate/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!optionsResponse.ok) {
      throw new Error('Error obteniendo challenge de autenticación');
    }

    const { challenge, sessionId } = await optionsResponse.json();

    // 2. Autenticar con WebAuthn
    // Decode challenge (base64url) to Uint8Array
    const challengeArray = typeof challenge === 'string' ? fromBase64Url(challenge) : new Uint8Array(challenge);
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challengeArray,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: [],
      // rp.id is not required for authentication request options, but ensure hostname consistency if needed
    } as any;

    console.log('[PasskeyService] Autenticando con passkey...');

    const assertion = (await navigator.credentials.get({
      publicKey
    } as any)) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('No se pudo obtener una aserción');
    }

    const authResp: any = assertion.response as any;

    // 3. Verificar autenticación en el backend
    const verifyResponse = await fetch(`${API_BASE}/passkey/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        credentialId: toBase64Url(assertion.rawId as ArrayBuffer),
        username: localStorage.getItem('passkey_username') || ''
      })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(error.error || 'Error en autenticación');
    }

    const result = await verifyResponse.json();

    // Guardar token de sesión
    if (result.authToken) {
      localStorage.setItem('auth_token', result.authToken);
      localStorage.setItem('passkey_user_id', result.userId);
      localStorage.setItem('passkey_username', result.username);
      localStorage.setItem('passkey_display_name', result.displayName);
    }

    console.log('[PasskeyService] ✓ Autenticación exitosa');

    return {
      id: assertion.id,
      rawId: toBase64Url(assertion.rawId as ArrayBuffer),
      clientDataJSON: toBase64Url(authResp.clientDataJSON),
      authenticatorData: toBase64Url(authResp.authenticatorData),
      signature: toBase64Url(authResp.signature),
      userHandle: authResp.userHandle ? toBase64Url(authResp.userHandle) : null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';

    if (message.includes('User cancelled')) {
      throw new Error('La autenticación fue cancelada');
    } else if (message.includes('NotAllowedError')) {
      throw new Error('No tienes credenciales registradas o el passkey no es válido');
    } else if (message.includes('NotSupportedError')) {
      throw new Error('Este dispositivo no soporta passkeys');
    }

    throw error;
  }
}

/**
 * Verificar disponibilidad de passkeys en el dispositivo
 */
export async function isPasskeyAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) {
      return false;
    }

    const isUserVerifyingPlatformAuthenticatorAvailable =
      await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.();

    return isUserVerifyingPlatformAuthenticatorAvailable !== false;
  } catch {
    return false;
  }
}

/**
 * Utilidades exportadas
 */
export const PasskeyUtils = {
  toBase64Url,
  fromBase64Url
};
