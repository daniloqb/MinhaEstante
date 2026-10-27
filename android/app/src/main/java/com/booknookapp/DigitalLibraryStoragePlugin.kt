package com.booknookapp

import android.app.Activity
import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.DeadObjectException
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.util.Log
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.FileNotFoundException
import java.util.UUID
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.Executors
import com.getcapacitor.JSArray
import org.json.JSONObject
import java.io.FilterInputStream
import java.io.FilterOutputStream
import java.util.concurrent.ConcurrentHashMap

/** SAF metadata, grants, bounded native I/O and durable journal. No bibliographic rules. */
@CapacitorPlugin(name = "DigitalLibraryStorage")
class DigitalLibraryStoragePlugin : Plugin() {
    private val prefs by lazy { context.getSharedPreferences("digital_library_saf_v1", Context.MODE_PRIVATE) }
    private val resolver get() = context.contentResolver
    private val sessionSources = mutableMapOf<String, Uri>()
    @Volatile private var pickerPending = false
    private val development get() = BuildConfig.DEBUG && context.packageName == "com.booknookapp.dev"
    private val io = Executors.newFixedThreadPool(2)
    private data class DevFault(val mode: String, val after: Long)
    private val devFaults=ConcurrentHashMap<String,DevFault>()
    private val currentFault=ThreadLocal<DevFault?>()
    private val storage by lazy { DigitalStorageEngine(ImportJournal(AndroidMetadataFiles(File(context.filesDir,"digital-storage-v1"))), backend, ::code,
        checkpoint = { point -> if(development && currentFault.get()?.mode==point)throw StorageFailure("RECOVERY_REQUIRED") }) }

