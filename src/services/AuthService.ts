// AuthService.ts - Servicio de autenticación para CenVote

interface AuthUser {
    _id: string;
    first_name: string;
    paternal_last_name: string;
    maternal_last_name: string;
    email: string;
    phone: string;
    role: 'admin' | 'user';
    wallet_address: string | null;
}

interface LoginResult {
    success: boolean;
    message: string;
    user?: AuthUser;
}

interface RegisterData {
    first_name: string;
    paternal_last_name: string;
    maternal_last_name: string;
    email: string;
    password: string;
    phone: string;
}

class AuthService {
    private static instance: AuthService;
    private readonly STORAGE_KEY_TOKEN = 'cenvote_auth_token';
    private readonly STORAGE_KEY_USER = 'cenvote_auth_user';

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    private getApiUrl(): string {
        if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.PUBLIC_API_URL) {
            return import.meta.env.PUBLIC_API_URL;
        }
        if (typeof window !== 'undefined') {
            return window.location.protocol === 'https:'
                ? 'https://' + window.location.hostname + ':3001'
                : 'http://' + window.location.hostname + ':3000';
        }
        return 'http://localhost:3000';
    }

    async login(email: string, password: string): Promise<LoginResult> {
        try {
            const res = await fetch(`${this.getApiUrl()}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || 'Error al iniciar sesión' };
            }
            this.saveSession(data.token, data.user);
            return { success: true, message: 'Sesión iniciada', user: data.user };
        } catch (err) {
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    }

    async register(data: RegisterData): Promise<LoginResult> {
        try {
            const res = await fetch(`${this.getApiUrl()}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) {
                return { success: false, message: result.error || 'Error al registrarse' };
            }
            this.saveSession(result.token, result.user);
            return { success: true, message: 'Cuenta creada', user: result.user };
        } catch (err) {
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    }

    async updateProfile(updates: Partial<AuthUser>): Promise<LoginResult> {
        try {
            const token = this.getToken();
            if (!token) return { success: false, message: 'No hay sesión activa' };
            const res = await fetch(`${this.getApiUrl()}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (!res.ok) return { success: false, message: data.error || 'Error al actualizar' };
            // Update local storage
            this.saveSession(token, data);
            return { success: true, message: 'Perfil actualizado', user: data };
        } catch (err) {
            return { success: false, message: 'Error de conexión' };
        }
    }

    logout(): void {
        if (typeof window === 'undefined') return;
        const token = this.getToken();
        if (token) {
            fetch(`${this.getApiUrl()}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => { });
        }
        localStorage.removeItem(this.STORAGE_KEY_TOKEN);
        localStorage.removeItem(this.STORAGE_KEY_USER);
        window.location.href = '/login';
    }

    getUser(): AuthUser | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_USER);
            if (!raw) return null;
            const user = JSON.parse(raw);
            if (user && !user.role) {
                user.role = 'user'; // Fallback robusto para evitar inconsistencias de rol en usuarios heredados
            }
            return user;
        } catch { return null; }
    }

    getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(this.STORAGE_KEY_TOKEN);
    }

    isAuthenticated(): boolean {
        try {
            const token = this.getToken();
            const user = this.getUser();

            // 1. Validar existencia e integridad del token
            if (!token || typeof token !== 'string' || token.trim() === '') {
                return false;
            }

            // 2. Validar existencia e integridad mínima del objeto de usuario
            if (!user || typeof user !== 'object') {
                return false;
            }

            // 3. Validar la presencia de un identificador de usuario válido
            if (!user._id || typeof user._id !== 'string' || user._id.trim() === '') {
                return false;
            }

            // 4. Validar la presencia de un correo o nombre de usuario
            const emailOrUsername = user.email || (user as any).username;
            if (!emailOrUsername || typeof emailOrUsername !== 'string' || emailOrUsername.trim() === '') {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    isAdmin(): boolean {
        const user = this.getUser();
        return user?.role === 'admin';
    }

    private saveSession(token: string, user: AuthUser): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(this.STORAGE_KEY_TOKEN, token);
        localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));
    }
}

export const authService = AuthService.getInstance();


//verificacion 