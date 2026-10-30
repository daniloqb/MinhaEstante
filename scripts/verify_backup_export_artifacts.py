"""Independent, read-only CRC/SHA check of operation-owned synthetic exports; never extracts entries."""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(sys.argv[1]).resolve()
assert re.fullmatch(r"/tmp/minhaestante-4-2b-[a-z0-9-]+", str(root))
assert (root / "synthetic-export-root.json").is_file()
reports = []
for archive in sorted(root.glob("backup-*.zip")):
    assert re.fullmatch(r"backup-[a-f0-9-]{36}\.zip", archive.name)
    assert not archive.is_symlink()
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        assert len(names) == len(set(names))
        assert z.getinfo("manifest.json").file_size <= 1024 * 1024
        manifest = json.loads(z.read("manifest.json"))
        assert manifest["format"] == "minhaestante-backup" and manifest["backupVersion"] == 2
        descriptors = [manifest["bibliography"], manifest["reading"], *manifest["covers"],
                       *[m for m in manifest["media"] if m["state"] == "included"]]
        assert set(names) == {"manifest.json", *[d["archivePath"] for d in descriptors]}
        for descriptor in descriptors:
            entry = z.getinfo(descriptor["archivePath"])
            assert entry.file_size == descriptor["sizeBytes"]
            digest = hashlib.sha256()
            with z.open(entry) as stream:
                while chunk := stream.read(65536):
                    digest.update(chunk)  # zipfile also validates CRC when the entry reaches EOF.
            assert digest.hexdigest() == descriptor["sha256"]
        books = json.loads(z.read("books.json"))
        reading = json.loads(z.read("reading.json"))
        uuids = {b["uuid"] for b in books}
        included = {m["id"] for m in manifest["media"] if m["state"] == "included"}
        assert len(uuids) == len(books) == manifest["counts"]["books"]
        assert all(m["bookUuid"] in uuids for m in manifest["media"])
        assert all(p["attachmentId"] in included for p in reading["readerPositions"])
        assert all(s["bookUuid"] in uuids for s in reading["sessions"])
        session_ids = {s["id"] for s in reading["sessions"]}
        assert all(p["sessionId"] in session_ids for p in reading["progress"])
        # No physical storage fields may leak into the portable media manifest.
        assert all(not {"storageReference", "storageProvider", "bookId", "uri"}.intersection(m) for m in manifest["media"])
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        while chunk := stream.read(65536):
            digest.update(chunk)
    reports.append({"operationId": manifest["backupId"], "bytes": archive.stat().st_size,
                    "sha256": digest.hexdigest(), "entries": len(names), "crcAndPayloadHashes": True})
assert reports, "No synthetic archives found"
(root / "independent-verification.json").write_text(json.dumps(reports, indent=2))
print(json.dumps({"verifiedArchives": len(reports), "crcAndPayloadHashes": True}))
