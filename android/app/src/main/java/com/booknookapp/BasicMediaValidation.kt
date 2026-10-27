package com.booknookapp

import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream

/** Structural identification only, not a decoder, full document validator or DRM support. */
internal object BasicMediaValidation {
    private fun invalid(): Nothing = throw StorageFailure("INVALID_FILE")
    private fun bytes(input: InputStream, count: Int): ByteArray {
        val out=ByteArray(count); var offset=0
        while(offset<count) { val n=input.read(out,offset,count-offset); if(n<0)invalid(); if(n>0)offset+=n }
        return out
    }
    private fun skip(input: InputStream, count: Long, stop: ()->Boolean) {
        var remaining=count; val buffer=ByteArray(64*1024)
        while(remaining>0) {
            if(stop())throw StorageFailure("OPERATION_CANCELLED")
            val n=input.skip(minOf(remaining,65536L))
            if(n>0)remaining-=n else { val read=input.read(buffer,0,minOf(remaining,buffer.size.toLong()).toInt()); if(read<0)invalid(); remaining-=read }
        }
    }
    fun validate(input: InputStream, format: String, stop: ()->Boolean = {false}) {
        if(stop())throw StorageFailure("OPERATION_CANCELLED")
        when(format) {
            "epub"->epub(input,stop)
            "pdf"->{
                val header=ByteArray(1024); var length=0
                while(length<header.size){val n=input.read(header,length,header.size-length);if(n<0)break;if(n>0)length+=n}
                if(!Regex("%PDF-[12]\\.[0-9]").containsMatchIn(header.copyOf(length).toString(Charsets.ISO_8859_1)))invalid()
            }
            "mp3"->mp3(input,stop)
            "m4a","m4b"->mp4(input,stop)
            else->throw StorageFailure("UNSUPPORTED_FORMAT")
        }
    }
    private fun epub(input: InputStream, stop: ()->Boolean) {
        ZipInputStream(input).use { zip ->
            var budget=2*1024*1024; var mimetype=false; var rootfile=""; var packageFound=false
            val buffer=ByteArray(8192)
            repeat(256) { index ->
                if(stop())throw StorageFailure("OPERATION_CANCELLED")
                val entry=zip.nextEntry ?: invalid()
                val metadata=entry.name=="mimetype" || entry.name=="META-INF/container.xml" || entry.name==rootfile
                val text=ByteArrayOutputStream()
                while(true) {
                    val n=zip.read(buffer); if(n<0)break
                    budget-=n; if(budget<0)invalid()
                    if(metadata){if(text.size()+n>512*1024)invalid();text.write(buffer,0,n)}
                    if(stop())throw StorageFailure("OPERATION_CANCELLED")
                }
                val value=text.toString("UTF-8")
                if(index==0) { if(entry.name!="mimetype" || entry.method!=0 || value!="application/epub+zip")invalid();mimetype=true }
                if(entry.name=="META-INF/container.xml") {
                    if(!value.contains("container"))invalid()
                    rootfile=Regex("full-path\\s*=\\s*['\"]([^'\"]+\\.opf)['\"]").find(value)?.groupValues?.get(1) ?: invalid()
                }
                if(rootfile.isNotEmpty() && entry.name==rootfile) packageFound=value.contains(Regex("<(?:[\\w-]+:)?package[\\s>]"))
                if(mimetype && packageFound)return
            }
            invalid()
        }
    }
    private fun mp3(input: InputStream, stop: ()->Boolean) {
        var header=bytes(input,4)
        if(header.copyOfRange(0,3).toString(Charsets.US_ASCII)=="ID3") {
            val rest=bytes(input,6)
            val tag=rest.copyOfRange(2,6)
            if(tag.any { it.toInt() and 128 != 0 })invalid()
            var size=0L;tag.forEach{size=(size shl 7)+(it.toInt() and 127)}
            skip(input,size + if(rest[1].toInt() and 16 != 0)10 else 0,stop)
            header=bytes(input,4)
        }
        fun frame(h: ByteArray): Pair<Int,Int> {
            val a=h[0].toInt()and 255;val b=h[1].toInt()and 255;val c=h[2].toInt()and 255
            val version=(b shr 3)and 3;val layer=(b shr 1)and 3;val bitrate=(c shr 4)and 15;val rate=(c shr 2)and 3
            if(a!=255 || b and 224 !=224 || version==1 || layer!=1 || bitrate !in 1..14 || rate==3)invalid()
            val rates=intArrayOf(44100,48000,32000)
            val hz=rates[rate]/if(version==3)1 else if(version==2)2 else 4
            val br=if(version==3)intArrayOf(0,32,40,48,56,64,80,96,112,128,160,192,224,256,320)[bitrate]
                else intArrayOf(0,8,16,24,32,40,48,56,64,80,96,112,128,144,160)[bitrate]
            return Pair((if(version==3)144000 else 72000)*br/hz+((c shr 1)and 1),hz)
        }
        val first=frame(header);skip(input,(first.first-4).toLong(),stop)
        val second=frame(bytes(input,4));if(first.second!=second.second)invalid()
    }
    private fun mp4(input: InputStream, stop: ()->Boolean) {
        var ftyp=false;var audio=false;var media=false
        repeat(128){
            if(stop())throw StorageFailure("OPERATION_CANCELLED")
            val h=bytes(input,8)
            fun u32(b: ByteArray): Long = b.fold(0L){v,c->(v shl 8)+(c.toInt()and 255)}
            var size=u32(h.copyOfRange(0,4));var header=8
            val type=h.copyOfRange(4,8).toString(Charsets.US_ASCII)
            if(size==1L){val large=bytes(input,8);if(large[0].toInt()and 128!=0)invalid();size=u32(large.copyOfRange(0,4))*4294967296L+u32(large.copyOfRange(4,8));header=16}
            if(size<header || (it==0 && type!="ftyp"))invalid()
            val payload=size-header
            when(type){
                "ftyp"->{if(payload !in 8..4096)invalid();val brands=bytes(input,payload.toInt()).toString(Charsets.ISO_8859_1);if(!listOf("M4A ","M4B ","isom","mp41","mp42","qt  ").any(brands::contains))invalid();ftyp=true}
                "moov"->{if(payload>2*1024*1024)invalid();val moov=bytes(input,payload.toInt()).toString(Charsets.ISO_8859_1);audio=moov.contains("soun")&&(moov.contains("mp4a")||moov.contains("alac"))}
                "mdat"->{if(payload<=0)invalid();media=true; if(audio&&ftyp)return;skip(input,payload,stop)}
                else->skip(input,payload,stop)
            }
            if(ftyp&&audio&&media)return
        }
        invalid()
    }
}
