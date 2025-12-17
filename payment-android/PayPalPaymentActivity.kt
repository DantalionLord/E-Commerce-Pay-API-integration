package com.example.payment

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.paypal.checkout.Checkout
import com.paypal.checkout.config.CheckoutConfig
import com.paypal.checkout.createorder.CreateOrderActions
import com.paypal.checkout.createorder.CreateOrderCallback
import com.paypal.checkout.createorder.OrderIntent
import com.paypal.checkout.order.Amount
import com.paypal.checkout.order.AppContext
import com.paypal.checkout.order.OrderRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PayPalPaymentActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inicializar Checkout SDK
        val config = CheckoutConfig(
            application = application,
            clientId = getString(R.string.paypal_client_id),
            environment = com.paypal.checkout.Environment.SANDBOX,
            returnUrl = "com.example.yourapp://paypalpay",
            currencyCode = com.paypal.checkout.CurrencyCode.USD
        )
        Checkout.setConfig(config)

        // Usar el componente de PayPal para crear/autorizar orden
        // Aquí mostramos cómo crear una orden desde la app usando el backend

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val resp = PaymentRepository.createPaypalOrder(2500) // ejemplo $25.00
                val orderId = resp.getString("orderID")

                // Con el SDK puedes crear un botón que llame a approve/capture, o redirigir
                // Si usas el Checkout SDK, puedes montar el flujo usando CreateOrderCallback

                // Ejemplo conceptual: (en la UI) lanzar el flujo de PayPal que use orderId
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
