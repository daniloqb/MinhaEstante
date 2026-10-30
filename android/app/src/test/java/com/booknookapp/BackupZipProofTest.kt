package com.booknookapp

import org.junit.Assert.*
import org.junit.Test
import java.io.*
import java.nio.file.Files
import java.util.zip.*

class BackupZipProofTest {
    private fun source(path: String = "synthetic.txt", size: Int = 200000) = BackupZipProof.Source(path) { object : InputStream() {
        var remaining = size
        override fun read(): Int { if (remaining-- <= 0) return -1; return 42 }
        override fun read(b: ByteArray, off: Int, len: Int): Int { if (remaining == 0) return -1; val n = minOf(len, remaining); b.fill(42, off, off + n); remaining -= n; return n }
    } }
    private fun disk(action: (File) -> Unit) { val root = Files.createTempDirectory("backup-zip-jvm-synthetic-").toFile(); try { action(root) } finally { root.deleteRecursively() } }
    private fun fails(code: String, action: () -> Unit) { try { action(); fail("Expected $code") } catch (error: BackupZipProof.Failure) { assertEquals(code, error.code) } }
    @Test fun boundedDeflateRoundTrip() = disk { root ->
        val zip = File(root, "test.zip"); val metrics = BackupZipProof.write(listOf(source()), zip.outputStream())
        assertTrue(metrics.maxRead <= 65536); assertEquals(200000L, metrics.inputBytes); assertEquals("closed-unverified", metrics.outputState)
        assertEquals(metrics.entries, BackupZipProof.inspect(zip))
    }
    @Test fun storedRequiresTwoReads() = disk { root ->
        var opens = 0; val base = source(); val counted = BackupZipProof.Source(base.path) { opens++; base.open() }
        val zip = File(root, "stored.zip"); val metrics = BackupZipProof.write(listOf(counted), zip.outputStream(), true)
        assertEquals(2, opens); assertEquals(0, BackupZipProof.inspect(zip)[0].method); assertEquals(metrics.entries, BackupZipProof.inspect(zip))
    }
    @Test fun emptyCodecEntryAndUnicodeName() = disk { root ->
        val zip = File(root, "unicode.zip"); BackupZipProof.write(listOf(source("ação-日本語.txt", 0)), zip.outputStream())
        assertEquals("ação-日本語.txt", BackupZipProof.inspect(zip)[0].path); assertEquals(0L, BackupZipProof.inspect(zip)[0].size)
        // Generic engine capability only: empty media/Unicode archive paths are still prohibited by the v2 contract.
    }
    @Test fun cancelAtEveryDurableBoundary() {
        for (phase in listOf("prepare", "read", "write", "between-entries", "before-finalize", "finalize")) {
            var stop = false; var completed = false
            fails("CANCELLED") { BackupZipProof.write(listOf(source()), ByteArrayOutputStream(), stop = { stop }, progress = { if (it.phase == phase) stop = true; if (it.phase == "closed") completed = true }) }
            assertFalse(completed)
        }
    }
    @Test fun cancelAfterCloseDoesNotUndoCompletion() {
        var stop = false
        val result = BackupZipProof.write(listOf(source(size = 0)), ByteArrayOutputStream(), stop = { stop }, progress = { if (it.phase == "closed") stop = true })
        assertEquals("closed-unverified", result.outputState)
    }
    @Test fun unavailableSource() { fails("SOURCE_UNAVAILABLE") { BackupZipProof.write(listOf(BackupZipProof.Source("missing.txt") { throw FileNotFoundException() }), ByteArrayOutputStream()) } }
    @Test fun revokedPermissionIsDistinctFromMissingSource() { fails("PERMISSION_REQUIRED") { BackupZipProof.write(listOf(BackupZipProof.Source("synthetic.txt") { throw BackupZipProof.Failure("PERMISSION_REQUIRED") }), ByteArrayOutputStream()) } }
    @Test fun failedRead() { fails("SOURCE_READ") { BackupZipProof.write(listOf(BackupZipProof.Source("failed.txt") { object : InputStream() { override fun read(): Int = throw IOException() } }), ByteArrayOutputStream()) } }
    @Test fun failedWriteAndQuota() {
        fails("DESTINATION_WRITE") { BackupZipProof.write(listOf(source()), object : OutputStream() { override fun write(b: Int) { throw IOException() } }) }
        fails("QUOTA") { BackupZipProof.write(listOf(source()), object : OutputStream() { override fun write(b: Int) { throw BackupZipProof.Failure("QUOTA") } }) }
    }
    @Test fun failedClose() { fails("DESTINATION_CLOSE") { BackupZipProof.write(listOf(source()), object : ByteArrayOutputStream() { override fun close() { throw IOException() } }) } }
    @Test fun failedFinalizationRetainsPartial() {
        var finalizing = false
        val output = object : ByteArrayOutputStream() { override fun write(b: ByteArray, off: Int, len: Int) { if (finalizing) throw IOException(); super.write(b, off, len) } }
        fails("DESTINATION_WRITE") { BackupZipProof.write(listOf(source()), output, progress = { if (it.phase == "before-finalize") finalizing = true }) }
        assertTrue(output.size() > 0)
    }
    @Test fun duplicatesAndTraversalFailBeforeWrite() {
        fails("ZIP_FORMAT") { BackupZipProof.write(listOf(source(), source()), ByteArrayOutputStream()) }
        for (path in listOf("../outside", "/absolute", "C:/outside", "bad\\path")) fails("ZIP_FORMAT") { BackupZipProof.write(listOf(source(path)), ByteArrayOutputStream()) }
    }
    @Test fun truncatedZipRejected() = disk { root ->
        val zip = File(root, "truncated.zip"); BackupZipProof.write(listOf(source()), zip.outputStream())
        RandomAccessFile(zip, "rw").use { it.setLength(it.length() - 20) }
        try { BackupZipProof.inspect(zip); fail("Truncation accepted") } catch (_: ZipException) { }
    }
    @Test fun verificationCanBeCancelled() = disk { root ->
        val zip = File(root, "cancel-verify.zip"); BackupZipProof.write(listOf(source()), zip.outputStream())
        fails("CANCELLED") { BackupZipProof.inspect(zip, stop = { true }) }
    }
    @Test fun corruptedPayloadFailsCrcOrInflater() = disk { root ->
        val zip = File(root, "corrupt.zip"); BackupZipProof.write(listOf(source()), zip.outputStream(), stored = true)
        RandomAccessFile(zip,"rw").use { it.seek(100); val before=it.readByte(); it.seek(100); it.writeByte(before.toInt() xor 255) }
        fails("INTEGRITY") { BackupZipProof.inspect(zip) }
    }
    @Test fun filesystemInteropAndMeasurements() {
        val path = System.getenv("MINHAESTANTE_ZIP_PROOF_DIR") ?: return
        val root = File(path)
        require(root.canonicalPath.matches(Regex("/tmp/minhaestante-4-2a-[a-zA-Z0-9_-]+")) && File(root, "proof-root.json").isFile)
        val reports = mutableListOf<String>()
        for (input in root.listFiles()!!.filter { it.isDirectory && it.name.startsWith("input-") }.sortedBy { it.name.removePrefix("input-").toLong() }) {
            val sources = input.walkTopDown().filter { it.isFile }.sortedBy { if (it.name == "manifest.json") "zzzz" else it.path }.map { file -> BackupZipProof.Source(file.relativeTo(input).invariantSeparatorsPath) { file.inputStream() } }.toList()
            for (stored in listOf(true, false)) {
                System.gc() // Measurement boundary only; this is a JVM test, never production behavior.
                val name = "kotlin-${input.name.removePrefix("input-")}-${if (stored) "store" else "deflate"}.zip"
                val zip = File(root, name)
                val metrics = BackupZipProof.write(sources, zip.outputStream(), stored)
                assertEquals(metrics.entries, BackupZipProof.inspect(zip))
                reports.add("""{"filename":"$name","inputBytes":${metrics.inputBytes},"outputBytes":${metrics.outputBytes},"durationMs":${metrics.durationMs},"maxRead":${metrics.maxRead},"heapPeak":${metrics.heapPeak},"rssPeakKiB":${metrics.rssPeakKiB},"entries":${BackupZipProof.json(metrics.entries)}}""")
            }
        }
        File(root, "kotlin-write-report.json").writeText(reports.joinToString(prefix = "[", postfix = "]"))
        val reads = root.listFiles()!!.filter { it.name.endsWith(".zip") && !it.name.contains("count") }.sortedBy { it.name }.map { zip ->
            val entries = BackupZipProof.inspect(zip)
            var streamCompatible = true
            try { ZipInputStream(zip.inputStream()).use { stream -> val buffer = ByteArray(65536); while (stream.nextEntry != null) { while (stream.read(buffer) >= 0) { }; stream.closeEntry() } } }
            catch (_: ZipException) { streamCompatible = false }
            """{"filename":"${zip.name}","zipInputStream":$streamCompatible,"entries":${BackupZipProof.json(entries)}}"""
        }
        File(root, "kotlin-read-report.json").writeText(reads.joinToString(prefix = "[", postfix = "]"))
    }
    @Test fun zip64ByEntryCount() {
        val path = System.getenv("MINHAESTANTE_ZIP_PROOF_DIR") ?: return
        val root = File(path); require(File(root, "proof-root.json").isFile)
        val file = File(root, "kotlin-count.zip")
        val sources = (0 until 65536).map { source("entry-$it", 0) }
        BackupZipProof.write(sources, file.outputStream(), true)
        assertEquals(65536, BackupZipProof.inspect(file).size)
        val tail = ByteArray(128); file.inputStream().use { it.skip(file.length() - tail.size); it.read(tail) }
        assertTrue(tail.asList().windowed(4).any { it == listOf<Byte>(80, 75, 6, 6) })
    }
}
