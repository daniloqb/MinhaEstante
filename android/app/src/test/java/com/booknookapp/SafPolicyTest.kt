package com.booknookapp

import org.junit.Assert.*
import org.junit.Test

class SafPolicyTest {
    @Test fun persistsOnlyGrantedReadWriteModes() {
        assertEquals(0, SafPolicy.persistableModes(1 or 2))
        assertEquals(1, SafPolicy.persistableModes(1 or 64))
        assertEquals(2, SafPolicy.persistableModes(2 or 64))
        assertEquals(3, SafPolicy.persistableModes(1 or 2 or 64 or 128))
        assertEquals(0, SafPolicy.persistableModes(64 or 128))
    }
    @Test fun directorySelectionDoesNotProveWrite() {
        assertEquals("permission-revoked", SafPolicy.folderState(false, true, true))
        assertEquals("read-only", SafPolicy.folderState(true, false, true))
        assertEquals("read-only", SafPolicy.folderState(true, true, false))
        assertEquals("accessible", SafPolicy.folderState(true, true, true))
    }
    @Test fun recognizesOnlySupportedExtensionsIgnoringCase() {
        for (format in SafPolicy.formats) assertEquals(format, SafPolicy.format("synthetic.${format.uppercase()}"))
        assertNull(SafPolicy.format("file.exe"))
        assertNull(SafPolicy.format("file.pdf.exe"))
        assertNull(SafPolicy.format("pdf"))
    }
}
