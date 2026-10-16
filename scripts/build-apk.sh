#!/bin/sh
set -eu

cd "$(dirname "$0")/../app"

command -v npm >/dev/null 2>&1 || { echo 'Instale Node.js e npm.'; exit 1; }
[ -d node_modules ] || { echo 'Execute primeiro: cd app && npm install'; exit 1; }

# Respect an explicit JAVA_HOME; otherwise prefer the JDK 21 installed by Homebrew.
if [ -z "${JAVA_HOME:-}" ] && command -v brew >/dev/null 2>&1; then
    jdk_prefix=$(brew --prefix openjdk@21 2>/dev/null || true)
    if [ -x "$jdk_prefix/bin/java" ]; then
        JAVA_HOME=$jdk_prefix
        export JAVA_HOME
    fi
fi
java_bin=java
if [ -n "${JAVA_HOME:-}" ]; then java_bin="$JAVA_HOME/bin/java"; fi
java_version=$("$java_bin" -version 2>&1) || { echo 'Instale JDK 21 e configure JAVA_HOME.'; exit 1; }
case "$java_version" in
    *'version "21.'*) ;;
    *) echo 'Use JDK 21: JAVA_HOME=/caminho/do/jdk-21 make apk'; exit 1 ;;
esac

if [ ! -f android/local.properties ] && [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    echo 'Configure ANDROID_HOME para o Android SDK (SDK Platform 35 e Build-Tools).'
    exit 1
fi

npm run cap:sync
cd android
# Recreate the app package: incremental APK updates can retain space from old assets.
./gradlew --console=plain :app:clean :app:assembleDebug
printf '\nAPK pronto: %s/app/build/outputs/apk/debug/app-debug.apk\n' "$PWD"
