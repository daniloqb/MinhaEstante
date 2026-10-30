package com.booknookapp

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.StatFs
import android.provider.DocumentsContract
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.*
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.*
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** DEV companion only. Managed bytes stay native; no SQL, association mutation or external deletion. */
@CapacitorPlugin(name = "BackupV2Export")
class BackupV2ExportPlugin : Plugin() {
    companion object {
        private val owner = BackupExportOwnership()
        private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()
        private val faults = ConcurrentHashMap<String, String>()
        private const val MAX_BYTES = 101L * 1024 * 1024
    }
    private val io = Executors.newSingleThreadExecutor()
    private var selectedOperation: String? = null
    private val root get() = File(context.cacheDir, "backup-v2-export").also { it.mkdirs() }
    private val receipts by lazy { AndroidMetadataFiles(File(context.filesDir, "backup-v2-export-journal")) }
    private val streams = ConcurrentHashMap<String, Closeable>()
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun id(call: PluginCall): String = call.getString("operationId")!!.also {
        if (!it.matches(Regex("backup-[a-f0-9-]{36}"))) throw BackupZipProof.Failure("INVALID_REFERENCE")
    }
    private fun gate() { if (!BuildConfig.DEBUG || context.packageName != "com.booknookapp.dev") throw BackupZipProof.Failure("CAPABILITY_UNAVAILABLE") }
    private fun receipt(id: String): JSONObject = receipts.read(hash(id.toByteArray()))?.let { JSONObject(String(it)) }
        ?: throw BackupZipProof.Failure("RECOVERY_REQUIRED")
    private fun checkpoint(id: String, stage: String, uri: Uri? = null, errorCode: String? = null) {
        val value = receipts.read(hash(id.toByteArray()))?.let { JSONObject(String(it)) } ?: JSONObject().put("version", 1).put("operationId", id)
        value.put("stage", stage)
        if (errorCode != null) value.put("errorCode", errorCode)
        if (uri != null) value.put("destination", uri.toString()) // private only, never returned to JS
        receipts.write(hash(id.toByteArray()), value.toString().toByteArray())
    }
    private fun check(id: String) { if (cancelled[id]?.get() == true) throw BackupZipProof.Failure("CANCELLED") }
    private fun ok(call: PluginCall, value: JSONObject = JSONObject()) { call.resolve(JSObject().put("status", "success").put("value", value)) }
    private fun failed(call: PluginCall, error: Exception, operation: String? = null) {
        val code = if (operation != null && cancelled[operation]?.get() == true) "CANCELLED" else when(error) {
            is BackupZipProof.Failure -> error.code
            is SecurityException -> "PERMISSION_REQUIRED"
            is FileNotFoundException -> "MEDIA_UNAVAILABLE"
            else -> "IO_FAILED"
        }
        var outputClosed = false
        if (operation != null) { try {
            outputClosed = receipt(operation).optString("stage") in setOf("closed-unverified", "verifying", "verified-awaiting-snapshot")
            checkpoint(operation, if(code == "CANCELLED") "cancelled" else "failed", errorCode=code)
        } catch (_: Exception) {} }
        call.resolve(JSObject().put("status", "error").put("code", code).put("outputClosed", outputClosed))
    }
    private fun async(call: PluginCall, work: () -> JSONObject) = io.execute { try { gate(); ok(call, work()) } catch(e: Exception) { failed(call, e, call.getString("operationId")) } }
    private fun operationRoot(id: String): File = File(root, id).also { if (!it.exists()) it.mkdirs() }
    private fun metadataFile(id: String, path: String): File {
        if (!path.matches(Regex("(books|reading|manifest)\\.json|covers/[a-zA-Z0-9_-]+\\.(png|jpg|webp)"))) throw BackupZipProof.Failure("INVALID_PATH")
        return File(operationRoot(id), "stage-${hash(path.toByteArray())}.bin")
    }
    private fun record(source: JSONObject): ImportRecord {
        val reference = source.getString("storageReference")
        if (!reference.matches(Regex("[a-f0-9-]{36}"))) throw BackupZipProof.Failure("INVALID_REFERENCE")
        val journal = ImportJournal(AndroidMetadataFiles(File(context.filesDir, "digital-storage-v1")))
        val record = journal.all().firstOrNull { it.token == reference && it.stage == "COMPLETED" && it.link.isNotEmpty() }
            ?: throw BackupZipProof.Failure("MEDIA_UNAVAILABLE")
        val link = JSONObject(record.link)
        if (record.size != source.getLong("sizeBytes") || record.hash != source.getString("sha256") || record.spec.format != source.getString("format")
            || link.getInt("bookId") != source.getInt("bookId") || link.getString("attachmentId") != source.getString("attachmentId")) throw BackupZipProof.Failure("CONFLICT")
        return record
    }
    private fun openManaged(source: JSONObject): InputStream {
        val record = record(source)
        val prefs = context.getSharedPreferences("digital_library_saf_v1", Context.MODE_PRIVATE)
        val tree = Uri.parse(prefs.getString("tree.${record.spec.tree}", null) ?: throw BackupZipProof.Failure("MEDIA_UNAVAILABLE"))
        if (context.contentResolver.persistedUriPermissions.none { it.uri == tree && it.isReadPermission }) throw BackupZipProof.Failure("PERMISSION_REQUIRED")
        return context.contentResolver.openInputStream(Uri.parse(record.uri)) ?: throw BackupZipProof.Failure("MEDIA_UNAVAILABLE")
    }
    @PluginMethod fun capabilities(call: PluginCall) = async(call) {
        JSONObject().put("enabled", true).put("maxBytes", MAX_BYTES).put("temporaryAvailableBytes", StatFs(context.cacheDir.path).availableBytes)
    }
    @PluginMethod fun diagnoseChromeExternal(call: PluginCall) = async(call) {
        // Only the pre-authorized 4.2A synthetic tree; no general filesystem scan or personal file picker.
        val owned = ImportJournal(AndroidMetadataFiles(File(context.filesDir,"digital-storage-v1"))).read("dev-proof-42a-pdf")
            ?: throw BackupZipProof.Failure("MEDIA_UNAVAILABLE")
        val prefs = context.getSharedPreferences("digital_library_saf_v1", Context.MODE_PRIVATE)
        val tree = Uri.parse(prefs.getString("tree.${owned.spec.tree}",null) ?: throw BackupZipProof.Failure("MEDIA_UNAVAILABLE"))
        if(context.contentResolver.persistedUriPermissions.none { it.uri==tree && it.isReadPermission }) throw BackupZipProof.Failure("PERMISSION_REQUIRED")
        val children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree))
        val observations=JSONArray()
        context.contentResolver.query(children,arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME),null,null,null)!!.use { cursor ->
            while(cursor.moveToNext()) {
                val name=cursor.getString(1)
                if(!name.matches(Regex("minhaestante-synthetic-external-42b( \\([0-9]+\\))?\\.zip"))) continue
                if(observations.length()>=10) throw BackupZipProof.Failure("LIMIT_EXCEEDED")
                val uri=DocumentsContract.buildDocumentUriUsingTree(tree,cursor.getString(0));val file=File(root,"chrome-external-${observations.length()}.zip")
                var count=0L
                val digest=context.contentResolver.openInputStream(uri)!!.use { input -> file.outputStream().use { output ->
                    val bounded=object:FilterInputStream(input){override fun read(b:ByteArray,off:Int,len:Int):Int {val n=`in`.read(b,off,len);if(n>0)count+=n;if(count>128*1024)throw BackupZipProof.Failure("LIMIT_EXCEEDED");return n}}
                    IncrementalCopy.digest(bounded,output)
                } }
                var valid=false;var entries=0
                try {entries=BackupZipProof.inspect(file).size;valid=true}catch(_:Exception){}
                val bytes=file.readBytes();val signature=bytes.asList().windowed(4).any {it==listOf<Byte>(80,75,5,6)}
                observations.put(JSONObject().put("bytes",digest.size).put("sha256",digest.sha256).put("valid",valid).put("entries",entries).put("hasEocd",signature))
            }
        }
        val report=JSONObject().put("scope","authorized-synthetic-tree").put("matches",observations)
        File(root,"chrome-external-diagnostic.json").writeText(report.toString());report
    }
    @PluginMethod fun selectChromeExternalDiagnostic(call: PluginCall) {
        try {
            gate()
            if (call.getString("interaction") != "user-initiated" || owner.get() != null) throw BackupZipProof.Failure("CONFLICT")
            activity.runOnUiThread {
                try { startActivityForResult(call, Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE); type = "application/zip"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }, "chromeExternalSelected") } catch (e: Exception) { failed(call, e) }
            }
        } catch (e: Exception) { failed(call, e) }
    }
    @ActivityCallback private fun chromeExternalSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        io.execute {
            try {
                gate()
                val uri = result.data?.data
                if (result.resultCode != Activity.RESULT_OK || uri == null) throw BackupZipProof.Failure("CANCELLED")
                val name = context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
                    if (it.moveToFirst()) it.getString(0) else null
                }
                // The explicit read-only picker never opens arbitrary personal ZIP contents.
                if (name == null || !name.matches(Regex("minhaestante-synthetic-external-42b( \\([0-9]+\\))?\\.zip"))) throw BackupZipProof.Failure("INVALID_REFERENCE")
                val copy = File(root, "chrome-selected-${System.currentTimeMillis()}.zip")
                var count = 0L
                val observed = context.contentResolver.openInputStream(uri)!!.use { input -> copy.outputStream().use { output ->
                    val bounded = object : FilterInputStream(input) {
                        override fun read(b: ByteArray, off: Int, len: Int): Int {
                            val n = `in`.read(b, off, minOf(len.toLong(), 128 * 1024 - count + 1).toInt())
                            if (n > 0) count += n
                            if (count > 128 * 1024) throw BackupZipProof.Failure("LIMIT_EXCEEDED")
                            return n
                        }
                    }
                    IncrementalCopy.digest(bounded, output)
                } }
                var valid = false; var entries = 0
                try { entries = BackupZipProof.inspect(copy).size; valid = true } catch (_: Exception) { }
                val bytes = copy.readBytes()
                val report = JSONObject().put("scope", "user-selected-synthetic-document").put("bytes", observed.size).put("sha256", observed.sha256)
                    .put("valid", valid).put("entries", entries).put("hasEocd", bytes.asList().windowed(4).any { it == listOf<Byte>(80,75,5,6) })
                File(root, "chrome-selected-diagnostic.json").writeText(report.toString()); ok(call, report)
            } catch (e: Exception) { failed(call, e) }
        }
    }
    @PluginMethod fun setDiagnosticFault(call: PluginCall) = async(call) {
        val id=id(call); val mode=call.getString("mode")
        if(owner.get()!=id || mode !in setOf("write","finalize","verify")) throw BackupZipProof.Failure("INVALID_REFERENCE")
        faults[id]=mode!!; JSONObject()
    }
    @PluginMethod fun validateSources(call: PluginCall) = async(call) {
        val sources = call.getArray("sources") ?: JSONArray()
        for (i in 0 until sources.length()) openManaged(sources.getJSONObject(i)).use { }
        JSONObject().put("accessible", true)
    }
    @PluginMethod fun selectDestination(call: PluginCall) {
        var claimed: String? = null
        try {
            gate(); val id = id(call)
            if (call.getString("interaction") != "user-initiated") throw BackupZipProof.Failure("PERMISSION_REQUIRED")
            if (!owner.acquire(id)) throw BackupZipProof.Failure("CONFLICT")
            claimed = id
            selectedOperation = id
            cancelled[id] = AtomicBoolean(false); checkpoint(id, "selecting")
            activity.runOnUiThread {
                try { startActivityForResult(call, Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE); type = "application/zip"; putExtra(Intent.EXTRA_TITLE, "MinhaEstante_Backup_v2_${System.currentTimeMillis()}.zip")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                }, "destinationSelected") } catch(e: Exception) { owner.release(id); failed(call, e, id) }
            }
        } catch(e: Exception) { claimed?.let { owner.release(it); cancelled.remove(it) }; failed(call, e) }
    }
    @ActivityCallback private fun destinationSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val id = id(call); val uri = result.data?.data
        try {
            gate()
            if (owner.get() != id) throw BackupZipProof.Failure("CONFLICT")
            if (result.resultCode != Activity.RESULT_OK || uri == null) throw BackupZipProof.Failure("CANCELLED")
            checkpoint(id, "destination-selected", uri); check(id)
            try { context.contentResolver.takePersistableUriPermission(uri, (result.data!!.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))) } catch (_: SecurityException) { }
            ok(call)
        } catch(e: Exception) { owner.release(id); failed(call, e, id) }
    }
    @PluginMethod fun stageMetadata(call: PluginCall) = async(call) {
        val id = id(call); check(id)
        if (owner.get() != id || receipt(id).getString("stage") !in setOf("destination-selected", "preparing")) throw BackupZipProof.Failure("CONFLICT")
        val path = call.getString("archivePath") ?: throw BackupZipProof.Failure("INVALID_PATH")
        val text = call.getString("text"); val base64 = call.getString("base64")
        if ((text?.length ?: 0) > 1024 * 1024 || (base64?.length ?: 0) > 3 * 1024 * 1024) throw BackupZipProof.Failure("LIMIT_EXCEEDED")
        val bytes = if (text != null && path.endsWith(".json")) text.toByteArray() else if (base64 != null && path.startsWith("covers/")) Base64.decode(base64, Base64.DEFAULT)
            else throw BackupZipProof.Failure("INVALID_REFERENCE")
        // Capacitor getLong accepts only boxed Long; JSON bridge small integers are Integer.
        val expectedSize = call.data.opt("sizeBytes") as? Number ?: throw BackupZipProof.Failure("INVALID_REFERENCE")
        if (bytes.size > 2 * 1024 * 1024 || expectedSize.toDouble() != bytes.size.toDouble() || hash(bytes) != call.getString("sha256")) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
        val file = metadataFile(id, path)
        if (file.exists()) throw BackupZipProof.Failure("CONFLICT")
        file.outputStream().use { it.write(bytes) }; checkpoint(id, "preparing")
        JSONObject()
    }
    @PluginMethod fun write(call: PluginCall) = io.execute {
        var operation: String? = null
        try {
            gate(); val id = id(call); operation = id; check(id)
            if (owner.get() != id) throw BackupZipProof.Failure("CONFLICT")
            val manifestText = call.getString("manifest") ?: throw BackupZipProof.Failure("INVALID_MANIFEST")
            if (manifestText.toByteArray().size > 1024 * 1024) throw BackupZipProof.Failure("LIMIT_EXCEEDED")
            val manifest = JSONObject(manifestText)
            if (manifest.getInt("backupVersion") != 2 || manifest.getString("backupId") != id || manifest.getString("format") != "minhaestante-backup") throw BackupZipProof.Failure("INVALID_MANIFEST")
            val descriptors = call.getArray("sources") ?: throw BackupZipProof.Failure("INVALID_REFERENCE")
            var total = manifestText.toByteArray().size.toLong()
            val expected = mutableMapOf<String, Pair<Long, String>>()
            val sources = (0 until descriptors.length()).map { index ->
                val source = descriptors.getJSONObject(index); val path = source.getString("archivePath"); val size = source.getLong("sizeBytes"); val sha = source.getString("sha256")
                if (size < 0 || size > 104858276L || !sha.matches(Regex("[a-f0-9]{64}")) || expected.put(path, Pair(size,sha)) != null) throw BackupZipProof.Failure("INVALID_REFERENCE")
                total += size
                BackupZipProof.Source(path) {
                    check(id)
                    val input = if (source.has("storageReference")) openManaged(source) else metadataFile(id,path).inputStream()
                    val digest = MessageDigest.getInstance("SHA-256"); var count = 0L
                    val wrapper = object: FilterInputStream(input) {
                        override fun read(b: ByteArray, off: Int, len: Int): Int {
                            check(id); val n = `in`.read(b,off,len)
                            if (n > 0) { count += n; if (count > size) throw BackupZipProof.Failure("INTEGRITY_MISMATCH"); digest.update(b,off,n) }
                            if (n < 0 && (count != size || digest.digest().joinToString("") { "%02x".format(it) } != sha)) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
                            return n
                        }
                        override fun close() { streams.remove(id); super.close() }
                    }
                    streams[id] = wrapper; wrapper
                }
            }.toMutableList()
            if (total > MAX_BYTES || sources.size > 10000) throw BackupZipProof.Failure("LIMIT_EXCEEDED")
            if (StatFs(context.cacheDir.path).availableBytes < total + 1024 * 1024) throw BackupZipProof.Failure("INSUFFICIENT_SPACE")
            val manifestBytes = manifestText.toByteArray(); expected["manifest.json"] = Pair(manifestBytes.size.toLong(),hash(manifestBytes))
            sources.add(BackupZipProof.Source("manifest.json") { ByteArrayInputStream(manifestBytes) })
            val startedAt=System.nanoTime()
            checkpoint(id,"writing")
            val uri = Uri.parse(receipt(id).getString("destination"))
            val raw = context.contentResolver.openOutputStream(uri,"wt") ?: throw BackupZipProof.Failure("IO_FAILED")
            val writtenSha = MessageDigest.getInstance("SHA-256")
            var written=0L
            val output = object: FilterOutputStream(raw) {
                override fun write(b: ByteArray, off: Int, len: Int) { check(id); if(faults[id]=="write" && written>=1024)throw BackupZipProof.Failure("DESTINATION_WRITE");out.write(b,off,len); writtenSha.update(b,off,len);written+=len }
                override fun write(b: Int) { write(byteArrayOf(b.toByte()),0,1) }
            }
            var last = 0L
            val metrics = BackupZipProof.write(sources,output,stop={cancelled[id]?.get()==true},progress={ p ->
                if (p.phase == "before-finalize") {checkpoint(id,"finalizing");if(faults[id]=="finalize")throw BackupZipProof.Failure("DESTINATION_WRITE")}
                val now=System.nanoTime()
                if (now-last>100_000_000L || p.phase in setOf("before-finalize","finalize")) { last=now; notifyListeners("progress",JSObject().put("operationId",id).put("stage",if(p.phase in setOf("finalize","before-finalize"))"finalizing" else "transferring")
                    .put("filesProcessed",p.files).put("totalFiles",sources.size).put("bytesProcessed",p.inputBytes).put("totalBytes",total)
                    .put("currentPath",p.path).put("outputBytes",p.outputBytes).put("direction","export").put("cancellable",true)) }
            })
            checkpoint(id,"closed-unverified"); check(id)
            if(faults[id]=="verify")throw BackupZipProof.Failure("INTEGRITY")
            notifyListeners("progress",JSObject().put("operationId",id).put("stage","verifying").put("filesProcessed",0).put("totalFiles",sources.size)
                .put("bytesProcessed",0).put("totalBytes",JSONObject.NULL).put("outputBytes",metrics.outputBytes).put("currentPath",JSONObject.NULL)
                .put("direction","export").put("cancellable",true))
            val copy = File(operationRoot(id),"verified.zip")
            val observed = context.contentResolver.openInputStream(uri)!!.use { input ->
                streams[id] = input
                try { copy.outputStream().use { target -> BackupExportReadback.copy(input,target,metrics.outputBytes,stop={cancelled[id]?.get()==true}) } }
                finally { streams.remove(id) }
            }
            if (observed.size != metrics.outputBytes || observed.sha256 != writtenSha.digest().joinToString("") { "%02x".format(it) }) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
            checkpoint(id,"verifying")
            val entries = BackupZipProof.inspect(copy,stop={cancelled[id]?.get()==true})
            if (entries.size != expected.size || entries.any { expected[it.path] != Pair(it.size,it.sha256) }) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
            check(id); checkpoint(id,"verified-awaiting-snapshot")
            ok(call,JSONObject().put("status","verified").put("outputBytes",observed.size).put("zipSha256",observed.sha256)
                .put("durationMs",(System.nanoTime()-startedAt)/1000000).put("writeDurationMs",metrics.durationMs).put("destination","saf").put("entries",JSONArray(BackupZipProof.json(entries.filter { it.path!="manifest.json" }))))
        } catch(e: Exception) { failed(call,e,operation); operation?.let { owner.release(it) } }
        finally { operation?.let { faults.remove(it); streams.remove(it)?.let { input -> try { input.close() } catch(_:Exception){} } } }
    }
    @PluginMethod fun confirm(call: PluginCall) = async(call) {
        val id=id(call); check(id)
        if(owner.get()!=id || receipt(id).getString("stage")!="verified-awaiting-snapshot") throw BackupZipProof.Failure("CONFLICT")
        checkpoint(id,"completed"); owner.release(id); cancelled.remove(id); JSONObject()
    }
    @PluginMethod fun cancel(call: PluginCall) {
        try { gate(); val id=id(call)
            if(owner.get()!=id) throw BackupZipProof.Failure("CONFLICT")
            cancelled[id]?.set(true)
            try { streams.remove(id)?.close() } catch(_:Exception){}; ok(call)
        } catch(e:Exception){failed(call,e)}
    }
    @PluginMethod fun abandon(call: PluginCall) = async(call) {
        val id=id(call); val stage=receipt(id).getString("stage")
        if(stage!="cancelled" && stage!="completed") checkpoint(id,if(cancelled[id]?.get()==true) "cancelled" else "failed")
        owner.release(id); cancelled.remove(id); faults.remove(id); JSONObject()
    }
    @PluginMethod fun unfinished(call: PluginCall) = async(call) {
        val values=receipts.keys().mapNotNull { receipts.read(it)?.let { b -> JSONObject(String(b)) } }.filter { it.getString("stage")!="completed" }
        JSONObject().put("operations",JSONArray(values.map { JSONObject().put("operationId",it.getString("operationId")).put("stage",it.getString("stage")) }))
    }
    override fun handleOnDestroy() {
        val id = selectedOperation
        if (id != null && owner.get() == id) {
            cancelled[id]?.set(true)
            try { streams.remove(id)?.close() } catch (_: Exception) { }
            // Drain the writer before releasing process ownership; a replacement WebView cannot overlap it.
            io.execute {
                try { if (receipt(id).optString("stage") != "completed") checkpoint(id, "cancelled") } catch (_: Exception) { }
                owner.release(id); cancelled.remove(id); faults.remove(id)
            }
        }
        io.shutdown()
        super.handleOnDestroy()
    }
}
