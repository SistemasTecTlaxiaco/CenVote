# 🔗 Guía de Conexión Freighter Wallet

## Estado Actual de la Implementación

✅ **FreighterService** refactorizado para usar la API oficial `@stellar/freighter-api`
✅ **Página de prueba** creada en `/test-freighter`
✅ **Verificación** de la cuenta específica: `GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV`

---

## 📋 Pasos para Probar la Conexión

### 1. Preparación

**Asegúrate de tener Freighter instalado:**
- Si NO tienes Freighter instalado, ve a: https://www.freighter.app
- Instala la extensión para Chrome/Brave/Edge
- Configura tu wallet y asegúrate de estar en **TESTNET**

**Verifica tu red en Freighter:**
1. Abre la extensión Freighter
2. Click en el menú de configuración (⚙️)
3. Verifica que diga **"TESTNET"**
4. Si dice MAINNET o FUTURENET, cámbialo a TESTNET

---

### 2. Abrir la Página de Prueba

El servidor debe estar corriendo en `http://localhost:4321`

Visita esta URL en tu navegador:
```
http://localhost:4321/test-freighter
```

---

### 3. Probar la Conexión

**En la página de test, verás 3 botones:**

1. **🔗 Conectar Freighter**
   - Click en este botón
   - Se abrirá un popup de Freighter
   - Click en **"Approve"** / **"Aprobar"**
   - Deberías ver tu clave pública y un mensaje indicando si es la cuenta esperada

2. **🔍 Verificar Estado**
   - Muestra si Freighter está instalado
   - Muestra si hay una conexión activa
   - Muestra la cuenta conectada

3. **💰 Ver Balance**
   - Solo funciona si ya estás conectado
   - Muestra tu balance de XLM en TESTNET

---

### 4. Qué Esperar Ver

**Si TODO está correcto, deberías ver:**

```
✅ Wallet Conectada
Clave Pública:
GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV
✅ Es la cuenta esperada
Red: TESTNET
```

**En el console log (parte inferior de la página):**
```
[HH:MM:SS] ℹ️ Página de test cargada
[HH:MM:SS] ℹ️ Cuenta esperada: GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV
[HH:MM:SS] ℹ️ Iniciando conexión con Freighter...
[HH:MM:SS] ✅ Conexión exitosa: GBBP2...A6IV
```

---

### 5. Verificación en el Inspector del Navegador

**Abre el Developer Console (F12):**

1. Ve a la pestaña **Console**
2. Deberías ver logs como:
   ```
   🔄 Iniciando conexión con Freighter...
   🔐 Verificando permisos...
   🔑 Obteniendo dirección pública...
   ✅ Cuenta verificada: Es la cuenta esperada!
   ✅ Wallet conectada: GBBP2R...EATA6IV
   ```

3. Si ves errores, cópialos para debugging

---

## 🐛 Solución de Problemas

### Error: "Freighter no está instalada"
- **Solución:** Instala Freighter desde https://www.freighter.app
- Recarga la página después de instalar

### Error: "Por favor cambia a la red TESTNET"
- **Solución:** 
  1. Abre Freighter
  2. Click en el ícono de configuración
  3. Selecciona TESTNET
  4. Recarga la página

### Error: "Acceso denegado"
- **Solución:**
  1. Abre Freighter
  2. Ve a Settings → Connected Sites
  3. Si CenVote aparece en la lista bloqueada, remuévelo
  4. Intenta conectar nuevamente

### La cuenta conectada no es la esperada
- **Advertencia:** Esto significa que conectaste una cuenta diferente
- **Solución:** En Freighter, asegúrate de seleccionar la cuenta correcta
- La cuenta esperada es: `GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV`

---

## 🧪 Archivos Modificados

1. **`src/services/FreighterService.ts`**
   - Refactorizado para usar `@stellar/freighter-api`
   - Agregada verificación de la cuenta específica
   - Agregados métodos: `connect()`, `disconnect()`, `getAccountBalance()`

2. **`src/components/WalletConnector.astro`**
   - UI mejorada con loading, balance, network badge
   - Botón de desconexión
   - Copy to clipboard para la dirección

3. **`src/pages/test-freighter.astro`**
   - Página de prueba completa
   - Console log visual
   - Botones de test

---

## 📝 Comandos Útiles

**Reiniciar el servidor de desarrollo:**
```bash
# Detén el servidor actual (Ctrl+C)
npm run dev
```

**Ver logs en tiempo real:**
```bash
# En el navegador, presiona F12
# Ve a la pestaña Console
```

**Limpiar caché del navegador:**
```
Ctrl+Shift+R (o Cmd+Shift+R en Mac)
```

---

## ✅ Checklist de Verificación

- [ ] Freighter está instalado
- [ ] Freighter está en modo TESTNET
- [ ] El servidor está corriendo (`npm run dev`)
- [ ] Abrí `http://localhost:4321/test-freighter`
- [ ] Clickeé en "🔗 Conectar Freighter"
- [ ] Aprobé la conexión en el popup de Freighter
- [ ] Veo mi clave pública en la página
- [ ] Veo "✅ Es la cuenta esperada"
- [ ] Puedo ver mi balance clickeando "💰 Ver Balance"

---

## 🆘 Si Nada Funciona

**Comparte estos datos para debugging:**

1. La URL exacta que estás visitando
2. Los errores en la consola del navegador (F12 → Console)
3. La versión de Freighter instalada
4. El navegador que estás usando
5. Captura de pantalla de la página de test

---

*Última actualización: 2025-11-24*
