Android integration examples (Kotlin) for calling the backend and using SDKs for Stripe and PayPal.

Gradle dependencies (app-level `build.gradle`):

```
dependencies {
  // Stripe
  implementation 'com.stripe:stripe-android:20.30.0'

  // PayPal Checkout SDK
  implementation 'com.paypal.checkout:android-sdk:0.8.0'
}
```

Flujo recomendado:
1. Android llama a `POST /api/create_stripe_payment_intent` con `amount` (en cents) para obtener `clientSecret`.
2. Inicializar `PaymentIntent` / `PaymentSheet` en la app usando `clientSecret`.

Para PayPal:
1. Android llama a `POST /api/create_paypal_order` con `amount` (en cents) y recibe `orderID` y `approveUrl`.
2. Usar la SDK de PayPal Checkout para aprobar/capturar la orden (o redirigir al `approveUrl`).

Ejemplos de código están en `PaymentRepository.kt`, `StripePaymentActivity.kt` y `PayPalPaymentActivity.kt`.