    private class SafError(val code: String) : Exception(code)
    private fun obj(vararg pairs: Pair<String, Any?>): JSObject = JSObject().apply {
        pairs.forEach { (key, value) -> if (value != null) put(key, value) }
    }
    private fun fail(code: String): JSObject = if (code == "USER_CANCELLED" || code == "OPERATION_CANCELLED") obj("status" to "cancelled", "code" to code)
        else obj("status" to "error", "error" to obj("code" to code, "messageKey" to "digitalStorage.errors.$code"))
    private fun code(error: Exception): String {
        var cause: Throwable?=error
        while(cause!=null){if(cause is android.system.ErrnoException && cause.errno==android.system.OsConstants.ENOSPC)return "INSUFFICIENT_SPACE";cause=cause.cause}
        return when (error) {
        is StorageFailure -> error.code
        is SafError -> error.code
        is SecurityException -> "PERMISSION_DENIED"
        is FileNotFoundException -> "FILE_NOT_FOUND"
        is DeadObjectException -> "PROVIDER_UNAVAILABLE"
        is android.content.ActivityNotFoundException -> "PROVIDER_UNAVAILABLE"
        else -> "FILE_UNAVAILABLE"
        }
    }
    private fun event(value: String) { if (development) Log.i("MinhaEstanteSAF", value) }
    private fun answer(call: PluginCall, work: () -> JSObject) {
        try { call.resolve(obj("status" to "success", "value" to work())); event("SUCCESS_${call.methodName}") }
        catch (error: Exception) { val safeCode = code(error); call.resolve(fail(safeCode)); event(safeCode) }
    }
    private fun asyncAnswer(call: PluginCall, work: ()->JSObject) { io.execute {
        currentFault.set(if(development)call.getString("operationId")?.let{devFaults[it]}else null)
        try{answer(call,work)}finally{currentFault.remove()}
    } }
    private fun requireInteraction(call: PluginCall) {
        if (call.getString("interaction") != "user-initiated") throw SafError("PERMISSION_REQUIRED")
    }
    private fun record(kind: String, token: String): Uri {
        // Tokens, not URIs, are the only inputs accepted by the bridge.
        if (!token.matches(Regex("[a-f0-9-]{36}"))) throw SafError("INVALID_REFERENCE")
        val raw = prefs.getString("$kind.$token", null)
        return raw?.let { Uri.parse(it) } ?: if (kind == "source") sessionSources[token]
            ?: throw SafError("INVALID_REFERENCE") else throw SafError("INVALID_REFERENCE")
    }
    private fun persist(uri: Uri, flags: Int) {
        val modes = SafPolicy.persistableModes(flags)
        if (modes != 0) {
            try { resolver.takePersistableUriPermission(uri, modes) }
            catch (_: SecurityException) { event("PERSISTENCE_NOT_GRANTED") }
        }
    }
    private fun grants(uri: Uri): Pair<Boolean, Boolean> {
        val grants = resolver.persistedUriPermissions.filter { it.uri == uri }
        return Pair(grants.any { it.isReadPermission }, grants.any { it.isWritePermission })
    }
    private fun ensureProvider(uri: Uri) {
        if (uri.scheme != "content" || uri.authority == null) throw SafError("INVALID_REFERENCE")
        // Resolve through ContentResolver: package-visibility filtering is not proof
        // that a granted document provider is absent.
        val client = resolver.acquireUnstableContentProviderClient(uri) ?: throw SafError("PROVIDER_UNAVAILABLE")
        client.close()
    }
    private fun treeDocument(uri: Uri): Uri {
        if (!DocumentsContract.isTreeUri(uri)) throw SafError("INVALID_REFERENCE")
        return DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
    }
    private fun folderFlags(uri: Uri): Int {
        ensureProvider(uri)
        resolver.query(treeDocument(uri), arrayOf(DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_FLAGS), null, null, null)?.use { cursor ->
            if (!cursor.moveToFirst()) throw SafError("FILE_NOT_FOUND")
            if (cursor.getString(0) != DocumentsContract.Document.MIME_TYPE_DIR) throw SafError("INVALID_REFERENCE")
            return cursor.getInt(1)
        }
        // A null cursor alone does not prove that the provider is unavailable.
        throw SafError("FILE_UNAVAILABLE")
    }
    private fun configuration(): JSObject {
        val token = prefs.getString("active", null)
            ?: return obj("configuration" to obj("state" to "not-configured"), "state" to "not-configured",
                "read" to false, "write" to false, "persistedRead" to false, "persistedWrite" to false,
                "canCreate" to false, "needsReconfiguration" to true)
        val uri = record("tree", token)
        val (read, write) = grants(uri)
        var canCreate = false
        var state: String
        var permission = "revoked"
        if (!read) {
            state = if (prefs.getBoolean("treeHadRead.$token", false)) "permission-revoked" else "permission-required"
            permission = if (state == "permission-revoked") "revoked" else "unknown"
        }
        else {
            try {
                canCreate = folderFlags(uri) and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE != 0
                state = SafPolicy.folderState(read, write, canCreate)
                permission = if (state == "accessible") "granted" else "denied"
            } catch (error: Exception) {
                state = when (code(error)) {
                    "FILE_NOT_FOUND" -> "missing"
                    "PERMISSION_DENIED" -> "permission-denied"
                    "PROVIDER_UNAVAILABLE" -> "provider-unavailable"
                    else -> "unavailable"
                }
                permission = if (state == "permission-denied") "denied" else "unknown"
            }
        }
        return obj("configuration" to obj("state" to "configured", "permission" to permission,
            "location" to obj("kind" to "library-location", "storageProvider" to "saf_document", "locationReference" to token)),
            "state" to state, "read" to (read && state in setOf("accessible", "read-only")),
            "write" to (write && canCreate && state == "accessible"), "persistedRead" to read,
            "persistedWrite" to write, "canCreate" to canCreate, "needsReconfiguration" to (state != "accessible"))
    }

    @PluginMethod
    fun getDevelopmentEnvironment(call: PluginCall) = answer(call) { obj("enabled" to development) }

    @PluginMethod
    fun getConfiguration(call: PluginCall) = answer(call) { configuration() }

    private fun launch(call: PluginCall, intent: Intent, callback: String) {
        try {
            requireInteraction(call)
            if (pickerPending) throw SafError("OPERATION_CONFLICT")
            pickerPending = true
            activity.runOnUiThread {
                try { startActivityForResult(call, intent, callback) }
                catch (error: Exception) { pickerPending = false; call.resolve(fail(code(error))) }
            }
        } catch (error: Exception) { call.resolve(fail(code(error))) }
    }

