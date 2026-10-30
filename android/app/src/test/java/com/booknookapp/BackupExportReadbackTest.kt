package com.booknookapp

import org.junit.Assert.*
import org.junit.Test
import java.io.*

class BackupExportReadbackTest {
    private fun fails(code: String, action: () -> Unit) {
        try { action(); fail("Expected $code") }
        catch (error: BackupZipProof.Failure) { assertEquals(code, error.code) }
    }
    @Test fun exactCopyUsesTheExistingIncrementalDigest() {
        val bytes = ByteArray(200000) { (it % 251).toByte() }; val out = ByteArrayOutputStream()
        val result = BackupExportReadback.copy(ByteArrayInputStream(bytes), out, bytes.size.toLong())
        assertArrayEquals(bytes, out.toByteArray())
        assertEquals(IncrementalCopy.digest(ByteArrayInputStream(bytes)).sha256, result.sha256)
    }
    @Test fun providerGrowthCannotFillTemporaryStorage() {
        val out = ByteArrayOutputStream()
        fails("INTEGRITY_MISMATCH") { BackupExportReadback.copy(ByteArrayInputStream(ByteArray(100000)), out, 7) }
        assertEquals(0, out.size())
    }
    @Test fun truncatedDestinationCannotBeVerified() {
        fails("INTEGRITY_MISMATCH") { BackupExportReadback.copy(ByteArrayInputStream(ByteArray(7)), ByteArrayOutputStream(), 8) }
    }
    @Test fun cancellationStopsBeforeCopyingMoreBytes() {
        var stopped = false
        val out = object : ByteArrayOutputStream() { override fun write(b: ByteArray, off: Int, len: Int) { super.write(b, off, len); stopped = true } }
        fails("CANCELLED") { BackupExportReadback.copy(ByteArrayInputStream(ByteArray(200000)), out, 200000, stop={stopped}) }
        assertEquals(65536, out.size())
    }
    @Test fun writeFailureIsNotSuppressed() {
        try {
            BackupExportReadback.copy(ByteArrayInputStream(ByteArray(8)), object : OutputStream() { override fun write(b: Int) { throw IOException("synthetic") } }, 8)
            fail("Expected I/O failure")
        } catch (_: IOException) { }
    }
}
