# Flujo de Registro y Autenticación de Passkey - CenVote

## 📱 ¿Qué es un Passkey?

Un **Passkey** es una forma segura de autenticación biométrica que utiliza WebAuthn (estándar web). Funciona con:
- 🔒 Huella dactilar
- 👤 Reconocimiento facial (Face ID)
- 🖱️ PIN del dispositivo

No usa contraseñas, es más seguro y resistente a phishing.

---

## 🔄 Flujo de Registro de Passkey

El registro de un passkey tarda porque implica 5 pasos:

### **PASO 1: Solicitar Challenge al Servidor** ⏱️ ~50-200ms
```
Cliente → POST /api/passkey/register/options → Servidor
```
- El navegador envía nombre de usuario y nombre para mostrar
- El servidor genera un **challenge** (número aleatorio único)
- El servidor crea una **sesión temporal** para validar después
- El servidor responde con el challenge y sessionId

**Tiempo esperado:** 50-200ms (depende de latencia de red)

### **PASO 2: Preparar Credencial WebAuthn** ⏱️ ~0-10ms
```
Cliente JavaScript
```
- Se preparan los parámetros para la credencial
- Se configura:
  - El nombre del RP (Relying Party): "CenVote dApp"
  - El ID del usuario
  - Tipo de autenticador: biométrico del dispositivo
  - Requerimiento de verificación del usuario

**Tiempo esperado:** 0-10ms (local)

### **PASO 3: Mostrar Prompt Biométrico** ⏱️ **5-60 SEGUNDOS** ⚠️ EL MÁS LENTO
```
navigator.credentials.create({ publicKey })
```
- El navegador ABRE UN DIALOG NATIVO del sistema operativo
- El usuario ve: "Toca tu huella" o "Mira la cámara"
- El dispositivo ESPERA la interacción del usuario
- El usuario completa la autenticación biométrica
- El dispositivo crea la credencial localmente

**Tiempo esperado:** 5-60+ segundos (DEPENDE DEL USUARIO)
- El sistema espera a que toques la huella
- Si fallas varias veces, se cancela
- Es el paso más lento porque está esperando acción del usuario

### **PASO 4: Verificar Credencial en el Servidor** ⏱️ ~100-300ms
```
Cliente → POST /api/passkey/register/verify → Servidor
```
- Se envía la credencial generada (attestationObject)
- Se envía el credentialId
- El servidor valida la sesión
- El servidor guarda la credencial en la base de datos
- El servidor guarda el usuario

**Tiempo esperado:** 100-300ms (depende de latencia de red)

### **PASO 5: Guardar Datos Locales** ⏱️ ~5-20ms
```
Cliente localStorage
```
- Se guardan en el localStorage del navegador:
  - `passkey_user_id`
  - `passkey_username`
  - `passkey_display_name`
- Estos datos se usan para futuras autenticaciones

**Tiempo esperado:** 5-20ms (local)

---

## ⏱️ Tiempo Total Esperado

| Paso | Tiempo Típico | Máximo |
|------|---------------|--------|
| 1. Challenge | 50-200ms | 500ms |
| 2. Preparación | 0-10ms | 50ms |
| 3. Biometría | **5-60s** | **2+ min** |
| 4. Verificación | 100-300ms | 1s |
| 5. Guardar | 5-20ms | 100ms |
| **TOTAL** | **5-61 segundos** | **2+ minutos** |

**⚠️ NOTA IMPORTANTE:** El tiempo principalmente depende del **PASO 3**, que es la interacción biométrica del usuario.

---

## 🔄 Flujo de Autenticación

La autenticación sigue un flujo similar pero más rápido:

### **PASO 1: Obtener Challenge** ⏱️ ~50-200ms
```
Cliente → POST /api/passkey/authenticate/options → Servidor
```

### **PASO 2: Preparación** ⏱️ ~0-10ms
```
Cliente JavaScript
```

