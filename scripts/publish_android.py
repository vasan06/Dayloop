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
    version = release["version"]
    if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", version):
        raise SystemExit("Invalid semantic version")
    tag = f"v{version}"
    if any(r["tagName"] == tag for r in existing):
        raise SystemExit("Release tag already exists. Increment the product version before publishing.")
    codes = []
    versions = []
    for r in existing:
        if r["isDraft"] or r["isPrerelease"]:
            continue
        old_tag = r["tagName"]
        if m := re.fullmatch(r"android-(\d+)", old_tag):
            codes.append(int(m.group(1)))
        elif not re.fullmatch(r"v\d+\.\d+\.\d+", old_tag):
            continue
        info = json.loads(gh("release", "view", old_tag, "--json", "body,assets"))
        if not any(asset["name"] == "DayLoop.apk" for asset in info["assets"]):
            continue
        match = re.search(r"<!-- dayloop-update:\s*(.*?)\s*-->", info["body"], re.S)
        if not match:
            raise SystemExit(f"Missing update metadata on {old_tag}; restore it before publishing.")
        previous = json.loads(match.group(1))
        codes.append(int(previous["version_code"]))
        versions.append(tuple(map(int, previous["version_name"].split("."))))
    if codes and code <= max(codes):
        raise SystemExit("Version code must exceed all published Android releases.")
    if versions and tuple(map(int, version.split("."))) <= max(versions):
        raise SystemExit("Increment the semantic product version before publishing.")
    sha = hashlib.file_digest(apk.open("rb"), "sha256").hexdigest()
    notes = "\n".join(release["releases"][0]["changes"])
    row = dict(version_code=code,version_name=release["version"],product_build=release["build"],apk_url=f"https://github.com/{repo}/releases/download/{tag}/DayLoop.apk",
        sha256=sha,notes=notes,force_update=False,min_supported_code=1)
    body = "## What is new\n\n" + "\n".join("- " + line for line in notes.splitlines()) + "\n\n<!-- dayloop-update: " + json.dumps(row, ensure_ascii=True).replace("--","\u002d\u002d") + " -->\n"
    with tempfile.TemporaryDirectory() as directory:
        folder=Path(directory)
        shutil.copyfile(apk, folder/"DayLoop.apk")
        (folder/"update.json").write_text(json.dumps(row,indent=2),encoding="utf-8")
        (folder/"notes.md").write_text(body,encoding="utf-8")
        gh("release","create",tag,"--draft","--target",os.environ["GITHUB_SHA"],"--title",f"DayLoop v{version} — Build {release['build']}","--notes-file",str(folder/"notes.md"))
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