    @PluginMethod
    fun selectDirectory(call: PluginCall) {
        try {
            val diagnosticOperation=call.getString("diagnosticOperationId")
            if(diagnosticOperation!=null && !development)throw StorageFailure("UNSUPPORTED_OPERATION")
            val tree=diagnosticOperation?.let{storage.operation(it).spec.tree} ?: prefs.getString("active",null)
            launch(call, Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
                if(tree!=null)putExtra(DocumentsContract.EXTRA_INITIAL_URI,treeDocument(record("tree",tree)))
            }, "directoryResult")
        } catch(error:Exception){call.resolve(fail(code(error)))}
    }

    @ActivityCallback
    private fun directoryResult(call: PluginCall?, result: ActivityResult) {
        pickerPending = false
        if (call == null) { event("RESTORED_CALL_UNAVAILABLE"); return }
        val data = result.data
        val uri = data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(fail("USER_CANCELLED")); return }
        answer(call) {
            ensureProvider(uri)
            treeDocument(uri)
            persist(uri, data.flags)
            // Retain previous references/grants. Selection never moves or deletes contents.
            val existing = prefs.all.entries.firstOrNull { it.key.startsWith("tree.") && it.value == uri.toString() }
            val token = existing?.key?.removePrefix("tree.") ?: UUID.randomUUID().toString()
            val hadRead = prefs.getBoolean("treeHadRead.$token", false) || grants(uri).first
            if (!prefs.edit().putString("tree.$token", uri.toString()).putBoolean("treeHadRead.$token", hadRead)
                    .putString("active", token).commit()) throw SafError("OPERATION_FAILED")
            configuration()
        }
    }

    @PluginMethod
    fun selectDocument(call: PluginCall) {
        try { acceptedFormats(call) }
        catch (error: Exception) { call.resolve(fail(code(error))); return }
        // Broad MIME intentionally: providers often label EPUB/M4B as octet-stream.
        // Validate the extension after selection; content validation belongs to 2.2B.
        launch(call, Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }, "documentResult")
    }

    private fun acceptedFormats(call: PluginCall): Set<String> {
        val values = call.getArray("acceptedFormats") ?: throw SafError("UNSUPPORTED_FORMAT")
        if (values.length() == 0) throw SafError("UNSUPPORTED_FORMAT")
        return (0 until values.length()).map {
            (values.opt(it) as? String)?.takeIf { format -> format in SafPolicy.formats }
                ?: throw SafError("UNSUPPORTED_FORMAT")
        }.toSet()
    }

    private fun selected(token: String, uri: Uri): JSObject {
        ensureProvider(uri)
        val tree=prefs.getString("sourceTree.$token",null)
        val persisted = grants(uri).first || (tree?.let{grants(record("tree",it)).first}==true)
        if (!persisted && context.checkUriPermission(uri, android.os.Process.myPid(), android.os.Process.myUid(),
                Intent.FLAG_GRANT_READ_URI_PERMISSION) != PackageManager.PERMISSION_GRANTED) throw SafError("PERMISSION_REVOKED")
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (!cursor.moveToFirst()) sourceMetadataUnavailable(uri)
            val name = cursor.getString(0) ?: throw SafError("INVALID_FILE")
            if (name.isBlank() || name.any { it == '/' || it == '\\' || it == '\r' || it == '\n' || it == '\u0000' }) throw SafError("INVALID_FILE")
            if (SafPolicy.format(name) == null) throw SafError("UNSUPPORTED_FORMAT")
            val size = if (cursor.isNull(1)) null else cursor.getLong(1).takeIf { it >= 0 && it <= 9007199254740991L }
            val mime = resolver.getType(uri)?.takeIf { it.matches(Regex("[\\w.+-]+/[\\w.+-]+")) }
            return obj("state" to "selected", "source" to obj("kind" to "source", "storageProvider" to "saf_document",
                "sourceReference" to token), "filename" to name, "sizeBytes" to size, "mimeType" to mime,
                "access" to if (persisted) "persistent" else "session")
        }
        sourceMetadataUnavailable(uri)
    }

    private fun sourceMetadataUnavailable(uri: Uri): Nothing {
        // Downloads providers can return a null/empty metadata cursor after deletion.
        // Opening a descriptor distinguishes a missing source from unavailable metadata,
        // without reading media bytes. Preserve SecurityException/provider failures too.
        resolver.openFileDescriptor(uri, "r")?.use { /* descriptor only */ }
        throw SafError("FILE_UNAVAILABLE")
    }

    @ActivityCallback
    private fun documentResult(call: PluginCall?, result: ActivityResult) {
        pickerPending = false
        if (call == null) { event("RESTORED_CALL_UNAVAILABLE"); return }
        val data = result.data
        val uri = data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(fail("USER_CANCELLED")); return }
        answer(call) {
            ensureProvider(uri)
            persist(uri, data.flags)
            val token = UUID.randomUUID().toString()
            val metadata = selected(token, uri)
            val accepted = acceptedFormats(call)
            if (SafPolicy.format(metadata.getString("filename") ?: throw SafError("INVALID_FILE")) !in accepted) throw SafError("UNSUPPORTED_FORMAT")
            if (grants(uri).first) {
                if (!prefs.edit().putString("source.$token", uri.toString()).commit()) throw SafError("OPERATION_FAILED")
            } else sessionSources[token] = uri
            metadata
        }
    }

    @PluginMethod
    fun getSelectedMetadata(call: PluginCall) = answer(call) {
        val token = call.getString("sourceReference") ?: throw SafError("INVALID_REFERENCE")
        selected(token, record("source", token))
    }

    @PluginMethod
    fun checkSourceAccess(call: PluginCall) = answer(call) {
        val token = call.getString("sourceReference") ?: throw SafError("INVALID_REFERENCE")
        val uri = record("source", token)
        selected(token, uri)
        resolver.openFileDescriptor(uri, "r")?.use { return@answer obj("accessible" to true) }
        throw SafError("FILE_UNAVAILABLE")
    }

    @PluginMethod
    fun runDiagnostics(call: PluginCall) = answer(call) {
        if (!development) throw SafError("UNSUPPORTED_OPERATION")
        requireInteraction(call)
        val status = configuration()
        if (status.getString("state") != "accessible") throw SafError(when (status.getString("state")) {
            "not-configured" -> "NOT_CONFIGURED"
            "permission-revoked" -> "PERMISSION_REVOKED"
            "permission-required" -> "PERMISSION_REQUIRED"
            "read-only", "permission-denied" -> "PERMISSION_DENIED"
            "missing" -> "FILE_NOT_FOUND"
            "provider-unavailable" -> "PROVIDER_UNAVAILABLE"
            else -> "FILE_UNAVAILABLE"
        })
        val tree = record("tree", prefs.getString("active", null) ?: throw SafError("NOT_CONFIGURED"))
        var temporary: Uri? = null
        var write = false
        var read = false
        var cleaned = true
        var failure: String? = null
        try {
            temporary = DocumentsContract.createDocument(resolver, treeDocument(tree), "application/octet-stream",
                "minhaestante-diagnostic-${UUID.randomUUID()}.tmp") ?: throw SafError("FILE_UNAVAILABLE")
            val bytes = "MinhaEstante SAF diagnostic v1".toByteArray(Charsets.UTF_8)
            resolver.openOutputStream(temporary, "w")?.use { it.write(bytes); it.flush(); write = true }
            resolver.openInputStream(temporary)?.use { stream ->
                val buffer = ByteArray(bytes.size + 1)
                var count = 0
                while (count < buffer.size) {
                    val n = stream.read(buffer, count, buffer.size - count)
                    if (n < 0) break
                    count += n
                }
                read = count == bytes.size && buffer.copyOf(count).contentEquals(bytes)
            }
            if (!write || !read) throw SafError("FILE_UNAVAILABLE")
        } catch (error: Exception) { failure = code(error) }
        finally {
            temporary?.let { created ->
                cleaned = try { DocumentsContract.deleteDocument(resolver, created) } catch (_: Exception) { false }
            }
        }
        obj("writeVerified" to write, "readVerified" to read, "cleanupSucceeded" to cleaned,
            "errorCode" to failure, "cleanupError" to if (!cleaned) "DIAGNOSTIC_CLEANUP_FAILED" else null)
    }

    private val backend = object: DigitalStorageBackend {
        override fun assertTree(tree: String, write: Boolean) {
            if(write && currentFault.get()?.mode=="destination-unavailable")throw StorageFailure("PROVIDER_UNAVAILABLE")
            if(write && currentFault.get()?.mode=="permission-revoked")throw StorageFailure("PERMISSION_REVOKED")
            val uri=record("tree",tree);val grant=grants(uri)
            if(!grant.first)throw StorageFailure("PERMISSION_REVOKED")
            if(write && !grant.second)throw StorageFailure("PERMISSION_DENIED")
            val flags=folderFlags(uri)
            if(write && flags and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE==0)throw StorageFailure("PERMISSION_DENIED")
        }
        override fun source(spec: ImportSpec): InputStream {
            val uri=record("source",spec.source);selected(spec.source,uri)
            val input=resolver.openInputStream(uri) ?: throw StorageFailure("FILE_UNAVAILABLE")
            val fault=currentFault.get()
            if(fault?.mode!="read-failure")return input
            return object: FilterInputStream(input){ var count=0L
                override fun read(b:ByteArray,off:Int,len:Int):Int {val n=`in`.read(b,off,len);if(n>0)count+=n;if(count>=fault.after)throw StorageFailure("FILE_UNAVAILABLE");return n}
            }
        }
        @Synchronized override fun parent(tree: String, category: String): String {
            assertTree(tree,true)
            val treeUri=record("tree",tree);val root=treeDocument(treeUri)
            val name=when(category){"ebook"->"ebooks";"audiobook"->"audiobooks";else->throw StorageFailure("UNSUPPORTED_FORMAT")}
            val children=DocumentsContract.buildChildDocumentsUriUsingTree(treeUri,DocumentsContract.getDocumentId(root))
            val matches=mutableListOf<String>()
            val directories=resolver.query(children,arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE),null,null,null) ?: throw StorageFailure("RECOVERY_REQUIRED")
            directories.use{cursor->
                if(cursor.extras.getBoolean(DocumentsContract.EXTRA_LOADING,false))throw StorageFailure("RECOVERY_REQUIRED")
                while(cursor.moveToNext())if(cursor.getString(1)==name && cursor.getString(2)==DocumentsContract.Document.MIME_TYPE_DIR)
                    matches.add(DocumentsContract.buildDocumentUriUsingTree(treeUri,cursor.getString(0)).toString())
            }
            if(matches.size>1)throw StorageFailure("RECOVERY_REQUIRED")
            if(matches.size==1)return matches.single()
            return (DocumentsContract.createDocument(resolver,root,DocumentsContract.Document.MIME_TYPE_DIR,name)
                ?: throw StorageFailure("FILE_UNAVAILABLE")).toString()
        }
        override fun create(tree: String, parent: String, filename: String, mime: String): String {
            assertTree(tree,true)
            return (DocumentsContract.createDocument(resolver,Uri.parse(parent),mime,filename)
                ?: throw StorageFailure("FILE_UNAVAILABLE")).toString()
        }
        override fun findCreated(record: ImportRecord): List<String> {
            assertTree(record.spec.tree,false)
            val treeUri=this@DigitalLibraryStoragePlugin.record("tree",record.spec.tree)
            val root=treeDocument(treeUri)
            val parent=Uri.parse(record.parent)
            // The parent must still be a direct managed category directory of the authorized root.
            val category=when(record.spec.category){"ebook"->"ebooks";"audiobook"->"audiobooks";else->throw StorageFailure("RECOVERY_REQUIRED")}
            val rootChildren=DocumentsContract.buildChildDocumentsUriUsingTree(treeUri,DocumentsContract.getDocumentId(root))
            var matchingParents=0
            var authorizedParent=false
            val columns=arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE)
            val directories=resolver.query(rootChildren,columns,null,null,null) ?: throw StorageFailure("RECOVERY_REQUIRED")
            directories.use { cursor ->
                if(cursor.extras.getBoolean(DocumentsContract.EXTRA_LOADING,false))throw StorageFailure("RECOVERY_REQUIRED")
                while(cursor.moveToNext())if(cursor.getString(1)==category && cursor.getString(2)==DocumentsContract.Document.MIME_TYPE_DIR){
                    matchingParents++
                    if(DocumentsContract.buildDocumentUriUsingTree(treeUri,cursor.getString(0))==parent)authorizedParent=true
                }
            }
            if(!authorizedParent || matchingParents!=1)throw StorageFailure("RECOVERY_REQUIRED")
            val children=DocumentsContract.buildChildDocumentsUriUsingTree(treeUri,DocumentsContract.getDocumentId(parent))
            val candidates=mutableListOf<String>()
            val documents=resolver.query(children,columns,null,null,null) ?: throw StorageFailure("RECOVERY_REQUIRED")
            documents.use { cursor ->
                if(cursor.extras.getBoolean(DocumentsContract.EXTRA_LOADING,false))throw StorageFailure("RECOVERY_REQUIRED")
                while(cursor.moveToNext())if(cursor.getString(1)=="${record.token}.${record.spec.format}" && cursor.getString(2)==canonicalMime(record.spec.format))
                    candidates.add(DocumentsContract.buildDocumentUriUsingTree(treeUri,cursor.getString(0)).toString())
            }
            return candidates
        }
        override fun read(tree: String, uri: String): InputStream {
            assertTree(tree,false)
            val input=resolver.openInputStream(Uri.parse(uri)) ?: throw StorageFailure("FILE_UNAVAILABLE")
            if(currentFault.get()?.mode!="corrupt-destination-read")return input
            return object:FilterInputStream(input){var changed=false
                override fun read(b:ByteArray,off:Int,len:Int):Int{val n=`in`.read(b,off,len);if(n>0&&!changed){b[off]=(b[off].toInt() xor 1).toByte();changed=true};return n}
            }
        }
        override fun write(tree: String, uri: String): OutputStream {
            assertTree(tree,true)
            val output=resolver.openOutputStream(Uri.parse(uri),"wt") ?: throw StorageFailure("FILE_UNAVAILABLE")
            val fault=currentFault.get() ?: return output
            return object:FilterOutputStream(output){var count=0L
                override fun write(b:ByteArray,off:Int,len:Int){
                    out.write(b,off,len);count+=len
                    if(fault.mode=="slow-copy")Thread.sleep(8)
                    if(count>=fault.after && fault.mode in setOf("write-failure","no-space"))
                        throw StorageFailure(if(fault.mode=="no-space")"INSUFFICIENT_SPACE"else"FILE_UNAVAILABLE")
                }
            }
        }
        override fun delete(tree: String, uri: String) {
            assertTree(tree,true)
            if(!DocumentsContract.deleteDocument(resolver,Uri.parse(uri)))throw StorageFailure("FILE_UNAVAILABLE")
        }
    }
    private fun string(call: PluginCall, key: String): String = call.getString(key)?.takeIf{it.isNotBlank()}
        ?: throw StorageFailure("INVALID_REFERENCE")
    private fun stored(r: ImportRecord): JSObject = obj("state" to "stored", "operationId" to r.spec.operationId,
        "file" to obj("kind" to "managed","storageProvider" to "saf_document","storageReference" to r.token),
        "metadata" to obj("filename" to r.spec.filename,"mimeType" to r.spec.mime.takeIf{it.isNotEmpty()},"sizeBytes" to r.size,"format" to r.spec.format),
        "integrity" to obj("sizeBytes" to r.size,"checksum" to obj("algorithm" to "sha256","value" to r.hash)))
    private fun snapshot(r: ImportRecord): JSObject = obj("operationId" to r.spec.operationId,"state" to r.stage,
        "format" to r.spec.format,"type" to r.spec.category,"bytesProcessed" to r.size,
        "createdAt" to r.createdAt,"updatedAt" to r.updatedAt,"errorCode" to r.error.takeIf{it.isNotEmpty()},
        "stored" to if(r.stage in setOf("FILE_READY","LINKING","COMPLETED"))stored(r) else null,
        "linkContext" to r.link.takeIf{it.isNotEmpty()}?.let{JSONObject(it)})
    private fun report(id: String, stage: String, bytes: Long, total: Long?) {
        notifyListeners("importProgress",obj("operationId" to id,"stage" to stage,"bytesProcessed" to bytes,"totalBytes" to total))
    }

    @PluginMethod
    fun importFile(call: PluginCall) = asyncAnswer(call) {
        val id=string(call,"operationId");val source=string(call,"sourceReference")
        val format=string(call,"format");val type=string(call,"type")
        if((type=="ebook" && format !in setOf("epub","pdf")) ||
            (type=="audiobook" && format !in setOf("mp3","m4a","m4b")) || type !in setOf("ebook","audiobook"))throw StorageFailure("UNSUPPORTED_FORMAT")
        storage.lookup(id)?.let{ prior ->
            if(prior.spec.source!=source || prior.spec.format!=format || prior.spec.category!=type)throw StorageFailure("OPERATION_CONFLICT")
            if(prior.stage in setOf("FILE_READY","LINKING","COMPLETED"))return@asyncAnswer stored(storage.import(prior.spec))
        }
        val metadata=selected(source,record("source",source))
        val name=metadata.getString("filename") ?: throw StorageFailure("INVALID_FILE")
        if(SafPolicy.format(name)!=format)throw StorageFailure("UNSUPPORTED_FORMAT")
        val size=if(metadata.has("sizeBytes") && currentFault.get()?.mode!="unknown-size")metadata.getLong("sizeBytes")else null
        if(size==0L)throw StorageFailure("INVALID_FILE")
        val tree=prefs.getString("active",null) ?: throw StorageFailure("NOT_CONFIGURED")
        val spec=ImportSpec(id,source,tree,name,metadata.getString("mimeType")?:"",size,format,type)
        stored(storage.import(spec){stage,bytes,total->report(id,stage,bytes,total)})
    }
    @PluginMethod
    fun getManagedMetadata(call: PluginCall) = asyncAnswer(call) {
        val r=storage.metadata(string(call,"storageReference"));val result=stored(r)
        obj("file" to result.getJSObject("file"),"metadata" to result.getJSObject("metadata"))
    }
    @PluginMethod
    fun checkManagedAccess(call: PluginCall) = asyncAnswer(call) {
        storage.metadata(string(call,"storageReference"));obj("accessible" to true)
    }
    @PluginMethod
    fun verifyManagedFile(call: PluginCall) = asyncAnswer(call) {
        val digest=storage.verify(string(call,"storageReference"),string(call,"verificationId"))
        obj("sizeBytes" to digest.size,"checksum" to obj("algorithm" to "sha256","value" to digest.sha256))
    }
    @PluginMethod
    fun cancelOperation(call: PluginCall) = answer(call) {storage.cancel(string(call,"operationId"));obj("done" to true)}
    @PluginMethod
    fun listOperations(call: PluginCall) = asyncAnswer(call) {obj("operations" to JSArray(storage.all().map(::snapshot)))}
    @PluginMethod
    fun getOperation(call: PluginCall) = asyncAnswer(call) {snapshot(storage.operation(string(call,"operationId")))}
    @PluginMethod
    fun recoverImport(call: PluginCall) = asyncAnswer(call) {
        val id=string(call,"operationId")
        stored(storage.recover(id){stage,bytes,total->report(id,stage,bytes,total)})
    }
    @PluginMethod
    fun beginAttachmentLink(call: PluginCall) = asyncAnswer(call) {
        val context=call.getObject("linkContext") ?: throw StorageFailure("INVALID_FILE")
        val canonical=JSONObject(context.keys().asSequence().toList().sorted().associateWith{context.get(it)})
        snapshot(storage.beginLink(string(call,"operationId"),canonical.toString()))
    }
    @PluginMethod
    fun completeImportOperation(call: PluginCall) = asyncAnswer(call) {storage.complete(string(call,"operationId"));obj("done" to true)}
    @PluginMethod
    fun discardIncompleteImport(call: PluginCall) = asyncAnswer(call) {storage.discard(string(call,"operationId"));obj("done" to true)}
    @PluginMethod
    fun deleteManagedFile(call: PluginCall) = asyncAnswer(call) {
        if(call.getString("intent")!="delete-managed-file")throw StorageFailure("UNSUPPORTED_OPERATION")
        storage.delete(string(call,"storageReference"));obj("done" to true)
    }

    @PluginMethod
    fun setDiagnosticFault(call: PluginCall) = answer(call) {
        if(!development)throw StorageFailure("UNSUPPORTED_OPERATION")
        requireInteraction(call)
        val id=string(call,"operationId");if(!id.startsWith("dev-"))throw StorageFailure("INVALID_REFERENCE")
        val mode=string(call,"mode")
        if(mode=="none")devFaults.remove(id) else {
            if(mode !in setOf("before-intent","after-create-before-uri","after-copy","before-ready","slow-copy","read-failure","write-failure","no-space","corrupt-destination-read","unknown-size","permission-revoked","destination-unavailable"))throw StorageFailure("INVALID_FILE")
            // PluginCall.getLong accepts only Java Long; JSON small integers arrive as Integer.
            val raw=call.data.opt("afterBytes")
            val after=if(raw==null || raw==JSONObject.NULL)65536L else {
                if(raw !is Number || !raw.toDouble().isFinite() || raw.toDouble()%1.0!=0.0 || raw.toDouble()>Long.MAX_VALUE.toDouble())throw StorageFailure("INVALID_FILE")
                raw.toLong()
            }
            if(after<0)throw StorageFailure("INVALID_FILE")
            devFaults[id]=DevFault(mode,after)
        }
        obj("done" to true)
    }
    /** Actual Android grant release, never a simulated error; isolated DEV and explicit manual flow only. */
    @PluginMethod
    fun revokeDiagnosticDirectoryGrant(call: PluginCall) = answer(call) {
        if(!development)throw StorageFailure("UNSUPPORTED_OPERATION")
        requireInteraction(call)
        if(call.getString("intent")!="revoke-dev-directory-grant")throw StorageFailure("UNSUPPORTED_OPERATION")
        val token=prefs.getString("active",null) ?: throw StorageFailure("NOT_CONFIGURED")
        val uri=record("tree",token);val (read,write)=grants(uri)
        val modes=(if(read)Intent.FLAG_GRANT_READ_URI_PERMISSION else 0) or (if(write)Intent.FLAG_GRANT_WRITE_URI_PERMISSION else 0)
        if(modes!=0)resolver.releasePersistableUriPermission(uri,modes)
        configuration()
    }
    @PluginMethod
    fun getDiagnosticRetention(call: PluginCall) = asyncAnswer(call) {
        if(!development)throw StorageFailure("UNSUPPORTED_OPERATION")
        val records=storage.all()
        val known=records.filter{it.uri.isNotEmpty()}.distinctBy{it.uri}
        var bytes=0L;var inaccessible=0
        known.forEach { r ->
            try {
                backend.assertTree(r.spec.tree,false)
                val cursor=resolver.query(Uri.parse(r.uri),arrayOf(OpenableColumns.SIZE),null,null,null)
                cursor?.use { if(it.moveToFirst()&&!it.isNull(0))bytes+=it.getLong(0) else inaccessible++ } ?: run {inaccessible++}
            } catch(_:Exception){inaccessible++}
        }
        obj("journalRecords" to records.size,"knownDocuments" to known.size,"readableBytes" to bytes,
            "inaccessibleOrUnknownSize" to inaccessible,"protectedReceipts" to records.count{it.link.isNotEmpty()},
            "physicalDeletionAuthorized" to false)
    }
    @PluginMethod
    fun getDiagnosticMemory(call: PluginCall) = answer(call) {
        if(!development)throw StorageFailure("UNSUPPORTED_OPERATION")
        val memory=android.os.Debug.MemoryInfo();android.os.Debug.getMemoryInfo(memory)
        val runtime=Runtime.getRuntime()
        obj("totalPssKiB" to memory.totalPss,"javaHeapUsedBytes" to runtime.totalMemory()-runtime.freeMemory())
    }
    @PluginMethod
    fun createDiagnosticSources(call: PluginCall) = asyncAnswer(call) {
        if(!development)throw StorageFailure("UNSUPPORTED_OPERATION")
        requireInteraction(call)
        if(call.getString("intent")!="create-synthetic-fixtures-in-dev-library")throw StorageFailure("UNSUPPORTED_OPERATION")
        val large=call.getBoolean("includeLarge",false) ?: false
        if(android.os.StatFs(context.filesDir.path).availableBytes < (if(large)400L*1024*1024 else 10L*1024*1024))throw StorageFailure("INSUFFICIENT_SPACE")
        val tree=prefs.getString("active",null) ?: throw StorageFailure("NOT_CONFIGURED")
        backend.assertTree(tree,true)
        val temporary=File(context.cacheDir,"saf-test-${UUID.randomUUID()}")
        try {
            val sources=DigitalStorageDevFixtures.generate(temporary,large,call.getString("variant")=="different")
            val parent=DocumentsContract.createDocument(resolver,treeDocument(record("tree",tree)),DocumentsContract.Document.MIME_TYPE_DIR,
                "minhaestante-dev-sources-${UUID.randomUUID()}") ?: throw StorageFailure("FILE_UNAVAILABLE")
            val fixtures=sources.map{file->
                val format=SafPolicy.format(file.name) ?: throw StorageFailure("UNSUPPORTED_FORMAT")
                val uri=DocumentsContract.createDocument(resolver,parent,canonicalMime(format),file.name) ?: throw StorageFailure("FILE_UNAVAILABLE")
                val copied=file.inputStream().use{input->resolver.openOutputStream(uri,"wt")?.use{output->IncrementalCopy.digest(input,output)} ?: throw StorageFailure("FILE_UNAVAILABLE")}
                val token=UUID.randomUUID().toString()
                // Tree grant authorizes these synthetic sources; persist provenance in the existing registry.
                if(!prefs.edit().putString("source.$token",uri.toString()).putString("sourceTree.$token",tree).commit())throw StorageFailure("OPERATION_FAILED")
                obj("selected" to selected(token,uri),"expectedIntegrity" to obj("sizeBytes" to copied.size,"checksum" to obj("algorithm" to "sha256","value" to copied.sha256)),
                    "fixture" to when{file.name.startsWith("invalid")->"invalid";file.name.startsWith("wrong")->"wrong-extension";file.name.contains("large")->"large";else->"valid"})
            }
            obj("sources" to JSArray(fixtures))
        } finally { temporary.deleteRecursively() } // only this invocation's private, synthetic cache
    }

    override fun saveInstanceState(): Bundle = (super.saveInstanceState() ?: Bundle()).apply { putBoolean("safPickerPending", pickerPending) }
    override fun restoreState(state: Bundle) { super.restoreState(state); pickerPending = state.getBoolean("safPickerPending", false) }
}
