import sys
import os
import json
import requests
import yt_dlp
from mutagen.easyid3 import EasyID3

def log_debug(msg):
    sys.stderr.write(f"[DEBUG] {msg}\n")
    sys.stderr.flush()

def get_lyrics(artist, title, duration_sec):
    log_debug(f"Fetching from LRCLIB: Artist='{artist}', Title='{title}', Duration={duration_sec}")
    """
    Try to fetch lyrics from LRCLIB.
    First tries a direct 'get' query. If that fails, tries a 'search'.
    """
    base_url = "https://lrclib.net/api"
    
    # Cleaning up title for better search (removing (Official Video), etc)
    clean_title = title.replace("(Official Video)", "").replace("(Official Audio)", "").replace("(Audio)", "").strip()
    
    # 1. Try specific GET (requires precise matching usually, but good to try)
    params = {
        'artist_name': artist,
        'track_name': clean_title,
        'duration': int(duration_sec)
    }
    
    try:
        log_debug(f"LRCLIB: Attempting direct GET: {params}")
        response = requests.get(f"{base_url}/get", params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('syncedLyrics'):
                log_debug("LRCLIB: Found synced lyrics via direct GET")
                return data['syncedLyrics']
    except Exception as e:
        log_debug(f"LRCLIB: GET failed: {e}")
        pass # Fallback to search

    # 2. Try SEARCH
    try:
        search_params = {
            'q': f"{artist} {clean_title}"
        }
        log_debug(f"LRCLIB: Attempting SEARCH: {search_params}")
        response = requests.get(f"{base_url}/search", params=search_params, timeout=10)
        if response.status_code == 200:
            results = response.json()
            # Filter results by duration similarity (within +/- 3 seconds)
            for item in results:
                if item.get('syncedLyrics') and abs(item['duration'] - duration_sec) < 5:
                    log_debug(f"LRCLIB: Found match in search (ID: {item.get('id')}, Duration Diff: {abs(item['duration'] - duration_sec)}s)")
                    return item['syncedLyrics']
                else:
                    log_debug(f"LRCLIB: skipped result {item.get('trackName')} (diff: {abs(item['duration'] - duration_sec)})")
    except Exception as e:
        log_debug(f"LRCLIB: Search failed: {e}")
        pass

    log_debug("LRCLIB: No lyrics found")
    return None

def download_and_process(video_id, output_dir):
    log_debug(f"Starting pipeline for VideoID: {video_id}")
    url = f"https://music.youtube.com/watch?v={video_id}"
    
    # Prepare filename template
    # We use video_id to avoid collision
    output_template = os.path.join(output_dir, f"%(title)s-{video_id}.%(ext)s")
    
    # Point to the ffmpeg executable in the UVR installation
    ffmpeg_location = r".\AppData\Local\Programs\Ultimate Vocal Remover\ffmpeg.exe"

    class MyLogger(object):
        def debug(self, msg):
            pass
        def warning(self, msg):
            pass
        def error(self, msg):
            log_debug(f"yt-dlp ERROR: {msg}")

    ydl_opts = {
        'format': 'bestaudio/best',
        'ffmpeg_location': ffmpeg_location,
        'writesubtitles': True,
        'subtitlesformat': 'lrc',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }, {
            'key': 'FFmpegSubtitlesConvertor',
            'format': 'lrc',
        }],
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'logger': MyLogger(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            log_debug("yt-dlp: Starting download...")
            info = ydl.extract_info(url, download=True)
            log_debug("yt-dlp: Download complete")
            
            # Extract metadata
            artist = info.get('artist') or info.get('uploader', '')
            if isinstance(artist, list): artist = ", ".join(artist)
            title = info.get('track') or info.get('title', '')
            duration = info.get('duration', 0)
            
            filename = ydl.prepare_filename(info)
            final_mp3_path = filename.rsplit('.', 1)[0] + '.mp3'
            
            log_debug(f"Metadata: Artist={artist}, Title={title}, MP3={final_mp3_path}")

            # Check if yt-dlp downloaded and converted a subtitle to LRC
            # Filename format creates: Title-ID.mp3
            # Subtitle usually: Title-ID.en.lrc or similar
            base_name = os.path.splitext(os.path.basename(final_mp3_path))[0]
            downloaded_lrc_path = None
            
            # Search for any .lrc file that starts with the base name
            log_debug("Checking for yt-dlp downloaded LRC files...")
            for f in os.listdir(output_dir):
                if f.startswith(base_name) and f.endswith(".lrc"):
                    downloaded_lrc_path = os.path.join(output_dir, f)
                    log_debug(f"Found YouTube LRC: {f}")
                    break
            
            if downloaded_lrc_path:
                log_debug("Using YouTube provided lyrics.")
                print(json.dumps({
                    "mp3_path": final_mp3_path,
                    "lrc_path": downloaded_lrc_path,
                    "title": title,
                    "artist": artist,
                    "source": "yt-dlp"
                }))
                return

            # Fallback: LRCLIB
            log_debug("No YouTube LRC found. Falling back to LRCLIB...")
            lyrics = get_lyrics(artist, title, duration)
            
            if not lyrics:
                # Cleanup if we fail completely
                if os.path.exists(final_mp3_path):
                    os.remove(final_mp3_path)
                print(json.dumps({"error": f"Lyrics not available for {artist} - {title}"}))
                sys.exit(1)
            
            # Save LRC from LRCLIB
            lrc_filename = base_name + ".lrc"
            lrc_path = os.path.join(output_dir, lrc_filename)
            
            with open(lrc_path, "w", encoding="utf-8") as f:
                f.write(lyrics)
                
            print(json.dumps({
                "mp3_path": final_mp3_path,
                "lrc_path": lrc_path,
                "title": title,
                "artist": artist,
                "source": "lrclib"
            }))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: script.py <video_id> <output_dir>"}))
        sys.exit(1)
        
    video_id = sys.argv[1]
    output_dir = sys.argv[2]
    
    download_and_process(video_id, output_dir)
