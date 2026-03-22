import argparse
import sys
import re
import os
import subprocess
import tempfile

try:
    import stable_whisper
except ImportError:
    print("Error: stable-ts is not installed. Please install it using 'pip install stable-ts'.")
    sys.exit(1)

def parse_lrc(lrc_path):
    """Parses a standard LRC file into a list of dictionaries with time and text."""
    lines = []
    with open(lrc_path, 'r', encoding='utf-8') as f:
        for line in f:
            match = re.match(r'^\[(\d{2}:\d{2}\.\d{2,3})\](.*)$', line.strip())
            if match:
                timestamp_str, text = match.groups()
                parts = timestamp_str.split(':')
                seconds = int(parts[0]) * 60 + float(parts[1])
                text = text.strip()
                if text:
                    lines.append({
                        'timestamp_str': timestamp_str,
                        'time': seconds,
                        'text': text
                    })
    return lines

def format_timestamp(seconds):
    """Formats seconds into [mm:ss.xx] styled string, but for <tag>."""
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes:02d}:{secs:05.2f}"

def main():
    parser = argparse.ArgumentParser(description="Upgrade LRC to ELRC using stable-ts forced alignment.")
    parser.add_argument("audio_path", help="Path to the audio file (vocal preferred).")
    parser.add_argument("lrc_path", help="Path to the input standard .lrc file.")
    parser.add_argument("output_path", help="Path to the output .elrc file.")
    parser.add_argument("--model", default="base", help="Whisper model size (e.g. base, small, medium, large-v2).")
    parser.add_argument("--language", default="en", help="Language code (e.g., en).")
    
    args = parser.parse_args()
    
    # 1. Parse LRC
    lrc_lines = parse_lrc(args.lrc_path)
    if not lrc_lines:
        print(f"No valid LRC lines found in {args.lrc_path}. Exiting.")
        return
        
    # Pre-process audio with ffmpeg
    print(f"Pre-processing audio '{args.audio_path}' with ffmpeg...")
    temp_dir = tempfile.gettempdir()
    temp_wav = os.path.join(temp_dir, "temp_align_audio.wav")
    
    ffmpeg_cmd = [
        "ffmpeg", "-y", "-i", args.audio_path,
        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", temp_wav
    ]
    
    try:
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        print("Error: ffmpeg is not installed or not in PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error pre-processing audio with ffmpeg: {e}")
        sys.exit(1)

    # 2. Prepare segments for align_words
    print(f"Loading '{args.model}' model for word-level forced alignment...")
    model = stable_whisper.load_model(args.model)

    segments_input = []
    for i in range(len(lrc_lines)):
        original_line = lrc_lines[i]
        line_start = original_line['time']
        if i + 1 < len(lrc_lines):
            line_end = lrc_lines[i + 1]['time']
        else:
            # We can use a large max just in case OR attempt to get duration
            line_end = line_start + 60.0 # fallback
        segments_input.append({
            "start": line_start,
            "end": line_end,
            "text": original_line['text']
        })

    print(f"Aligning {len(segments_input)} segments to audio...")
    try:
        result = model.align_words(temp_wav, segments_input, language=args.language)
    finally:
        # Cleanup temp file
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
    
    # 3. Process output and generate ELRC
    elrc_lines = [""] * len(lrc_lines)
    for i in range(len(lrc_lines)):
        elrc_lines[i] = f"[{lrc_lines[i]['timestamp_str']}]"

    all_words = result.all_words()
    current_line_idx = 0
    
    for w in all_words:
        word_text = w.word.strip()
        if not word_text:
            continue
            
        # Advance line index if the word starts after the next line begins
        while current_line_idx + 1 < len(lrc_lines) and w.start >= lrc_lines[current_line_idx + 1]['time']:
            current_line_idx += 1
            
        start_str = format_timestamp(w.start)
        end_str = format_timestamp(w.end)
        
        elrc_lines[current_line_idx] += f" <{start_str}> {word_text} <{end_str}>"
        
    # 4. Save output
    print(f"Writing enhanced LRC to '{args.output_path}'")
    with open(args.output_path, 'w', encoding='utf-8') as f:
        for line in elrc_lines:
            f.write(line + "\n")

    print("Success! Created .elrc file.")

if __name__ == "__main__":
    main()
