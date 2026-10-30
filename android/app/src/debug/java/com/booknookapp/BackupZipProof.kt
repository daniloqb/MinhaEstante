package com.booknookapp

import java.io.*
import java.security.MessageDigest
import java.util.zip.*

/** Debug source set only. Backup v2 — Streaming Proof of Concept. No database or production API. */
internal object BackupZipProof {
    const val BUFFER_BYTES = 64 * 1024
    class Failure(val code: String) : IOException(code)
    data class Source(val path: String, val open: () -> InputStream)
    data class EntryDigest(val path: String, val size: Long, val sha256: String, val crc32: Long, val method: Int)
    data class Progress(val phase: String, val path: String?, val inputBytes: Long, val outputBytes: Long, val files: Int)
    data class Result(val entries: List<EntryDigest>, val inputBytes: Long, val outputBytes: Long, val durationMs: Long,
        val maxRead: Int, val heapPeak: Long, val rssPeakKiB: Long, val outputState: String = "closed-unverified")
    private fun check(stop: () -> Boolean) { if (stop()) throw Failure("CANCELLED") }
    private fun hash(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
    private fun sampleRss(): Long = try { File("/proc/self/status").useLines { lines ->
        lines.firstOrNull { it.startsWith("VmRSS:") }?.trim()?.split(Regex("\\s+"))?.get(1)?.toLong() ?: 0L
    } } catch (_: Exception) { 0L }
    /** Caller provides synthetic/authorized streams. This codec never interprets a path as a disk destination. */
    fun write(sources: List<Source>, output: OutputStream, stored: Boolean = false, bufferBytes: Int = BUFFER_BYTES,
        stop: () -> Boolean = { false }, progress: (Progress) -> Unit = {}): Result {
        if (bufferBytes !in 1024..256 * 1024 || sources.size > 100000 || sources.map { it.path }.toSet().size != sources.size) throw Failure("ZIP_FORMAT")
        sources.forEach { if (it.path.startsWith('/') || it.path.contains("..") || it.path.contains('\\') || it.path.contains(':') || it.path.isEmpty()) throw Failure("ZIP_FORMAT") }
        val start = System.nanoTime(); var inputBytes = 0L; var outputBytes = 0L; var files = 0; var maxRead = 0
        var heapPeak = 0L; var rssPeak = 0L; var path: String? = null; var lastSample = 0L
        fun report(phase: String) {
            val now = System.nanoTime()
            if (now - lastSample >= 50_000_000L || phase == "closed") {
                lastSample = now
                val rt = Runtime.getRuntime(); heapPeak = maxOf(heapPeak, rt.totalMemory() - rt.freeMemory()); rssPeak = maxOf(rssPeak, sampleRss())
            }
            progress(Progress(phase, path, inputBytes, outputBytes, files))
        }
        val sink = object : OutputStream() {
            override fun write(b: Int) { write(byteArrayOf(b.toByte()), 0, 1) }
            override fun write(b: ByteArray, off: Int, len: Int) {
                check(stop)
                try { output.write(b, off, len) } catch (e: Failure) { throw e } catch (_: IOException) { throw Failure("DESTINATION_WRITE") }
                outputBytes += len
                // Output callbacks may request cancellation without changing any source or metadata.
                progress(Progress("write", path, inputBytes, outputBytes, files)); check(stop)
            }
            override fun close() { try { output.close() } catch (_: IOException) { throw Failure("DESTINATION_CLOSE") } }
            override fun flush() { try { output.flush() } catch (_: IOException) { throw Failure("DESTINATION_WRITE") } }
        }
        val zip = ZipOutputStream(sink, Charsets.UTF_8); zip.setLevel(1)
        val buffer = ByteArray(bufferBytes); val results = mutableListOf<EntryDigest>()
        fun consume(source: Source, write: Boolean): EntryDigest {
            val digest = MessageDigest.getInstance("SHA-256"); val crc = CRC32(); var size = 0L
            val input = try { source.open() } catch (e: Failure) { throw e } catch (_: IOException) { throw Failure("SOURCE_UNAVAILABLE") }
            input.use {
                while (true) {
                    check(stop)
                    val n = try { it.read(buffer) } catch (e: Failure) { throw e } catch (_: IOException) { throw Failure("SOURCE_READ") }
                    if (n < 0) break
                    if (n == 0) continue
                    maxRead = maxOf(maxRead, n); size = Math.addExact(size, n.toLong()); digest.update(buffer, 0, n); crc.update(buffer, 0, n)
                    if (write) { inputBytes += n; report("read"); check(stop); zip.write(buffer, 0, n) }
                    else report("prepass")
                }
            }
            return EntryDigest(source.path, size, hash(digest.digest()), crc.value, if (stored) 0 else 8)
        }
        try {
            report("prepare"); check(stop)
            for (source in sources) {
                path = source.path; check(stop)
                val expected = if (stored) consume(source, false) else null
                val entry = ZipEntry(source.path)
                if (expected != null) { entry.method = ZipEntry.STORED; entry.size = expected.size; entry.compressedSize = expected.size; entry.crc = expected.crc32 }
                zip.putNextEntry(entry)
                val actual = consume(source, true)
                if (expected != null && (expected.size != actual.size || expected.sha256 != actual.sha256)) throw Failure("INTEGRITY")
                zip.closeEntry(); results.add(actual); files++; report("between-entries"); check(stop)
            }
            path = null; report("before-finalize"); check(stop); report("finalize"); check(stop)
            zip.finish(); check(stop); zip.flush(); zip.close(); report("closed")
            return Result(results, inputBytes, outputBytes, (System.nanoTime() - start) / 1000000, maxRead, heapPeak, rssPeak)
        } catch (error: Exception) {
            // No ZipOutputStream.close(): it may finish/salvage an incomplete ZIP. Close only the underlying output.
            try { output.close() } catch (_: Exception) { }
            throw if (error is Failure) error else Failure("ZIP_FORMAT")
        }
    }
    /** Hashes into a fixed buffer. Does not extract entries into filesystem paths. V2 rules remain in TypeScript. */
    fun inspect(file: File, stop: () -> Boolean = { false }): List<EntryDigest> = ZipFile(file, Charsets.UTF_8).use { zip ->
        val names = mutableSetOf<String>(); val result = mutableListOf<EntryDigest>(); val buffer = ByteArray(BUFFER_BYTES)
        val entries = zip.entries()
        while (entries.hasMoreElements()) {
            check(stop)
            val entry = entries.nextElement()
            if (!names.add(entry.name) || names.size > 100000 || entry.isDirectory) throw Failure("ZIP_FORMAT")
            val hash = MessageDigest.getInstance("SHA-256"); val crc = CRC32(); var size = 0L
            zip.getInputStream(entry).use { stream -> while (true) {
                check(stop); val n = stream.read(buffer); if (n < 0) break
                size = Math.addExact(size, n.toLong()); if (size > 256L * 1024 * 1024) throw Failure("ZIP_FORMAT")
                hash.update(buffer, 0, n); crc.update(buffer, 0, n)
            } }
            if (size != entry.size || crc.value != entry.crc) throw Failure("INTEGRITY")
            result.add(EntryDigest(entry.name, size, hash(hash.digest()), crc.value, entry.method))
        }
        result
    }
    fun json(entries: List<EntryDigest>): String = entries.joinToString(prefix = "[", postfix = "]") {
        """{"archivePath":"${it.path.replace("\\", "\\\\").replace("\"", "\\\"")}","sizeBytes":${it.size},"sha256":"${it.sha256}","crc32":${it.crc32},"method":${it.method}}"""
    }
}
