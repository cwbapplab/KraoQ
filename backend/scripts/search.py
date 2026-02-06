import concurrent.futures
import json
import sys
from ytmusicapi import YTMusic

def check_yt_lyrics(yt_instance, video_id):
    """
    Check if YT Music has lyrics for this video.
    Returns True if a lyrics BrowseID matches.
    """
    try:
        watch = yt_instance.get_watch_playlist(videoId=video_id)
        if watch and watch.get('lyrics'):
            return True
    except:
        return False
    return False

def search_music(query):
    try:
        yt = YTMusic()
        # Search for songs to get specific track metadata
        results = yt.search(query, filter='songs')
        
        # Helper to parse duration string "MM:SS" to seconds
        def dur_to_sec(dur_str):
            if not dur_str: return 0
            parts = dur_str.split(':')
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            return 0

        # Pre-process details
        items_to_process = []
        for item in results: 
            if item['resultType'] == 'song':
                artist_name = ", ".join([artist['name'] for artist in item['artists']])
                title = item['title']
                duration_str = item.get('duration', '0:00')
                duration_sec = dur_to_sec(duration_str)
                
                obj = {
                    'videoId': item['videoId'],
                    'title': title,
                    'artists': artist_name,
                    'album': item['album']['name'] if item.get('album') else "Single",
                    'duration': duration_str,
                    'duration_sec': duration_sec,
                    'thumbnail': item['thumbnails'][-1]['url'] if item.get('thumbnails') else "",
                    'hasLyrics': False 
                }
                items_to_process.append(obj)

        # Check lyrics for top 10 items using YTMusic metadata
        # We need a new instance per thread or share one? YTMusic is stateless-ish but uses requests.
        # Ideally share one, but let's init inside or pass it. 
        # Using one instance might be thread-unsafe depending on internals, lets make it simple.
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # We pass the video_id. check_yt_lyrics will use a closure or new instance?
            # Passing 'yt' might be okay if session is threadsafe. `requests.Session` is usually thread-safe.
            future_to_item = {
                executor.submit(check_yt_lyrics, yt, item['videoId']): item 
                for item in items_to_process[:10]
            }
            
            for future in concurrent.futures.as_completed(future_to_item):
                item = future_to_item[future]
                try:
                    if future.result():
                        item['hasLyrics'] = True
                except:
                    pass

        # Sort: Has Lyrics first
        items_to_process.sort(key=lambda x: x['hasLyrics'], reverse=True)
        
        print(json.dumps(items_to_process))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)
    
    query = " ".join(sys.argv[1:])
    search_music(query)