### **PASO 3: Autenticación Biométrica** ⏱️ **5-30 SEGUNDOS**
```
navigator.credentials.get({ publicKey })
```
- El sistema operativo muestra el prompt biométrico
- El usuario toca la huella o usa Face ID
- El dispositivo genera la aserción

### **PASO 4: Verificar con Servidor** ⏱️ ~100-300ms
```
Cliente → POST /api/passkey/authenticate/verify → Servidor
```
- Se busca la credencial registrada
- Se valida la aserción
- Se genera token de autenticación

### **PASO 5: Guardar Token** ⏱️ ~5-20ms
```
Cliente localStorage
```
- Se guarda el `auth_token`

**⏱️ Tiempo total:** 5-30 segundos (más rápido que registro)

---

## 🛠️ ¿Por qué tarda?

### ✅ Razones Legítimas:

1. **Espera de biometría del usuario**
   - El sistema espera a que hagas clic en tu huella
   - Si fallas, puede intentar de nuevo
   - Cada intento toma segundos

2. **Latencia de red**
   - Comunicación con servidor
   - Puede afectar ~200-500ms

3. **Procesamiento de credencial**
   - El dispositivo genera cryptografía
   - Puede tomar 100-500ms

4. **Validación de sesión**
   - El servidor valida que la sesión es válida
   - Evita ataques de sesión

### ❌ Problemas Posibles (si tarda MÁS de lo esperado):

1. **Navegador lento**
   - Chrome/Firefox/Safari pueden ser lentos en algunos sistemas

2. **Dispositivo sin biométrico**
   - Si tu dispositivo no tiene huella/Face ID, puede fallar

3. **WebAuthn no disponible**
   - Si el navegador no soporta WebAuthn
   - El componente muestra advertencia

4. **Servidor lento**
   - Si el backend está procesando lentamente

---

## 📊 Logs Disponibles

Cuando haces clic en "Registrar Passkey", verás logs en la sección "Debug Info":

```
[PASO 1] Solicitando challenge al servidor...
[PASO 1] ✓ Challenge recibido en 145ms
[PASO 2] Preparando credencial WebAuthn...
[PASO 3] Mostrar prompt de autenticación biométrica...
⏳ En espera de acción biométrica del usuario...
[PASO 3] ✓ Credencial creada en 28000ms
[PASO 4] Verificando credencial con el servidor...
[PASO 4] ✓ Credencial verificada en 250ms
[PASO 5] Guardando datos de sesión...
[PASO 5] ✓ Datos guardados
```

Estos logs te muestran exactamente en qué paso estás y cuánto tardó cada parte.

---

## 🎯 Resumen Rápido

| Acción | Tiempo | Dónde tarda |
|--------|--------|------------|
| Registrar Passkey | 5-60s | En tu biometría |
| Autenticar | 5-30s | En tu biometría |
| Limpiar Sesión | <1s | Instantáneo |

**Si ves "⏳ En espera de acción biométrica del usuario..." = Todo está funcionando correctamente, solo espera a que el sistema te pida tu huella/Face ID**

---

## 🔍 Verificación de Disponibilidad

Al cargar el componente, automáticamente verifica:
- ✅ ¿Tu navegador soporta WebAuthn?
- ✅ ¿Tu dispositivo tiene biométrico disponible?

Si hay un problema, verás una advertencia en la sección de estado.

---

## 🖥️ Endpoint del Backend

Para ver el estado del sistema en tiempo real:
```
GET http://localhost:3000/api/debug
```

Respuesta:
```json
{
  "users": [ /* usuarios registrados */ ],
  "credentials": [ /* credenciales guardadas */ ],
  "sessions": [ /* sesiones activas */ ]
}
```

---

## ✨ Conclusión

El registro de passkey es **seguro pero puede ser lento** porque:
1. Requiere autenticación biométrica real (tú TIENES que hacer algo)
2. Implica comunicación con el servidor para validación
3. Genera criptografía local en tu dispositivo

Si todo funciona correctamente, verás los pasos en los logs y el resultado final será un passkey registrado y seguro.

