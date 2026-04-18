import sys
import json
import os

# Ensure the plugin directory is in the sys.path so we can import our modules
plugin_dir = os.path.dirname(os.path.abspath(__file__))
if plugin_dir not in sys.path:
    sys.path.insert(0, plugin_dir)

def search(query):
    try:
        import search as search_module
        # search_module directly prints to stdout. We can just call it by passing the modified sys.argv
        sys.argv = ['search.py', query]
        search_module.search_music(query)
    except Exception as e:
        print(json.dumps({"error": str(e)}))

def suggestions(query):
    try:
        import suggestions as suggestions_module
        sys.argv = ['suggestions.py', query]
        suggestions_module.get_suggestions(query)
    except Exception as e:
        print(json.dumps({"error": str(e)}))

def download(video_id, output_dir):
    try:
        import download_pipeline
        # download_pipeline prepares and outputs json to stdout
        download_pipeline.download_and_process(video_id, output_dir)
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
        
    cmd = sys.argv[1]
    
    if cmd == "search":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "No query provided for search"}))
            sys.exit(1)
        search(sys.argv[2])
        
    elif cmd == "suggestions":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "No query provided for suggestions"}))
            sys.exit(1)
        suggestions(sys.argv[2])
        
    elif cmd == "download":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Missing video_id or output_dir for download"}))
            sys.exit(1)
        download(sys.argv[2], sys.argv[3])
        
    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
        sys.exit(1)
