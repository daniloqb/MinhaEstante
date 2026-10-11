plugins {
    id("com.android.application")
}

android {
    namespace = "com.booknookapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.booknookapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 15
        versionName = "1.0.15"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val envKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH") ?: rootProject.file("../booknook-release-key.jks").absolutePath
            val envKeystorePass = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "booknook123"
            val envKeyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "booknook"

            val ksFile = file(envKeystorePath)
            if (ksFile.exists()) {
                storeFile = ksFile
                storePassword = envKeystorePass
                keyAlias = envKeyAlias
                keyPassword = envKeystorePass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.core:core:1.12.0")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("com.google.android.material:material:1.11.0")
}
