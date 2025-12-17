package com.example.payment

import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import org.json.JSONObject
import java.io.IOException

object PaymentRepository {
    private val client = OkHttpClient()

    // Cambia BASE_URL por tu endpoint de Vercel (ej: https://tu-app.vercel.app)
    private const val BASE_URL = "https://your-vercel-app.vercel.app"

    @Throws(IOException::class)
    fun createStripePaymentIntent(amountCents: Long, currency: String = "USD", idempotencyKey: String? = null): JSONObject {
        val json = JSONObject()
        json.put("amount", amountCents)
        json.put("currency", currency)

        val body = RequestBody.create("application/json; charset=utf-8".toMediaTypeOrNull(), json.toString())
        val builder = Request.Builder()
            .url("$BASE_URL/api/create_stripe_payment_intent")
            .post(body)

        if (!idempotencyKey.isNullOrEmpty()) {
            builder.header("Idempotency-Key", idempotencyKey)
        }

        val req = builder.build()

        client.newCall(req).execute().use { resp ->
            val s = resp.body?.string() ?: throw IOException("Empty response")
            if (!resp.isSuccessful) throw IOException("Create PaymentIntent failed: $s")
            return JSONObject(s)
        }
    }

    @Throws(IOException::class)
    fun createPaypalOrder(amountCents: Long, currency: String = "USD", idempotencyKey: String? = null): JSONObject {
        val json = JSONObject()
        json.put("amount", amountCents)
        json.put("currency", currency)

        val body = RequestBody.create("application/json; charset=utf-8".toMediaTypeOrNull(), json.toString())
        val builder = Request.Builder()
            .url("$BASE_URL/api/create_paypal_order")
            .post(body)

        // PayPal accepts PayPal-Request-Id for idempotency; backend also checks Idempotency-Key
        if (!idempotencyKey.isNullOrEmpty()) {
            builder.header("PayPal-Request-Id", idempotencyKey)
            builder.header("Idempotency-Key", idempotencyKey)
        }

        val req = builder.build()

        client.newCall(req).execute().use { resp ->
            val s = resp.body?.string() ?: throw IOException("Empty response")
            if (!resp.isSuccessful) throw IOException("Create PayPal order failed: $s")
            return JSONObject(s)
        }
    }

    @Throws(IOException::class)
    fun createTropipayPayment(amountCents: Long, currency: String = "USD", idempotencyKey: String? = null): JSONObject {
        val json = JSONObject()
        json.put("amount", amountCents)
        json.put("currency", currency)

        val body = RequestBody.create("application/json; charset=utf-8".toMediaTypeOrNull(), json.toString())
        val builder = Request.Builder()
            .url("$BASE_URL/api/create_tropipay_payment")
            .post(body)

        if (!idempotencyKey.isNullOrEmpty()) {
            builder.header("Idempotency-Key", idempotencyKey)
        }

        val req = builder.build()

        client.newCall(req).execute().use { resp ->
            val s = resp.body?.string() ?: throw IOException("Empty response")
            if (!resp.isSuccessful) throw IOException("Create TropiPay payment failed: $s")
            return JSONObject(s)
        }
    }
}
