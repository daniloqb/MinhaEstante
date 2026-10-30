package com.booknookapp

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** Real JVM ZipFile readback of the integrated browser exporter. No Android/SAF claim. */
class BackupV2ExportInteropTest {
    @Test fun readsIntegratedWebExportsWithCrcAndSha256() {
        val path = System.getenv("BACKUP_EXPORT_ARTIFACT_ROOT")
        assumeTrue("Requires a fresh synthetic browser run", path != null)
        val root = File(path!!)
        require(root.canonicalPath.matches(Regex("/tmp/minhaestante-4-2b-[a-z0-9-]+")) && File(root, "synthetic-export-root.json").isFile)
        val archives = root.listFiles()!!.filter { it.name.matches(Regex("backup-[a-f0-9-]{36}\\.zip")) }.sortedBy { it.name }
        assertTrue("No real browser exports were transferred", archives.isNotEmpty())
        val reports = archives.map { zip ->
            val entries = BackupZipProof.inspect(zip)
            assertTrue(entries.any { it.path == "manifest.json" })
            assertTrue(entries.any { it.path == "books.json" })
            assertTrue(entries.any { it.path == "reading.json" })
            """{"filename":"${zip.name}","entries":${BackupZipProof.json(entries)}}"""
        }
        File(root, "kotlin-read-report.json").writeText(reports.joinToString(prefix="[", postfix="]"))
    }
}
