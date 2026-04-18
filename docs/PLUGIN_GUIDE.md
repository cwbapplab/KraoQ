# KraoQ Source Plugin Architecture

KraoQ uses a decoupled plugin architecture to source karaoke materials. Instead of natively downloading from YouTube or Spotify, KraoQ relies on simple, executable "Source Plugins." 

A Plugin is any executable file (`.exe`, `.py` run via python, `.js` run via node, `.sh`, etc.) that obeys a specific CLI contract for outputting JSON.

## Plugin Contract

Your plugin must accept arguments via the command line and print valid JSON to `stdout`. All other logs or debugging information should be printed to `stderr` or written to a log file, but `stdout` must be pure JSON.

### 1. `search`
Triggered when the user types in the search bar.
**Command:**
```bash
./your_plugin search "Query String"
```
**Expected Output (`stdout`):**
A JSON array of objects representing search results.
```json
[
  {
    "id": "unique-song-id-1234",
    "title": "Song Title",
    "artists": "Band Name",
    "thumbnail": "https://url.to.image/thumb.jpg",
    "duration_sec": 245
  }
]
```
*Note: Any item missing `id`, `title`, or `artists` may be discarded by the UI.*

### 2. `suggestions`
Triggered as the user types (autocomplete).
**Command:**
```bash
./your_plugin suggestions "Quer"
```
**Expected Output (`stdout`):**
A JSON array of strings or simple objects representing search autocomplete suggestions.
```json
[
  { "title": "Query Song", "artists": "Artist", "thumbnail": "" }
]
```

### 3. `download`
Triggered when a user clicks the "Add to Queue" button.
**Command:**
```bash
./your_plugin download "unique-song-id-1234" "/path/to/kraoq/raw_library"
```
**Expected Behavior:**
The plugin MUST download or generate an `.mp3` (the raw source audio) and an `.lrc` (standard lyrics file) and place them in the provided library path. **Both files must share the identical base filename.** (e.g. `Song123.mp3` and `Song123.lrc`).

**Expected Output (`stdout`):**
Upon success, print a JSON confirmation:
```json
{
  "mp3_path": "/path/to/kraoq/raw_library/Song123.mp3",
  "lrc_path": "/path/to/kraoq/raw_library/Song123.lrc",
  "title": "Song Title",
  "artist": "Band Name"
}
```

If the download fails, print a JSON object with an `error` key:
```json
{
  "error": "Failed due to regional block"
}
```

## How to Install a Plugin
1. Open KraoQ and go to **Settings**.
2. Locate the "Source Plugin Path" configuration.
3. Provide the absolute path to the executable. For python scripts, you may need to wrap it in a `.bat` or shell script that calls `python script.py "$@"` depending on the OS, or use an executable bundler.
4. Set the "Raw Library Hub" folder. The plugin will be instructed to save the downloaded mp3 and lrc files directly here. KraoQ will process them from this folder.
