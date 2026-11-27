"""Publish signed APK and update metadata atomically through a GitHub draft release."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

repo = os.environ["GITHUB_REPOSITORY"]
if not re.fullmatch(r"[\w.-]+/[\w.-]+", repo):
    raise SystemExit("Invalid GitHub repository")
def gh(*args):
    # Repository view takes the repository as a positional argument.
    # Release commands instead accept the --repo option.
    if args[:2] == ("repo", "view"):
        command = ["gh", "repo", "view", repo, *args[2:]]
    else:
        command = ["gh", *args, "--repo", repo]
    return subprocess.check_output(command, text=True)
def publish():
    if json.loads(gh("repo", "view", "--json", "visibility"))["visibility"] != "PUBLIC":
        raise SystemExit("Token-free updates require a public release repository.")
    release = json.loads(Path("release.json").read_text(encoding="utf-8"))
    code = int(release.get("androidVersionCode", release["build"]))
    apk = Path("mobile/android/app/build/outputs/apk/internal/app-internal.apk")
    if not 0 < apk.stat().st_size <= 100 * 1024 * 1024:
        raise SystemExit("APK exceeds native updater size limit")
    existing = json.loads(gh("release", "list", "--limit", "100", "--json", "tagName,isDraft,isPrerelease"))
    codes = [int(m.group(1)) for r in existing if not r["isDraft"] and (m := re.fullmatch(r"android-(\d+)", r["tagName"]))]
    if codes and code <= max(codes):
        raise SystemExit("Version code must exceed all published Android releases.")
    tag = f"android-{code}"
    sha = hashlib.file_digest(apk.open("rb"), "sha256").hexdigest()
    notes = "\n".join(release["releases"][0]["changes"])
    row = dict(version_code=code,version_name=release["version"],apk_url=f"https://github.com/{repo}/releases/download/{tag}/DayLoop.apk",
        sha256=sha,notes=notes,force_update=False,min_supported_code=1)
    body = notes + "\n\n<!-- dayloop-update: " + json.dumps(row, ensure_ascii=True).replace("--","\\u002d\\u002d") + " -->\n"
    with tempfile.TemporaryDirectory() as directory:
        folder=Path(directory)
        shutil.copyfile(apk, folder/"DayLoop.apk")
        (folder/"update.json").write_text(json.dumps(row,indent=2),encoding="utf-8")
        (folder/"notes.md").write_text(body,encoding="utf-8")
        gh("release","create",tag,"--draft","--target",os.environ["GITHUB_SHA"],"--title",f"DayLoop {release['version']}","--notes-file",str(folder/"notes.md"))
        gh("release","upload",tag,str(folder/"DayLoop.apk"),str(folder/"update.json"))
        check=folder/"verify"
        check.mkdir()
        gh("release","download",tag,"--pattern","DayLoop.apk","--dir",str(check))
        with (check/"DayLoop.apk").open("rb") as stream:
            if hashlib.file_digest(stream,"sha256").hexdigest()!=sha:
                raise SystemExit("Uploaded checksum mismatch; release remains draft")
        gh("release","edit",tag,"--draft=false","--latest")
        print(f"Published verified Android build {code}")

if __name__ == "__main__":
    publish()
