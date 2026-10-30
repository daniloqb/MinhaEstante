package com.booknookapp

import android.app.Activity
import android.content.Intent
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Debug
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONArray
import org.json.JSONObject

/** DEV-only synthetic experiment. No plugin method, production manifest, binary bridge or SQL change. */
class BackupZipProofActivity : Activity() {
    private lateinit var text: TextView
    private val stop = AtomicBoolean(false)
    private var running = false
    private val root get() = File(cacheDir, "backup-zip-proof").also { it.mkdirs() }
    private fun show(value: String) = runOnUiThread { text.text = value }
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        check(BuildConfig.DEBUG && packageName == "com.booknookapp.dev")
        text = TextView(this).apply { text = "Backup v2 — Streaming Proof of Concept\nOnly dev-proof-42a-* synthetic managed sources. No restore." }
        val choose = Button(this).apply { text = "Escolher destino ZIP sintético (SAF)"; setOnClickListener {
            if (!running) startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE); type = "application/zip"; putExtra(Intent.EXTRA_TITLE, "minhaestante-synthetic-42a.zip")
            }, 4242)
        } }
        val cancel = Button(this).apply { text = "Cancelar escrita"; setOnClickListener { stop.set(true) } }
        val inspect = Button(this).apply { text = "Verificar ZIPs Web sintéticos transferidos"; setOnClickListener { Thread { inspectWeb() }.start() } }
        setContentView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; addView(choose); addView(cancel); addView(inspect); addView(text) })
        if (intent.getBooleanExtra("inspectWeb", false)) Thread { inspectWeb() }.start()
    }
    @Deprecated("Local debug activity result only")
    override fun onActivityResult(request: Int, result: Int, data: Intent?) {
        super.onActivityResult(request, result, data)
        if (request != 4242) return
        if (result != RESULT_OK || data?.data == null) { show("CANCELLED_PICKER: no output created"); return }
        val destination = data.data!!; stop.set(false); running = true
        // Private receipt before writing: URI never enters WebView, manifest, log or report.
        getSharedPreferences("backup_zip_proof", Context.MODE_PRIVATE).edit().putString("incompleteDestination", destination.toString()).commit()
        Thread { try { runProof(destination) } finally { running = false } }.start()
    }
    private fun readManaged(record: ImportRecord): InputStream {
        check(record.spec.operationId.startsWith("dev-proof-42a-") && record.spec.filename.startsWith("synthetic"))
        check(record.stage in setOf("FILE_READY", "LINKING", "COMPLETED") && record.size > 0 && record.hash.length == 64)
        val prefs = getSharedPreferences("digital_library_saf_v1", Context.MODE_PRIVATE)
        val tree = Uri.parse(prefs.getString("tree.${record.spec.tree}", null) ?: throw BackupZipProof.Failure("SOURCE_UNAVAILABLE"))
        if (contentResolver.persistedUriPermissions.none { it.uri == tree && it.isReadPermission }) throw BackupZipProof.Failure("PERMISSION_REQUIRED")
        return contentResolver.openInputStream(Uri.parse(record.uri)) ?: throw BackupZipProof.Failure("SOURCE_UNAVAILABLE")
    }
    private fun runProof(destination: Uri) {
        var state = "incomplete"
        try {
            val journal = ImportJournal(AndroidMetadataFiles(File(filesDir, "digital-storage-v1")))
            val records = listOf("epub", "pdf", "mp3").map { format -> journal.read("dev-proof-42a-$format") ?: throw BackupZipProof.Failure("SOURCE_UNAVAILABLE") }
            val uuids = listOf("10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002")
            val media = JSONArray()
            val sources = records.mapIndexed { i, r ->
                val path = "media/${if (i == 2) "audiobooks" else "ebooks"}/proof-${r.spec.format}.${r.spec.format}"
                media.put(JSONObject().put("id", "proof-${r.spec.format}").put("bookUuid", uuids[if (i == 1) 1 else 0])
                    .put("type", if (i == 2) "audiobook" else "ebook").put("format", r.spec.format).put("filename", "Obra sintética — ação 日本語.${r.spec.format}")
                    .put("createdAt", 1).put("updatedAt", 2).put("state", "included").put("archivePath", path).put("sizeBytes", r.size).put("sha256", r.hash))
                BackupZipProof.Source(path) { readManaged(r) }
            }.toMutableList()
            fun descriptor(path: String, bytes: ByteArray): JSONObject = JSONObject().put("archivePath", path).put("sizeBytes", bytes.size)
                .put("sha256", MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) })
            val books = JSONArray(uuids.mapIndexed { i, uuid -> JSONObject().put("id", i + 1).put("uuid", uuid).put("origem", "manual")
                .put("titulo", "Prova SAF sintética 日本語").put("autores", JSONArray()).put("generos", JSONArray()).put("tenho_fisico", false)
                .put("formato", "fisico").put("formatos", JSONArray(listOf("fisico"))).put("status_leitura", "quero_ler").put("dataCadastro", 1).put("dataAtualizacao", 2) }).toString().toByteArray()
            val reading = """{"readerPositions":[{"id":"proof-position","attachmentId":"proof-epub","locationType":"epub_cfi","location":"epubcfi(/6/2)","updatedAt":2}],"sessions":[{"id":"proof-session","bookUuid":"${uuids[0]}","status":"active","startedAt":1,"updatedAt":2}],"progress":[{"id":"proof-progress","sessionId":"proof-session","unit":"pages","currentValue":3,"totalValue":20,"source":"manual","updatedAt":2}]}""".toByteArray()
            val manifest = JSONObject().put("format", "minhaestante-backup").put("backupVersion", 2).put("backupId", "proof-saf-42a")
                .put("createdAt", "2026-10-29T18:00:00Z").put("options", JSONObject().put("includeEbooks", true).put("includeAudiobooks", true))
                .put("counts", JSONObject().put("books", 2).put("covers", 0).put("eligibleMedia", 3).put("includedMedia", 3).put("omittedMedia", 0).put("unavailableMedia", 0))
                .put("bibliography", descriptor("books.json", books)).put("reading", descriptor("reading.json", reading)).put("covers", JSONArray()).put("media", media).put("acknowledgedOmissions", JSONArray())
            sources.add(0, BackupZipProof.Source("books.json") { ByteArrayInputStream(books) })
            sources.add(1, BackupZipProof.Source("reading.json") { ByteArrayInputStream(reading) })
            sources.add(BackupZipProof.Source("manifest.json") { ByteArrayInputStream(manifest.toString().toByteArray()) })
            val output = contentResolver.openOutputStream(destination, "wt") ?: throw BackupZipProof.Failure("DESTINATION_WRITE")
            var last = 0L
            val metrics = BackupZipProof.write(sources, output, stop = stop::get, progress = { p ->
                if (System.nanoTime() - last > 250000000) { last = System.nanoTime(); show("${p.phase}: input=${p.inputBytes}, ZIP=${p.outputBytes}") }
            })
            state = "closed-unverified"
            // ZipFile needs seek: bounded copy of the selected SAF output into an owned private test file.
            val copy = File(root, "kotlin-saf-42a.zip")
            val digest = contentResolver.openInputStream(destination)!!.use { input -> copy.outputStream().use { IncrementalCopy.digest(input, it) } }
            val entries = BackupZipProof.inspect(copy)
            check(entries == metrics.entries)
            val preserved = records.all { record -> readManaged(record).use { IncrementalCopy.digest(it).let { d -> d.size == record.size && d.sha256 == record.hash } } }
            check(preserved)
            val memory = Debug.MemoryInfo(); Debug.getMemoryInfo(memory)
            state = "verified"
            val report = JSONObject().put("state", state).put("inputBytes", metrics.inputBytes).put("zipBytes", metrics.outputBytes)
                .put("zipSha256", digest.sha256).put("durationMs", metrics.durationMs).put("maxRead", metrics.maxRead).put("heapPeak", metrics.heapPeak)
                .put("pssKiB", memory.totalPss).put("rssPeakKiB", metrics.rssPeakKiB).put("entries", JSONArray(BackupZipProof.json(entries)))
                .put("originalSourcesPreserved", preserved).put("outputLocation", "user-selected-saf").put("uriExposed", false)
            File(root, "kotlin-saf-report.json").writeText(report.toString())
            getSharedPreferences("backup_zip_proof", Context.MODE_PRIVATE).edit().remove("incompleteDestination").commit()
            show(report.toString(2))
        } catch (error: Exception) {
            val code = if (error is BackupZipProof.Failure) error.code else "PROOF_FAILED"
            val report = JSONObject().put("state", state).put("error", code).put("partialRetained", true)
            File(root, "kotlin-saf-report.json").writeText(report.toString()); show(report.toString(2))
        }
    }
    private fun inspectWeb() {
        try {
            val files = root.listFiles()!!.filter { it.name.startsWith("web-") && it.name.endsWith(".zip") }
            check(files.isNotEmpty())
            val report = JSONArray(files.map { file -> JSONObject().put("filename", file.name).put("entries", JSONArray(BackupZipProof.json(BackupZipProof.inspect(file)))) })
            File(root, "android-read-web-report.json").writeText(report.toString()); show("Android ZipFile: ${files.size} synthetic Web ZIPs verified")
        } catch (_: Exception) { show("WEB_INTEROP_FAILED") }
    }
}
