#!/usr/bin/env bash
# 无 Android Studio 打包：aapt2 -> javac -> d8 -> 塞 dex -> zipalign -> apksigner
#
# 依赖：JDK（javac/java）、python、Android SDK build-tools + platform android.jar
# 用法：
#   export ANDROID_BUILD_TOOLS=/path/to/build-tools/34.0.0     # 含 aapt2/d8/zipalign/apksigner
#   export ANDROID_JAR=/path/to/platforms/android-34/android.jar
#   export DORM_KS=path/to/your.jks                            # 可选，默认 ../keystore/release.jks
#   export DORM_KS_ALIAS=dorm
#   export DORM_KS_PASS=****                                   # 必填，不要写进仓库
#   bash build.sh [版本号，如 v3.1]
set -e
cd "$(dirname "$0")"

: "${ANDROID_BUILD_TOOLS:?请先 export ANDROID_BUILD_TOOLS（build-tools 目录）}"
: "${ANDROID_JAR:?请先 export ANDROID_JAR（android.jar 路径）}"
: "${DORM_KS_PASS:?请先 export DORM_KS_PASS（签名密码，不要提交到仓库）}"

SDKB="$ANDROID_BUILD_TOOLS"
AJAR="$ANDROID_JAR"
KS="${DORM_KS:-../keystore/release.jks}"
KS_ALIAS="${DORM_KS_ALIAS:-dorm}"
OUT="build"
ROOT=".."
VER="${1:-v3.2}"

# 兼容 Windows（.exe/.bat）与 macOS/Linux（无后缀）
pick(){ for c in "$SDKB/$1.exe" "$SDKB/$1.bat" "$SDKB/$1"; do [ -e "$c" ] && { printf '%s' "$c"; return; }; done; printf '%s' "$SDKB/$1"; }
AAPT2=$(pick aapt2); ZIPALIGN=$(pick zipalign); APKSIGNER=$(pick apksigner)

rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/classes" "$OUT/dex"

# 1) 页面资源（单文件应用：所有数据与逻辑都内联在 HTML 里）
cp "$ROOT/index.html" assets/index.html

# 2) 资源编译
"$AAPT2" compile --dir res -o "$OUT/res.zip"
"$AAPT2" link -o "$OUT/base.apk" -I "$AJAR" \
  --manifest AndroidManifest.xml -A assets \
  --min-sdk-version 24 --target-sdk-version 34 "$OUT/res.zip"

# 3) Java 编译
javac -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$AJAR" -classpath "$AJAR" \
  -d "$OUT/classes" $(find src -name "*.java")

# 4) dex
java -cp "$SDKB/lib/d8.jar" com.android.tools.r8.D8 --min-api 24 --lib "$AJAR" \
  --output "$OUT/dex" $(find "$OUT/classes" -name "*.class")

# 5) 把 classes.dex 塞进 apk
python - "$OUT/base.apk" "$OUT/dex/classes.dex" "$OUT/unsigned.apk" <<'PY'
import sys, zipfile
src, dex, dst = sys.argv[1], sys.argv[2], sys.argv[3]
zin = zipfile.ZipFile(src, "r")
zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    if it.filename == "classes.dex":
        continue
    zout.writestr(it, zin.read(it.filename), it.compress_type)
zout.write(dex, "classes.dex", zipfile.ZIP_DEFLATED)
zout.close(); zin.close()
PY

# 6) 对齐 + 签名（先输出 ASCII 名，再用 python 改回中文名，避免 Git Bash 把中文名按 GBK 落盘）
"$ZIPALIGN" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$APKSIGNER" sign --ks "$KS" --ks-pass "pass:$DORM_KS_PASS" \
  --ks-key-alias "$KS_ALIAS" --out "$OUT/signed.apk" "$OUT/aligned.apk"
python - "$OUT/signed.apk" "$ROOT" "$VER" <<'PY'
import sys, shutil, os
src, root, ver = sys.argv[1], sys.argv[2], sys.argv[3]
dst = os.path.join(root, "寝室餐食助手-%s.apk" % ver)
shutil.copyfile(src, dst)
print("WROTE", os.path.abspath(dst), os.path.getsize(dst))
PY
"$APKSIGNER" verify --print-certs "$OUT/signed.apk" | head -4
echo "OK -> 寝室餐食助手-$VER.apk"
