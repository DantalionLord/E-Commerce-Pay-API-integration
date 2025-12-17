# Payment Backend (Stripe + PayPal + TropiPay)

Este proyecto contiene API routes de Next.js (carpeta `pages/api/*`) pensadas para desplegar en Vercel. Expone integraciones básicas con Stripe y PayPal y guarda registros en PostgreSQL.

Rutas principales (Next.js API routes):
- `POST /api/create_stripe_payment_intent` -> Crea un PaymentIntent en Stripe y devuelve `clientSecret`.
- `POST /api/create_paypal_order` -> Crea una orden en PayPal y devuelve `orderID` + `approveUrl`.
- `POST /api/webhook_stripe` -> Webhook para eventos Stripe (usa raw body, la ruta tiene bodyParser deshabilitado).
- `POST /api/webhook_paypal` -> Webhook para eventos PayPal (usa raw body).

Configuración (variables de entorno necesarias en Vercel o local):

- `DATABASE_URL` - URL de Postgres (ej: `postgres://user:pass@host:5432/dbname`)
- `DB_SSL` - `true` si requiere SSL en la conexión a Postgres
- STRIPE:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET` (recomendado para verificar webhooks)
- PAYPAL:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_SECRET`
  - `PAYPAL_ENV` - `sandbox` o `live` (default `sandbox`)
  - `PAYPAL_WEBHOOK_ID` - id del webhook registrado en la app PayPal (opcional pero recomendado)

Despliegue en Vercel:
1. Crear un nuevo proyecto y apuntar al repo.
2. Definir las variables de entorno anteriores en la configuración del proyecto.
3. Push al repo; Vercel detectará la app Next.js y expondrá las API routes en `/api/*`.

Prueba local con Next.js:
1. Instala dependencias:
```powershell
cd 'Carpeta del proyecto'
npm install
```
2. Ejecuta en modo dev:
```powershell
npm run dev
```
3. Las rutas estarán disponibles en `http://localhost:3000/api/...`.

Idempotencia
- Ambos endpoints (`/api/create_stripe_payment_intent` y `/api/create_paypal_order`) aceptan un campo `idempotency_key` (en el body JSON) o la cabecera `Idempotency-Key`.
- Cuando se proporciona, el backend busca una orden existente con esa clave para el proveedor correspondiente y devuelve el recurso existente en lugar de crear uno nuevo.
- Para Stripe también se usa la opción de idempotencia del SDK de Stripe (`idempotencyKey`). Para PayPal se envía la cabecera `PayPal-Request-Id` cuando se crea la orden.
- La columna `idempotency_key` se añadió a la tabla `orders` y existe un índice único por `(provider, idempotency_key)` para evitar duplicados.

Ejemplos de uso (curl)

- Stripe (crear PaymentIntent con idempotencia):

```bash
curl -X POST https://tu-app.vercel.app/api/create_stripe_payment_intent \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"amount":5000, "currency":"USD"}'
```

Respuesta esperada:
```json
{ "clientSecret": "pi_..._secret_...", "id": "pi_..." }
```

- PayPal (crear orden con idempotencia):

```bash
curl -X POST https://tu-app.vercel.app/api/create_paypal_order \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"amount":2500, "currency":"USD"}'
```

Respuesta esperada:
```json
{ "orderID": "...", "approveUrl": "https://www.paypal.com/checkoutnow?token=..." }
```

Ejemplo Kotlin (llamada desde la app)

```kotlin
// Generar una clave única por intento (por ejemplo UUID)
val idemKey = java.util.UUID.randomUUID().toString()

// Stripe
val stripeResp = PaymentRepository.createStripePaymentIntent(5000, "USD", idemKey)
val clientSecret = stripeResp.getString("clientSecret")

// PayPal
val paypalResp = PaymentRepository.createPaypalOrder(2500, "USD", idemKey)
val orderId = paypalResp.getString("orderID")

// Si se reintenta la llamada con la misma idempKey, el backend devolverá la misma orden / PaymentIntent
```

Notas de seguridad:
- Nunca subir claves en el repo. Usar variables de entorno.
- Configurar y verificar webhooks (Stripe: `STRIPE_WEBHOOK_SECRET`, PayPal: `PAYPAL_WEBHOOK_ID`).

SQL de ejemplo para crear la tabla:
- `db/init.sql` contiene el DDL.

Ejemplos Android y pasos mínimos están en la carpeta `payment-android`.

TropiPay
-------

Se añadió una integración básica para TropiPay:

- Variables de entorno:
  - `TROPIPAY_API_KEY` - token de la API de TropiPay
  - `TROPIPAY_BASE_URL` - (opcional) URL base de la API, por defecto `https://api.tropipay.com`

- Endpoint nuevo:
  - `POST /api/create_tropipay_payment` -> Crea un pago en TropiPay. Acepta `amount` (en cents), `currency` y `idempotency_key` (o cabecera `Idempotency-Key`). Devuelve `{ paymentID, approveUrl, raw }`.

- Webhook:
  - `POST /api/webhook_tropipay` -> Handler genérico que procesa el JSON del webhook y actualiza el estado en la tabla `orders`. Añade la verificación de firma según la documentación de TropiPay en producción.

Ejemplo curl (TropiPay):

```bash
curl -X POST https://tu-app.vercel.app/api/create_tropipay_payment \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"amount":3000, "currency":"EUR"}'
```

Respuesta esperada (depende de TropiPay):
```json
{ "paymentID": "...", "approveUrl": "https://...", "raw": { /* respuesta completa de TropiPay */ } }
```

Nota: el handler de TropiPay es genérico — revisa la documentación oficial de TropiPay y ajusta el `create_tropipay_payment` para usar los campos exactos (por ejemplo `return_url`, `customer` u otros) requeridos por su API.

