// Android App Bundle & APK Configuration
// minSdk = 24 (Google Play automatic integrity protection requires SDK 24+)
// targetSdk = 36
// compileSdk = 36

tasks.register<Exec>("assembleDebug") {
    commandLine("npm", "run", "build")
}

tasks.register<Exec>("lint") {
    commandLine("npm", "run", "lint")
}
