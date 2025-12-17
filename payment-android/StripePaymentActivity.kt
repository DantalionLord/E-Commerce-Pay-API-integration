package com.example.payment

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class StripePaymentActivity : AppCompatActivity() {
    private lateinit var paymentSheet: PaymentSheet
    private lateinit var paymentIntentClientSecret: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inicializa con tu publishable key en strings.xml o variables seguras
        PaymentConfiguration.init(applicationContext, getString(R.string.stripe_publishable_key))

        paymentSheet = PaymentSheet(this, ::onPaymentSheetResult)

        // Crear PaymentIntent en backend
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val resp = PaymentRepository.createStripePaymentIntent(5000) // ejemplo $50.00
                paymentIntentClientSecret = resp.getString("clientSecret")

                // Ahora en UI mostrar botón que cuando se pulse llama a present
                // Aquí simplemente lo abrimos directamente (ejemplo)
                CoroutineScope(Dispatchers.Main).launch {
                    paymentSheet.presentWithPaymentIntent(
                        paymentIntentClientSecret,
                        PaymentSheet.Configuration("Mi tienda")
                    )
                }

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun onPaymentSheetResult(paymentResult: PaymentSheetResult) {
        when (paymentResult) {
            is PaymentSheetResult.Canceled -> {
                // Usuario canceló
            }
            is PaymentSheetResult.Failed -> {
                // Error
                val ex = paymentResult.error
            }
            is PaymentSheetResult.Completed -> {
                // Pago completado — backend recibirá webhook de Stripe
            }
        }
    }
}
