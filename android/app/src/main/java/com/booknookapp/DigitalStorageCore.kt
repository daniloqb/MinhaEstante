package com.booknookapp

import java.io.*
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock

internal class StorageFailure(val code: String) : IOException(code)
internal data class ImportSpec(val operationId: String, val source: String, val tree: String,
    val filename: String, val mime: String, val declaredSize: Long?, val format: String, val category: String)
internal data class ImportRecord(val spec: ImportSpec, val token: String = UUID.randomUUID().toString(),
    var stage: String = "PREPARING", var parent: String = "", var uri: String = "",
    var size: Long = 0, var hash: String = "", var error: String = "", var link: String = "",
    val createdAt: Long = System.currentTimeMillis(), var updatedAt: Long = createdAt,
    var expectedSize: Long = 0, var expectedHash: String = "")
internal data class CopyDigest(val size: Long, val sha256: String, val tail: ByteArray)
internal interface MetadataFiles {
    fun read(key: String): ByteArray?
    fun write(key: String, bytes: ByteArray)
    fun keys(): List<String>
}

/** Versioned, bounded technical metadata. Media bytes never enter this codec. */
internal class ImportJournal(private val files: MetadataFiles) {
    private fun key(id: String) = MessageDigest.getInstance("SHA-256").digest(id.toByteArray()).joinToString("") { "%02x".format(it) }
    @Synchronized fun read(id: String): ImportRecord? = files.read(key(id))?.let { decode(it) }
    @Synchronized fun all(): List<ImportRecord> = files.keys().mapNotNull { files.read(it)?.let(::decode) }
    @Synchronized fun save(r: ImportRecord) {
        r.updatedAt = System.currentTimeMillis()
        val out = ByteArrayOutputStream()
        DataOutputStream(out).use { d ->
            d.writeInt(2)
            listOf(r.spec.operationId, r.spec.source, r.spec.tree, r.spec.filename, r.spec.mime,
                r.spec.format, r.spec.category, r.token, r.stage, r.parent, r.uri, r.hash, r.error, r.link).forEach {
                if (it.toByteArray(Charsets.UTF_8).size > 16000) throw StorageFailure("INVALID_FILE")
                d.writeUTF(it)
            }
            d.writeLong(r.spec.declaredSize ?: -1); d.writeLong(r.size); d.writeLong(r.createdAt); d.writeLong(r.updatedAt)
            d.writeLong(r.expectedSize); d.writeUTF(r.expectedHash)
        }
        files.write(key(r.spec.operationId), out.toByteArray())
    }
    private fun decode(bytes: ByteArray): ImportRecord = try {
        if (bytes.size > 256000) throw StorageFailure("RECOVERY_REQUIRED")
        DataInputStream(ByteArrayInputStream(bytes)).use { d ->
            val version = d.readInt()
            if (version !in 1..2) throw StorageFailure("RECOVERY_REQUIRED")
            val s = (0..13).map { d.readUTF() }
            val declared = d.readLong().takeIf { it >= 0 }; val size = d.readLong()
            val created = d.readLong(); val updated = d.readLong()
            val record = ImportRecord(ImportSpec(s[0],s[1],s[2],s[3],s[4],declared,s[5],s[6]),s[7],s[8],s[9],s[10],size,s[11],s[12],s[13],created,updated)
            if (version >= 2) { record.expectedSize=d.readLong(); record.expectedHash=d.readUTF() }
            record
        }
    } catch (e: Exception) { throw StorageFailure("RECOVERY_REQUIRED") }
}

internal interface DigitalStorageBackend {
    fun assertTree(tree: String, write: Boolean)
    fun source(spec: ImportSpec): InputStream
    fun parent(tree: String, category: String): String
    fun create(tree: String, parent: String, filename: String, mime: String): String
    /** Only exact operation identifiers in the recorded managed parent; unsupported listing fails closed. */
    fun findCreated(record: ImportRecord): List<String> = throw StorageFailure("RECOVERY_REQUIRED")
    fun read(tree: String, uri: String): InputStream
    fun write(tree: String, uri: String): OutputStream
    fun delete(tree: String, uri: String)
}

