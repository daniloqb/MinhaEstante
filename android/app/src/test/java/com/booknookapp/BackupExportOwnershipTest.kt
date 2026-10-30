package com.booknookapp

import org.junit.Assert.*
import org.junit.Test

class BackupExportOwnershipTest {
    @Test fun laterBridgeCallCanReleaseAnEqualIdWithDifferentObjectIdentity() {
        val owner = BackupExportOwnership()
        val selected = String("backup-synthetic".toCharArray())
        val confirmed = String("backup-synthetic".toCharArray())
        assertNotSame(selected, confirmed)
        assertTrue(owner.acquire(selected)); assertTrue(owner.release(confirmed)); assertNull(owner.get())
        assertTrue(owner.acquire("backup-next"))
    }
    @Test fun differentOperationCannotReleaseTheActiveWriter() {
        val owner = BackupExportOwnership(); assertTrue(owner.acquire("backup-active"))
        assertFalse(owner.release("backup-other")); assertEquals("backup-active", owner.get())
        assertFalse(owner.acquire("backup-other"))
    }
    @Test fun repeatedReleaseCannotAffectTheNextOperation() {
        val owner = BackupExportOwnership(); assertTrue(owner.acquire("backup-first")); assertTrue(owner.release("backup-first"))
        assertTrue(owner.acquire("backup-second")); assertFalse(owner.release("backup-first"))
        assertEquals("backup-second", owner.get())
    }
}
