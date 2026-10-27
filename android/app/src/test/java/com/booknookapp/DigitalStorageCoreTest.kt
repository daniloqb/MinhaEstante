package com.booknookapp

import org.junit.Test
import org.junit.Assert.*
import java.io.*
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.zip.*

class DigitalStorageCoreTest {
    private val pdf="%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n".toByteArray()
    private fun sha(bytes:ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}
    private class DiskMetadata(val root:File):MetadataFiles{
        init{root.mkdirs()}
        override fun read(key:String)=File(root,key).takeIf{it.exists()}?.readBytes()
        override fun keys()=root.list()?.filter{!it.endsWith(".new")} ?: emptyList()
        override fun write(key:String,bytes:ByteArray){
            val temp=File(root,"$key.new");FileOutputStream(temp).use{it.write(bytes);it.fd.sync()}
            Files.move(temp.toPath(),File(root,key).toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING)
        }
    }
    private class Backend(val root:File):DigitalStorageBackend {
        val sources=mutableMapOf<String,()->InputStream>()
        var creates=0;var failWrite=false;var failRead=false;var corrupt=false;var dead=false;var revoked=false;var dieCreate=false;var dieWrite=false;var dieVerify=false;var ambiguous=false;var renamed=false;var listingUnavailable=false
        override fun assertTree(tree:String,write:Boolean){if(revoked)throw StorageFailure("PERMISSION_REVOKED");if(dead)throw StorageFailure("PROVIDER_UNAVAILABLE")}
        override fun source(spec:ImportSpec):InputStream {
            assertTree(spec.tree,false)
            val raw=sources[spec.source]?.invoke() ?: throw FileNotFoundException()
            return object:FilterInputStream(raw){var count=0
                override fun read(b:ByteArray,o:Int,n:Int):Int {val r=`in`.read(b,o,n);if(r>0)count+=r;if(failRead&&count>1000)throw IOException("synthetic read failure");return r}
            }
        }
        override fun parent(tree:String,category:String)=File(root,category).also{it.mkdirs()}.path
        override fun create(tree:String,parent:String,filename:String,mime:String):String {
            creates++;val file=File(parent,filename);file.createNewFile();if(dieCreate)throw AssertionError("simulated process death after create");return file.path
        }
        override fun findCreated(record:ImportRecord):List<String>{
            assertTree(record.spec.tree,false)
            if(listingUnavailable)throw StorageFailure("PROVIDER_UNAVAILABLE")
            val file=File(record.parent,"${record.token}.${record.spec.format}")
            if(renamed || !file.exists())return emptyList()
            return if(ambiguous)listOf(file.path,file.path)else listOf(file.path)
        }
        override fun read(tree:String,uri:String):InputStream {
            assertTree(tree,false);if(dieVerify)throw AssertionError("simulated death in verification")
            val raw=FileInputStream(uri)
            return object:FilterInputStream(raw){var changed=false
                override fun read(b:ByteArray,o:Int,n:Int):Int{val r=`in`.read(b,o,n);if(corrupt&&r>0&&!changed){b[o]=(b[o].toInt() xor 1).toByte();changed=true};return r}
            }
        }
        override fun write(tree:String,uri:String):OutputStream {
            assertTree(tree,true)
            return object:FilterOutputStream(FileOutputStream(uri)){var count=0
                override fun write(b:ByteArray,o:Int,n:Int){out.write(b,o,n);count+=n;if(dieWrite)throw AssertionError("simulated death during copy");if(failWrite)throw IOException("synthetic write failure")}
            }
        }
        override fun delete(tree:String,uri:String){assertTree(tree,true);if(!File(uri).delete())throw FileNotFoundException()}
    }
    private class Fixture:AutoCloseable{
        val root=Files.createTempDirectory("saf-core-test-").toFile()
        val metadata=DiskMetadata(File(root,"journal"));val backend=Backend(File(root,"media"))
        val journal=ImportJournal(metadata)
        fun engine()=DigitalStorageEngine(journal,backend,failureCode={when(it){is StorageFailure->it.code;is FileNotFoundException->"FILE_NOT_FOUND";else->"FILE_UNAVAILABLE"}})
        override fun close(){root.deleteRecursively()}
    }
    private fun spec(id:String="operation-1",format:String="pdf",size:Long?=pdf.size.toLong())=
        ImportSpec(id,"source","tree-1","original.$format",canonicalMime(format),size,format,if(format in setOf("pdf","epub"))"ebook"else"audiobook")
    private fun failure(expected:String,action:()->Unit){try{action();fail("Expected $expected")}catch(e:StorageFailure){assertEquals(expected,e.code)}}
    private fun epub():ByteArray{
        val out=ByteArrayOutputStream()
        ZipOutputStream(out).use{zip->
            val mime="application/epub+zip".toByteArray();val first=ZipEntry("mimetype");first.method=0;first.size=mime.size.toLong();first.crc=CRC32().apply{update(mime)}.value
            zip.putNextEntry(first);zip.write(mime);zip.closeEntry()
            zip.putNextEntry(ZipEntry("META-INF/container.xml"));zip.write("<container><rootfile full-path='content.opf'/></container>".toByteArray());zip.closeEntry()
            zip.putNextEntry(ZipEntry("content.opf"));zip.write("<package version='3.0'></package>".toByteArray());zip.closeEntry()
        };return out.toByteArray()
    }
    private fun mp3()=ByteArray(417*3).apply{repeat(3){this[it*417]=255.toByte();this[it*417+1]=251.toByte();this[it*417+2]=144.toByte()}}
    private fun mp4():ByteArray{
        fun box(type:String,body:ByteArray):ByteArray{val out=ByteArrayOutputStream();DataOutputStream(out).use{it.writeInt(body.size+8);it.writeBytes(type);it.write(body)};return out.toByteArray()}
        return box("ftyp","M4A \u0000\u0000\u0000\u0000isom".toByteArray())+box("moov","soun mp4a".toByteArray())+box("mdat",ByteArray(100))
    }
    @Test fun sha256KnownVectorAndBoundedBuffer(){
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",IncrementalCopy.digest("abc".byteInputStream()).sha256)
        var remaining=100L*1024*1024;var maxRead=0
        val input=object:InputStream(){override fun read()=throw AssertionError("single-byte loop");override fun read(b:ByteArray,o:Int,n:Int):Int{
            maxRead=maxOf(maxRead,n);if(remaining==0L)return -1;val count=minOf(remaining,n.toLong()).toInt();b.fill(0,o,o+count);remaining-=count;return count}}
        val copied=IncrementalCopy.digest(input)
        assertEquals(100L*1024*1024,copied.size);assertTrue(maxRead<=65536);assertEquals(64,copied.sha256.length)
    }
    @Test fun importsReopensAndVerifiesExactBytesWithDurableMetadata(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val r=f.engine().import(spec())
        assertEquals("FILE_READY",r.stage);assertEquals(sha(pdf),r.hash);assertArrayEquals(pdf,File(r.uri).readBytes())
        assertFalse(File(r.uri).name.contains("original"));assertEquals(r.hash,f.engine().verify(r.token).sha256)
        assertEquals(r.token,ImportJournal(DiskMetadata(File(f.root,"journal"))).read(r.spec.operationId)!!.token)
    }}
    @Test fun recognizesAllFiveFormatsWithoutDecoder(){
        listOf("epub" to epub(),"pdf" to pdf,"mp3" to mp3(),"m4a" to mp4(),"m4b" to mp4()).forEach{(format,content)->
            BasicMediaValidation.validate(content.inputStream(),format)
            Fixture().use{f->f.backend.sources["source"]={content.inputStream()};assertEquals("FILE_READY",f.engine().import(spec(format=format,size=content.size.toLong())).stage)}
        }
    }
    @Test fun rejectsEmptyWrongExtensionAndRandomBytes(){
        for(format in listOf("epub","pdf","mp3","m4a","m4b")){
            failure("INVALID_FILE"){BasicMediaValidation.validate(byteArrayOf(1,2,3).inputStream(),format)}
        }
        failure("INVALID_FILE"){BasicMediaValidation.validate(epub().inputStream(),"pdf")}
        failure("INVALID_FILE"){BasicMediaValidation.validate(ByteArray(0).inputStream(),"mp3")}
    }
    @Test fun unknownSizeStillUsesObservedSizeAndHash(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val totals=mutableListOf<Long?>()
        val r=f.engine().import(spec(size=null)){_,_,total->totals.add(total)}
        assertEquals(pdf.size.toLong(),r.size);assertTrue(totals.contains(null));assertEquals(sha(pdf),r.hash)
    }}
    @Test fun declaredSizeMismatchAndMissingPdfEofNeverPublishValidFile(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};failure("INTEGRITY_MISMATCH"){f.engine().import(spec(size=1))}
        failure("RECOVERY_REQUIRED"){f.engine().metadata(f.journal.read("operation-1")!!.token)}
        val truncated="%PDF-1.4\ncontent without eof".toByteArray();f.backend.sources["source"]={truncated.inputStream()}
        failure("INVALID_FILE"){f.engine().import(spec("missing-eof",size=truncated.size.toLong()))}
    }}
    @Test fun writeFailureIsRecoverableAndDoesNotDeleteUnknownFiles(){Fixture().use{f->
        val unknown=File(f.root,"personal-untouched").apply{writeText("synthetic unrelated file")}
        f.backend.sources["source"]={pdf.inputStream()};f.backend.failWrite=true
        try{f.engine().import(spec());fail()}catch(_:IOException){}
        val partial=f.journal.read("operation-1")!!;assertTrue(partial.uri.isNotEmpty());assertEquals("RECOVERY_REQUIRED",partial.stage)
        f.backend.failWrite=false;val recovered=f.engine().recover("operation-1")
        assertEquals("FILE_READY",recovered.stage);assertEquals(1,f.backend.creates);assertArrayEquals(pdf,File(recovered.uri).readBytes());assertTrue(unknown.exists())
    }}
    @Test fun readFailureKeepsJournalAndNoAttachmentReady(){Fixture().use{f->
        val large=pdf.copyOf(80000);f.backend.sources["source"]={large.inputStream()};f.backend.failRead=true
        try{f.engine().import(spec(size=large.size.toLong()));fail()}catch(_:IOException){}
        assertEquals("RECOVERY_REQUIRED",f.journal.read("operation-1")!!.stage)
    }}
    @Test fun destinationMismatchIsNotPromotedAndRecoveryRechecksActualDestination(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.corrupt=true
        failure("INTEGRITY_MISMATCH"){f.engine().import(spec())}
        assertEquals("RECOVERY_REQUIRED",f.journal.read("operation-1")!!.stage)
        f.backend.corrupt=false;assertEquals("FILE_READY",f.engine().recover("operation-1").stage)
    }}
    @Test fun processDeathDuringCopyReopensDurableJournalAndRestartsOnlyOwnedFile(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.dieWrite=true
        try{f.engine().import(spec());fail()}catch(_:AssertionError){}
        assertEquals("COPYING",f.journal.read("operation-1")!!.stage)
        f.backend.dieWrite=false;val recovered=f.engine().recover("operation-1")
        assertArrayEquals(pdf,File(recovered.uri).readBytes());assertEquals(1,f.backend.creates)
    }}
    @Test fun processDeathDuringVerificationRecoversWithoutOriginalSource(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.dieVerify=true
        try{f.engine().import(spec());fail()}catch(_:AssertionError){}
        assertEquals("VERIFYING",f.journal.read("operation-1")!!.stage)
        f.backend.dieVerify=false;f.backend.sources.clear()
        assertEquals("FILE_READY",f.engine().recover("operation-1").stage)
    }}
    @Test fun creationCrashWindowNeverAdoptsOrDeletesUnknownDocuments(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.dieCreate=true
        try{f.engine().import(spec());fail()}catch(_:AssertionError){}
        f.backend.dieCreate=false;failure("RECOVERY_REQUIRED"){f.engine().recover("operation-1")}
        failure("RECOVERY_REQUIRED"){f.engine().discard("operation-1")};assertEquals(1,f.backend.creates)
    }}
    @Test fun cancellationClosesCopyAndOnlyExplicitDiscardDeletesOwnedPartial(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val engine=f.engine()
        failure("OPERATION_CANCELLED"){engine.import(spec()){stage,bytes,_->if(stage=="copying"&&bytes>0)engine.cancel("operation-1")}}
        val record=f.journal.read("operation-1")!!;assertNotEquals("FILE_READY",record.stage);assertTrue(File(record.uri).exists())
        engine.discard("operation-1");assertFalse(File(record.uri).exists())
    }}
    @Test fun idempotentImportDoesNotDuplicateFileAndRejectsOperationReuse(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val engine=f.engine();val first=engine.import(spec())
        assertEquals(first.token,engine.import(spec().copy(tree="different-default")).token);assertEquals(1,f.backend.creates)
        failure("OPERATION_CONFLICT"){engine.import(spec().copy(source="another-source"))}
    }}
    @Test fun cancellationAlsoStopsIdempotentReadBackWithoutDowngradingReadyFile(){Fixture().use{f->
        f.backend.sources["source"]={ByteArrayInputStream(pdf)}
        val engine=f.engine();val imported=engine.import(spec())
        engine.cancel("operation-1")
        failure("OPERATION_CANCELLED"){engine.import(spec())}
        assertEquals("FILE_READY",f.journal.read("operation-1")!!.stage)
        assertEquals(imported.token,engine.import(spec()).token)
    }}
    @Test fun unknownSourceRevokedPermissionAndProviderDownStayDistinct(){Fixture().use{f->
        try{f.engine().import(spec());fail()}catch(_:FileNotFoundException){}
        assertEquals("FILE_NOT_FOUND",f.journal.read("operation-1")!!.error)
        f.backend.revoked=true;failure("PERMISSION_REVOKED"){f.engine().import(spec("revoked"))}
        f.backend.revoked=false;f.backend.dead=true;failure("PROVIDER_UNAVAILABLE"){f.engine().import(spec("provider"))}
    }}
    @Test fun managedDeletionIsExplicitIdempotentAndProtectsLinkReceipts(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val engine=f.engine();val r=engine.import(spec())
        failure("INVALID_REFERENCE"){engine.delete("content://arbitrary")}
        failure("RECOVERY_REQUIRED"){engine.complete("operation-1")}
        engine.beginLink("operation-1","{\"technicalReceipt\":\"one\"}")
        failure("ATTACHMENT_CONFLICT"){engine.delete(r.token)};engine.complete("operation-1")
        assertEquals("COMPLETED",f.journal.read("operation-1")!!.stage);assertTrue(File(r.uri).exists())
        val other=engine.import(spec("unlinked"));engine.delete(other.token);engine.delete(other.token);assertFalse(File(other.uri).exists())
        assertTrue(File(r.uri).exists())
    }}
    @Test fun concurrentSameOperationAndDeletionCannotRaceActiveCopy(){Fixture().use{f->
        val entered=CountDownLatch(1);val release=CountDownLatch(1);var calls=0
        f.backend.sources["source"]={calls++;if(calls==3)object:ByteArrayInputStream(pdf){override fun read(b:ByteArray,o:Int,n:Int):Int{
            entered.countDown();assertTrue(release.await(5,TimeUnit.SECONDS));return super.read(b,o,n)}}else pdf.inputStream()}
        val engine=f.engine();val pool=Executors.newSingleThreadExecutor()
        try{val first=pool.submit<ImportRecord>{engine.import(spec())};assertTrue(entered.await(5,TimeUnit.SECONDS))
            failure("OPERATION_CONFLICT"){engine.import(spec())}
            failure("OPERATION_CONFLICT"){engine.delete(f.journal.read("operation-1")!!.token)}
            release.countDown();assertEquals("FILE_READY",first.get(5,TimeUnit.SECONDS).stage)
        }finally{release.countDown();pool.shutdownNow()}
    }}
    @Test fun creationIntentContainsFingerprintAndParentBeforePhysicalCreation(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.dieCreate=true
        try{f.engine().import(spec());fail()}catch(_:AssertionError){}
        val intent=f.journal.read("operation-1")!!
        assertEquals("CREATING",intent.stage);assertEquals("",intent.uri)
        assertEquals(sha(pdf),intent.expectedHash);assertEquals(pdf.size.toLong(),intent.expectedSize)
        assertTrue(intent.parent.isNotEmpty());assertEquals(1,f.backend.creates)
        // A complete candidate can be adopted only after membership, size and hash validation.
        val candidate=File(intent.parent,"${intent.token}.pdf");candidate.writeBytes(pdf)
        f.backend.dieCreate=false;f.backend.sources.clear()
        val recovered=f.engine().recover("operation-1")
        assertEquals(candidate.path,recovered.uri);assertEquals("FILE_READY",recovered.stage)
        assertEquals(recovered.token,f.engine().recover("operation-1").token);assertEquals(1,f.backend.creates)
    }}
    @Test fun ambiguousRenamedUnavailableOrCorruptCandidatesRemainProtected(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.backend.dieCreate=true
        try{f.engine().import(spec());fail()}catch(_:AssertionError){}
        f.backend.dieCreate=false
        val intent=f.journal.read("operation-1")!!;val candidate=File(intent.parent,"${intent.token}.pdf")
        candidate.writeBytes(pdf);f.backend.ambiguous=true
        failure("RECOVERY_REQUIRED"){f.engine().recover("operation-1")}
        f.backend.ambiguous=false;f.backend.renamed=true
        failure("RECOVERY_REQUIRED"){f.engine().recover("operation-1")}
        f.backend.renamed=false;f.backend.listingUnavailable=true
        failure("PROVIDER_UNAVAILABLE"){f.engine().recover("operation-1")}
        f.backend.listingUnavailable=false;candidate.writeText("unknown")
        failure("RECOVERY_REQUIRED"){f.engine().recover("operation-1")}
        failure("RECOVERY_REQUIRED"){f.engine().discard("operation-1")}
        assertTrue(candidate.exists());assertEquals(1,f.backend.creates)
    }}
    @Test fun failedIntentWritePreventsDocumentCreation(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()}
        val broken=object:MetadataFiles{
            override fun read(key:String)=f.metadata.read(key)
            override fun keys()=f.metadata.keys()
            override fun write(key:String,bytes:ByteArray){throw IOException("synthetic journal unavailable")}
        }
        try{DigitalStorageEngine(ImportJournal(broken),f.backend).import(spec());fail()}catch(_:IOException){}
        assertEquals(0,f.backend.creates)
    }}
    @Test fun uriJournalWriteFailureCanBeReopenedWithoutDuplicatingOrDeletingEmptyCandidate(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()}
        var writes=0
        val broken=object:MetadataFiles{
            override fun read(key:String)=f.metadata.read(key)
            override fun keys()=f.metadata.keys()
            override fun write(key:String,bytes:ByteArray){writes++;if(writes>=3)throw IOException("synthetic journal unavailable");f.metadata.write(key,bytes)}
        }
        try{DigitalStorageEngine(ImportJournal(broken),f.backend).import(spec());fail()}catch(_:IOException){}
        assertEquals("CREATING",f.journal.read("operation-1")!!.stage)
        failure("RECOVERY_REQUIRED"){f.engine().recover("operation-1")};assertEquals(1,f.backend.creates)
    }}
    @Test fun concurrentIndependentImportsAndJournalSnapshotsRemainReadable(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val engine=f.engine();val pool=Executors.newFixedThreadPool(3)
        try{
            val a=pool.submit<ImportRecord>{engine.import(spec("parallel-a"))}
            val b=pool.submit<ImportRecord>{engine.import(spec("parallel-b"))}
            val snapshots=pool.submit{repeat(40){engine.all()}}
            assertEquals("FILE_READY",a.get(5,TimeUnit.SECONDS).stage)
            assertEquals("FILE_READY",b.get(5,TimeUnit.SECONDS).stage);snapshots.get(5,TimeUnit.SECONDS)
            assertEquals(2,engine.all().size);assertEquals(2,engine.all().map{it.token}.distinct().size)
            val c=pool.submit<ImportRecord>{engine.recover("parallel-a")}
            val d=pool.submit<ImportRecord>{engine.recover("parallel-b")}
            assertEquals("FILE_READY",c.get(5,TimeUnit.SECONDS).stage);assertEquals("FILE_READY",d.get(5,TimeUnit.SECONDS).stage)
        }finally{pool.shutdownNow()}
    }}
    @Test fun versionOneJournalReopensAndUpgradesWithoutChangingIdentity(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};val first=f.engine().import(spec())
        val file=File(f.metadata.root,f.metadata.keys().single());val bytes=file.readBytes()
        // Version 1 ends after updatedAt; v2 appends expected size and SHA-256.
        val legacy=bytes.copyOf(bytes.size-8-2-64);java.nio.ByteBuffer.wrap(legacy).putInt(1);file.writeBytes(legacy)
        assertEquals("",f.journal.read("operation-1")!!.expectedHash)
        val reopened=f.engine().recover("operation-1");assertEquals(first.token,reopened.token);assertEquals(first.hash,reopened.hash)
        f.engine().beginLink("operation-1","technical-receipt");assertEquals(2,java.nio.ByteBuffer.wrap(file.readBytes()).int)
    }}
    @Test fun failureBeforeIntentNeverCreatesAndRecoveryIsIdempotent(){checkpointRecovery("before-intent")}
    @Test fun failureAfterCopyRecopiesOnlyKnownDocument(){checkpointRecovery("after-copy")}
    @Test fun failureBeforeReadyRecoversVerifiedBytesWithoutDuplicating(){checkpointRecovery("before-ready")}
    private fun checkpointRecovery(point:String){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()}
        val engine=DigitalStorageEngine(f.journal,f.backend,checkpoint={if(it==point)throw StorageFailure("RECOVERY_REQUIRED")})
        failure("RECOVERY_REQUIRED"){engine.import(spec())}
        assertEquals(if(point=="before-intent")0 else 1,f.backend.creates)
        val recovered=f.engine().recover("operation-1");assertEquals("FILE_READY",recovered.stage)
        assertEquals(recovered.token,f.engine().recover("operation-1").token);assertEquals(1,f.backend.creates)
    }}
    @Test fun corruptedJournalFailsClosed(){Fixture().use{f->
        f.backend.sources["source"]={pdf.inputStream()};f.engine().import(spec())
        f.metadata.keys().forEach{File(f.metadata.root,it).writeBytes(byteArrayOf(0,0,0,99))}
        failure("RECOVERY_REQUIRED"){f.engine().all()}
    }}
}
