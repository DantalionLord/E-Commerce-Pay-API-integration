package com.example.payment

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class TropipayPaymentActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ejemplo: crear pago con TropiPay a través del backend
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val idemKey = java.util.UUID.randomUUID().toString()
                val resp = PaymentRepository.createTropipayPayment(3000, "EUR", idemKey)
                val paymentId = resp.optString("paymentID", "")
                val approveUrl = resp.optString("approveUrl", "")

                // Si approveUrl está presente, abrir en WebView o navegador para completar
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
