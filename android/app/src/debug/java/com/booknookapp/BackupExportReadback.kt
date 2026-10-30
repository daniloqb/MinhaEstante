package com.booknookapp

import java.io.FilterInputStream
import java.io.InputStream
import java.io.OutputStream

/** Bound the operation-owned verification copy by the bytes actually written, even for a faulty provider. */
internal object BackupExportReadback {
    fun copy(input: InputStream, output: OutputStream, expectedBytes: Long, stop: () -> Boolean = { false }): CopyDigest {
        if (expectedBytes <= 0) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
        var count = 0L
        val bounded = object : FilterInputStream(input) {
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                if (stop()) throw BackupZipProof.Failure("CANCELLED")
                // At most one extra byte is read to detect growth; it is never written to the copy.
                val n = `in`.read(b, off, minOf(len.toLong(), expectedBytes - count + 1).toInt())
                if (n > 0) {
                    count += n
                    if (count > expectedBytes) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
                }
                return n
            }
        }
        // The wrapper checks cancellation before every bounded read; reuse the existing SHA-256 copier.
        val result = IncrementalCopy.digest(bounded, output)
        if (result.size != expectedBytes) throw BackupZipProof.Failure("INTEGRITY_MISMATCH")
        return result
    }
}
