# BookNook Proguard Rules
-keepattributes *Annotation*
-keepclassmembers class com.booknookapp.MainActivity$AndroidBridge {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