internal object IncrementalCopy {
    const val BUFFER_SIZE = 64 * 1024
    fun digest(input: InputStream, output: OutputStream? = null, cancelled: () -> Boolean = { false },
        progress: (Long) -> Unit = {}): CopyDigest {
        val buffer = ByteArray(BUFFER_SIZE)
        val tail = ByteArray(1024); var tailSize = 0
        val digest = MessageDigest.getInstance("SHA-256"); var size = 0L
        while (true) {
            if (cancelled()) throw StorageFailure("OPERATION_CANCELLED")
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) continue
            output?.write(buffer, 0, count)
            digest.update(buffer, 0, count); size = Math.addExact(size, count.toLong())
            if (count >= tail.size) { System.arraycopy(buffer, count-tail.size, tail, 0, tail.size); tailSize = tail.size }
            else {
                val keep = minOf(tailSize, tail.size-count)
                System.arraycopy(tail, tailSize-keep, tail, 0, keep)
                System.arraycopy(buffer, 0, tail, keep, count); tailSize = keep+count
            }
            progress(size)
        }
        output?.flush()
        return CopyDigest(size, digest.digest().joinToString("") { "%02x".format(it) }, tail.copyOf(tailSize))
    }
}

/** One lock per operation/file, never the bibliographic SQLite connection. */
internal class DigitalStorageEngine(private val journal: ImportJournal, private val backend: DigitalStorageBackend,
    private val failureCode: (Exception) -> String = { if (it is StorageFailure) it.code else "FILE_UNAVAILABLE" },
    private val checkpoint: (String) -> Unit = {}) {
    private val locks = ConcurrentHashMap<String, ReentrantLock>()
    private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()
    private fun <T> locked(id: String, action: () -> T): T {
        if (!id.matches(Regex("[a-zA-Z0-9_-]{1,128}"))) throw StorageFailure("INVALID_REFERENCE")
        val lock = locks.computeIfAbsent(id) { ReentrantLock() }
        if (!lock.tryLock()) throw StorageFailure("OPERATION_CONFLICT")
        try { return action() } finally { lock.unlock() }
    }
    fun cancel(id: String) { cancelled.computeIfAbsent(id) { AtomicBoolean() }.set(true) }
    fun all(): List<ImportRecord> = journal.all()
    fun lookup(id: String): ImportRecord? = journal.read(id)
    fun operation(id: String): ImportRecord = journal.read(id) ?: throw StorageFailure("INVALID_REFERENCE")
    private fun managed(token: String): ImportRecord = journal.all().firstOrNull { it.token == token }
        ?: throw StorageFailure("INVALID_REFERENCE")
    private fun ready(r: ImportRecord) {
        if (r.stage !in setOf("FILE_READY", "LINKING", "COMPLETED")) throw StorageFailure("RECOVERY_REQUIRED")
        if (r.uri.isEmpty() || r.hash.length != 64 || r.size <= 0) throw StorageFailure("RECOVERY_REQUIRED")
    }
    fun metadata(token: String): ImportRecord = managed(token).also { ready(it); backend.read(it.spec.tree,it.uri).use {} }
    fun verify(token: String, requestId: String = UUID.randomUUID().toString(), progress: (Long) -> Unit = {}): CopyDigest {
        val r = managed(token)
        return locked(r.spec.operationId) {
            val stop=cancelled.computeIfAbsent(requestId){AtomicBoolean()}
            try {
            ready(r)
            val actual = backend.read(r.spec.tree,r.uri).use { IncrementalCopy.digest(it,cancelled=stop::get,progress=progress) }
            if (actual.size != r.size || actual.sha256 != r.hash) throw StorageFailure("INTEGRITY_MISMATCH")
            actual
            } finally {cancelled.remove(requestId,stop)}
        }
    }
    fun import(spec: ImportSpec, progress: (String,Long,Long?) -> Unit = {_,_,_->}): ImportRecord = locked(spec.operationId) {
        val prior = journal.read(spec.operationId)
        if (prior != null && (prior.spec.source != spec.source || prior.spec.format != spec.format || prior.spec.category != spec.category)) throw StorageFailure("OPERATION_CONFLICT")
        val r = prior ?: ImportRecord(spec).also(journal::save)
        val stop = cancelled.computeIfAbsent(spec.operationId) { AtomicBoolean() }
        var lastReport = 0L
        fun report(stage: String, bytes: Long, total: Long?) {
            val now = System.nanoTime()
            if (bytes == 0L || now-lastReport > 250_000_000L) {
                lastReport = now; r.size = bytes; journal.save(r); progress(stage,bytes,total)
            }
        }
        try {
            if (r.stage in setOf("FILE_READY","LINKING","COMPLETED")) {
                ready(r)
                val actual = backend.read(r.spec.tree,r.uri).use { IncrementalCopy.digest(it,cancelled=stop::get) }
                if (actual.size != r.size || actual.sha256 != r.hash) throw StorageFailure("INTEGRITY_MISMATCH")
                return@locked r
            }
            if (r.stage in setOf("DELETED","DISCARDED","DELETING")) throw StorageFailure("OPERATION_CONFLICT")
            if (r.stage == "CREATING" && r.uri.isEmpty()) {
                backend.assertTree(r.spec.tree,false)
                if (r.expectedSize <= 0 || r.expectedHash.length != 64 || r.parent.isEmpty()) throw StorageFailure("RECOVERY_REQUIRED")
                val candidates = backend.findCreated(r)
                // Empty, renamed, ambiguous or incomplete listings cannot prove ownership/integrity.
                if (candidates.size != 1) throw StorageFailure("RECOVERY_REQUIRED")
                val actual = backend.read(r.spec.tree,candidates.single()).use { IncrementalCopy.digest(it,cancelled=stop::get) }
                if (actual.size != r.expectedSize || actual.sha256 != r.expectedHash) throw StorageFailure("RECOVERY_REQUIRED")
                r.uri=candidates.single(); r.size=actual.size; r.hash=actual.sha256
                r.stage="FILE_READY"; r.error=""; journal.save(r)
                return@locked r
            }
            if (stop.get()) throw StorageFailure("OPERATION_CANCELLED")
            backend.assertTree(r.spec.tree,true)
            if (r.hash.isNotEmpty() && r.uri.isNotEmpty()) {
                val actual = backend.read(r.spec.tree,r.uri).use { IncrementalCopy.digest(it,cancelled=stop::get) }
                if (actual.size != r.size || actual.sha256 != r.hash) throw StorageFailure("INTEGRITY_MISMATCH")
                r.stage="FILE_READY"; r.error=""; journal.save(r); return@locked r
            }
            progress("validating",0,r.spec.declaredSize)
            backend.source(r.spec).use { BasicMediaValidation.validate(it,r.spec.format,stop::get) }
            if (r.uri.isEmpty()) {
                // Persist the source fingerprint and unique token BEFORE creating media bytes.
                val expected = backend.source(r.spec).use { IncrementalCopy.digest(it,cancelled=stop::get) }
                if (expected.size <= 0 || (r.spec.declaredSize != null && expected.size != r.spec.declaredSize)) throw StorageFailure("INTEGRITY_MISMATCH")
                r.expectedSize=expected.size; r.expectedHash=expected.sha256
                r.parent = backend.parent(r.spec.tree,r.spec.category)
                checkpoint("before-intent")
                r.stage="CREATING"; journal.save(r) // intent before irreversible document creation
                val created = backend.create(r.spec.tree,r.parent,"${r.token}.${r.spec.format}",canonicalMime(r.spec.format))
                checkpoint("after-create-before-uri")
                r.uri = created
                r.stage="PREPARING"; journal.save(r) // ownership before writing any bytes
            }
            r.stage="COPYING"; r.size=0; r.hash=""; r.error=""; journal.save(r)
            progress("copying",0,r.spec.declaredSize)
            val copied = backend.source(r.spec).use { input -> backend.write(r.spec.tree,r.uri).use { output ->
                IncrementalCopy.digest(input,output,stop::get) { report("copying",it,r.spec.declaredSize) }
            } }
            if (copied.size <= 0 || (r.expectedHash.isNotEmpty() && (copied.size != r.expectedSize || copied.sha256 != r.expectedHash))
                || (r.spec.declaredSize != null && copied.size != r.spec.declaredSize)) throw StorageFailure("INTEGRITY_MISMATCH")
            if (r.spec.format == "pdf" && !copied.tail.toString(Charsets.ISO_8859_1).contains("%%EOF")) throw StorageFailure("INVALID_FILE")
            checkpoint("after-copy")
            r.size=copied.size; r.hash=copied.sha256; r.stage="VERIFYING"; journal.save(r)
            progress("verifying",0,r.size)
            val actual = backend.read(r.spec.tree,r.uri).use { IncrementalCopy.digest(it,cancelled=stop::get) { bytes ->
                val now=System.nanoTime(); if(now-lastReport>250_000_000L){lastReport=now; progress("verifying",bytes,r.size)}
            } }
            if (copied.size != actual.size || copied.sha256 != actual.sha256) throw StorageFailure("INTEGRITY_MISMATCH")
            if (stop.get()) throw StorageFailure("OPERATION_CANCELLED")
            checkpoint("before-ready")
            r.stage="FILE_READY"; journal.save(r)
            progress("committing",r.size,r.size)
            r
        } catch (e: Exception) {
            // Do not downgrade an already committed/linked file on an idempotent query error.
            if (r.stage !in setOf("FILE_READY","LINKING","COMPLETED")) {
                r.error=failureCode(e)
                if (r.stage != "CREATING") r.stage="RECOVERY_REQUIRED"
                journal.save(r)
            }
            throw e
        } finally { cancelled.remove(spec.operationId,stop) }
    }
    fun recover(id: String, progress: (String,Long,Long?)->Unit = {_,_,_->}): ImportRecord {
        val r = operation(id)
        return import(r.spec,progress)
    }
    fun beginLink(id: String, context: String): ImportRecord = locked(id) {
        val r=operation(id); ready(r)
        if (context.isEmpty() || context.toByteArray().size>12000) throw StorageFailure("INVALID_FILE")
        if (r.link.isNotEmpty() && r.link!=context) throw StorageFailure("OPERATION_CONFLICT")
        if (r.stage=="COMPLETED") return@locked r
        r.link=context; r.stage="LINKING"; journal.save(r); r
    }
    fun complete(id: String) = locked(id) {
        val r=operation(id); ready(r)
        if(r.link.isEmpty()) throw StorageFailure("RECOVERY_REQUIRED")
        r.stage="COMPLETED"; journal.save(r)
    }
    fun delete(token: String) {
        val r=managed(token)
        locked(r.spec.operationId) {
            val current=operation(r.spec.operationId)
            if(current.stage=="DELETED") return@locked
            if(current.link.isNotEmpty() || current.stage in setOf("LINKING","COMPLETED")) throw StorageFailure("ATTACHMENT_CONFLICT")
            if(current.uri.isEmpty()) throw StorageFailure("RECOVERY_REQUIRED")
            current.stage="DELETING"; journal.save(current)
            try { backend.delete(current.spec.tree,current.uri) }
            catch(e: FileNotFoundException) { /* already absent is idempotent */ }
            current.stage="DELETED"; journal.save(current)
        }
    }
    fun discard(id: String) = locked(id) {
        val r=operation(id)
        if(r.stage in setOf("FILE_READY","LINKING","COMPLETED")) throw StorageFailure("ATTACHMENT_CONFLICT")
        if(r.uri.isNotEmpty()) { delete(r.token); return@locked }
            if(r.stage=="CREATING") throw StorageFailure("RECOVERY_REQUIRED")
            r.stage="DISCARDED"; journal.save(r)
    }
}

internal fun canonicalMime(format: String): String = when(format) {
    "epub"->"application/epub+zip"; "pdf"->"application/pdf"; "mp3"->"audio/mpeg"; else->"audio/mp4"
}
