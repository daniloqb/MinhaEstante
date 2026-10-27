package com.booknookapp

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaExtractor
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.util.zip.CRC32

/** Synthetic sources only. Invoked exclusively by the native DEV gate; never bundled personal media. */
internal object DigitalStorageDevFixtures {
    fun generate(root: File, large: Boolean, different: Boolean = false): List<File> {
        root.mkdirs()
        val epub=File(root,"synthetic.epub")
        ZipOutputStream(FileOutputStream(epub)).use { z ->
            fun entry(name: String, value: String, stored: Boolean=false) {
                val bytes=value.toByteArray();val e=ZipEntry(name)
                if(stored){e.method=ZipEntry.STORED;e.size=bytes.size.toLong();e.compressedSize=e.size;e.crc=CRC32().apply{update(bytes)}.value}
                z.putNextEntry(e);z.write(bytes);z.closeEntry()
            }
            entry("mimetype","application/epub+zip",true)
            entry("META-INF/container.xml","""<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            entry("content.opf","""<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:39e9f124-5e25-4a60-ac0c-bec2a7f909e6</dc:identifier><dc:title>Synthetic test</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">2026-10-25T00:00:00Z</meta></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>""")
            entry("chapter.xhtml","""<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Test</title></head><body><p>Synthetic SAF source ${if(different) "second edition" else "first edition"}.</p></body></html>""")
            entry("nav.xhtml","""<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Test</a></li></ol></nav></body></html>""")
        }
        val pdf=File(root,"synthetic.pdf");pdf(pdf,if(different)128 else 0)
        val mp3=File(root,"synthetic.mp3")
        FileOutputStream(mp3).use { out ->
            // MPEG-1 Layer III: 128 kbit/s, 44.1 kHz stereo; zero side-info/main-data decodes to silence.
            val frame=ByteArray(417);frame[0]=0xff.toByte();frame[1]=0xfb.toByte();frame[2]=0x90.toByte()
            repeat(if(different)120 else 100){out.write(frame)}
        }
        val m4a=File(root,"synthetic.m4a");aac(m4a,different)
        val m4b=File(root,"synthetic.m4b");m4a.inputStream().use{input->m4b.outputStream().use{output->IncrementalCopy.digest(input,output)}}
        listOf(mp3,m4a,m4b).forEach { file ->
            val extractor=MediaExtractor()
            try {extractor.setDataSource(file.path);if(extractor.trackCount<1 || !extractor.getTrackFormat(0).getString(MediaFormat.KEY_MIME).orEmpty().startsWith("audio/"))throw StorageFailure("INVALID_FILE")}
            finally{extractor.release()}
        }
        val invalid=File(root,"invalid.epub");invalid.writeText("synthetic invalid document")
        val wrong=File(root,"wrong-extension.pdf");epub.inputStream().use{input->wrong.outputStream().use{output->IncrementalCopy.digest(input,output)}}
        return mutableListOf(epub,pdf,mp3,m4a,m4b,invalid,wrong).apply {
            if(large)add(File(root,"synthetic-large.pdf").also{pdf(it,100L*1024*1024)})
        }
    }
    private fun pdf(file: File, padding: Long) {
        FileOutputStream(file).use { out ->
            fun text(s: String){out.write(s.toByteArray(Charsets.US_ASCII))}
            val offsets=mutableListOf<Long>(0)
            text("%PDF-1.4\n")
            fun objectText(s: String){val i=offsets.size;offsets.add(out.channel.position());text("$i 0 obj\n$s\nendobj\n")}
            objectText("<< /Type /Catalog /Pages 2 0 R >>")
            objectText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
            objectText("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
            objectText("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
            val content="BT /F1 12 Tf 30 150 Td (Synthetic SAF test) Tj ET"
            objectText("<< /Length ${content.length} >>\nstream\n$content\nendstream")
            if(padding>0){offsets.add(out.channel.position());text("6 0 obj\n<< /Length $padding >>\nstream\n");val block=ByteArray(65536);var left=padding
                while(left>0){val n=minOf(left,block.size.toLong()).toInt();out.write(block,0,n);left-=n};text("\nendstream\nendobj\n")}
            val xref=out.channel.position();text("xref\n0 ${offsets.size}\n0000000000 65535 f \n")
            offsets.drop(1).forEach{text("%010d 00000 n \n".format(it))}
            text("trailer\n<< /Size ${offsets.size} /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n")
        }
    }
    private fun aac(file: File, different: Boolean = false) {
        val codec=MediaCodec.createEncoderByType("audio/mp4a-latm")
        val muxer=MediaMuxer(file.path,MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var started=false
        try {
            val format=MediaFormat.createAudioFormat("audio/mp4a-latm",44100,1)
            format.setInteger(MediaFormat.KEY_AAC_PROFILE,MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            format.setInteger(MediaFormat.KEY_BIT_RATE,64000)
            codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);codec.start()
            var sent=0;var inputEnded=false;var outputEnded=false;var track=-1;var attempts=0
            val info=MediaCodec.BufferInfo();val silence=ByteArray(2048)
            while(!outputEnded && attempts++<2000) {
                if(!inputEnded){val index=codec.dequeueInputBuffer(10000)
                    if(index>=0){val buffer=codec.getInputBuffer(index)!!;buffer.clear();val count=if(sent>=(if(different)32768 else 16384))0 else minOf(buffer.remaining(),silence.size)
                        if(count>0)buffer.put(silence,0,count)
                        codec.queueInputBuffer(index,0,count,sent.toLong()*1000000/(44100*2),if(count==0)MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0)
                        sent+=count;if(count==0)inputEnded=true}}
                val index=codec.dequeueOutputBuffer(info,10000)
                if(index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){track=muxer.addTrack(codec.outputFormat);muxer.start();started=true}
                else if(index>=0){val buffer=codec.getOutputBuffer(index)!!
                    if(info.size>0 && info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG==0){if(!started)throw StorageFailure("OPERATION_FAILED");buffer.position(info.offset);buffer.limit(info.offset+info.size);muxer.writeSampleData(track,buffer,info)}
                    outputEnded=info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM!=0;codec.releaseOutputBuffer(index,false)}
            }
            if(!outputEnded)throw StorageFailure("OPERATION_FAILED")
        } finally { try{codec.stop()}finally{codec.release();if(started)muxer.stop();muxer.release()} }
    }
}
