package com.booknookapp

import android.util.AtomicFile
import java.io.File
import java.io.FileNotFoundException

/** AtomicFile finishes (including sync) before the next physical/storage transition. */
internal class AndroidMetadataFiles(private val root: File): MetadataFiles {
    init { if(!root.exists() && !root.mkdirs()) throw StorageFailure("OPERATION_FAILED") }
    private fun file(key: String): AtomicFile {
        if(!key.matches(Regex("[a-f0-9]{64}"))) throw StorageFailure("INVALID_REFERENCE")
        return AtomicFile(File(root,"$key.op"))
    }
    @Synchronized override fun read(key: String): ByteArray? = try { file(key).openRead().use { stream ->
        val output=java.io.ByteArrayOutputStream()
        val buffer=ByteArray(4096)
        while(true){val count=stream.read(buffer);if(count<0)break
            if(output.size()+count>256000)throw StorageFailure("RECOVERY_REQUIRED")
            output.write(buffer,0,count)
        }
        output.toByteArray()
    } } catch(_: FileNotFoundException){null}
    @Synchronized override fun write(key: String, bytes: ByteArray) {
        if(bytes.size>256000)throw StorageFailure("INVALID_FILE")
        val file=file(key); val output=file.startWrite()
        try {output.write(bytes);file.finishWrite(output)} catch(e:Exception){file.failWrite(output);throw e}
    }
    @Synchronized override fun keys(): List<String> = root.listFiles()?.mapNotNull { entry ->
        val name=entry.name.removeSuffix(".bak")
        if(name.matches(Regex("[a-f0-9]{64}\\.op")))name.removeSuffix(".op") else null
    }?.distinct() ?: emptyList()
}
