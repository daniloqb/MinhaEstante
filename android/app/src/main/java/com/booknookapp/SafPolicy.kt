package com.booknookapp

/** Pure policy; native grants and provider I/O are verified separately. */
internal object SafPolicy {
    const val READ = 1
    const val WRITE = 2
    const val PERSISTABLE = 64
    val formats = setOf("epub", "pdf", "mp3", "m4a", "m4b")

    fun persistableModes(flags: Int): Int =
        if (flags and PERSISTABLE != 0) flags and (READ or WRITE) else 0

    fun format(name: String): String? = name.substringAfterLast('.', "").lowercase().takeIf { it in formats }

    fun folderState(read: Boolean, write: Boolean, canCreate: Boolean): String = when {
        !read -> "permission-revoked"
        !write || !canCreate -> "read-only"
        else -> "accessible"
    }
}
