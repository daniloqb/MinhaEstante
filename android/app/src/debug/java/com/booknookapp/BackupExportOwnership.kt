package com.booknookapp

import java.util.concurrent.atomic.AtomicReference

/** Bridge calls parse equal operation IDs into different String instances. CAS needs the stored reference. */
internal class BackupExportOwnership {
    private val current = AtomicReference<String?>(null)
    fun get(): String? = current.get()
    fun acquire(id: String): Boolean = current.compareAndSet(null, id)
    fun release(id: String): Boolean {
        val stored = current.get()
        return stored == id && current.compareAndSet(stored, null)
    }
}
