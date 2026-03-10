import json
import sys
from ytmusicapi import YTMusic

def get_suggestions(query):
    try:
        yt = YTMusic()
        results = yt.search(query, filter='songs', limit=5)
        
        def dur_to_sec(dur_str):
            if not dur_str: return 0
            parts = dur_str.split(':')
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            return 0

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
        
        print(json.dumps(items_to_process))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)
    
    query = " ".join(sys.argv[1:])
    get_suggestions(query)
