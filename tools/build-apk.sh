#!/usr/bin/env bash
# 一条命令打包 APK：工具链、签名参数都放在仓库外，仓库里不留任何密钥。
#
#   bash tools/build-apk.sh            # 版本号取 index.html 的 APP_VER
#   bash tools/build-apk.sh 3.10       # 或显式指定
#
# 依赖两份仓库外的配置（都在本机，不进 git）：
#   ~/.dormmeal/secret.env    DORM_KS_PASS=...（必须）；DORM_KS=...（可选）
#   /d/workbuddyhuancun/toolchain/android-sdk   build-tools + android.jar
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

CONF="${DORM_ENV:-$HOME/.dormmeal/secret.env}"
if [ -f "$CONF" ]; then set -a; . "$CONF"; set +a; fi

SDK="${ANDROID_SDK:-/d/workbuddyhuancun/toolchain/android-sdk}"
export ANDROID_BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-$SDK/android-14}"
export ANDROID_JAR="${ANDROID_JAR:-$SDK/android-34/android.jar}"
export DORM_KS="${DORM_KS:-$ROOT/_apk/dorm-release.jks}"

if [ -z "${DORM_KS_PASS:-}" ]; then
  echo "✗ 缺签名密码：在 $CONF 里写一行 DORM_KS_PASS=你的密码" >&2
  exit 1
fi
[ -x "$ANDROID_BUILD_TOOLS/aapt2.exe" ] || [ -x "$ANDROID_BUILD_TOOLS/aapt2" ] || {
  echo "✗ 找不到 build-tools：$ANDROID_BUILD_TOOLS" >&2; exit 1; }

APPVER=$(sed -n 's/.*const APP_VER="\([0-9.]*\)".*/\1/p' index.html | head -1)
V="${1:-$APPVER}"; V="${V#v}"
node tools/check-version.mjs >/dev/null || { node tools/check-version.mjs; exit 1; }

bash _apk/build.sh "v$V"
ls -la "$ROOT/寝室餐食助手-v$V.apk"
