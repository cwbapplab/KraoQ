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
                # We keep the line even if text is empty, to correctly mark end-of-phrase boundaries
                lines.append({
                    'timestamp_str': timestamp_str,
                    'time': seconds,
                    'text': text.strip()
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
        
        # 2.1 Debug: Save Whisper's raw word detections
        out_dir = os.path.dirname(args.output_path)
        debug_path = os.path.join(out_dir, "whisper_align_debug.txt") if out_dir else "whisper_align_debug.txt"
        print(f"Writing Whisper debug info to '{debug_path}'")
        with open(debug_path, 'w', encoding='utf-8') as df:
            df.write("=== Whisper Raw Word Alignment Debug ===\n\n")
            for i, segment in enumerate(result.segments):
                target_text = segments_input[i]['text'] if i < len(segments_input) else "???"
                df.write(f"Line {i+1} Target: {target_text}\n")
                if hasattr(segment, 'words'):
                    for w in segment.words:
                        df.write(f"  [{format_timestamp(w.start)} -> {format_timestamp(w.end)}] {w.word}\n")
                else:
                    df.write("  (No words detected for this segment)\n")
                df.write("-" * 40 + "\n")
    finally:
        # Cleanup temp file
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
    
    # 3. Process output and generate ELRC
    output_elrc_lines = []
    
    # Get a flat list of all words detected by Whisper
    all_detected_words = result.all_words()
    # Pointer to track our position in the global word list
    global_word_ptr = 0

    def normalize(text):
        return re.sub(r'[^\w]', '', text).lower()

    for i, original_line in enumerate(lrc_lines):
        timestamp_str = original_line['timestamp_str']
        line_content = f"[{timestamp_str}]"
        
        line_start = original_line['time']
        line_end = lrc_lines[i+1]['time'] if i+1 < len(lrc_lines) else line_start + 600.0
        
        # Preserve original words exactly as they appear in the LRC
        original_text = original_line['text']
        original_words = original_text.split()
        
        if not original_words:
            output_elrc_lines.append(line_content)
            continue

        # We look for the words in a window around the LRC phrase (1s before, 4s after to catch late detections)
        window_start = line_start - 1.0
        window_end = line_end + 4.0
        
        # Collect candidates for this phrase from the global list
        # We start searching from global_word_ptr to maintain chronological order
        phrase_candidates = []
        temp_ptr = global_word_ptr
        while temp_ptr < len(all_detected_words):
            w = all_detected_words[temp_ptr]
            if w.start > window_end:
                break
            if w.start >= window_start:
                phrase_candidates.append((w, temp_ptr))
            temp_ptr += 1
            
        last_end_time = line_start
        cand_idx = 0 # Local index in phrase_candidates
        
        for j, ow in enumerate(original_words):
            ow_norm = normalize(ow)
            s_time = last_end_time
            e_time = last_end_time
            
            # Try to find a match in the candidates
            match_found = False
            # Search a small window of candidates to find the best match for the current word
            for k in range(cand_idx, min(cand_idx + 8, len(phrase_candidates))):
                cw, global_idx = phrase_candidates[k]
                cw_norm = normalize(cw.word)
                
                if ow_norm and cw_norm and (ow_norm in cw_norm or cw_norm in ow_norm):
                    s_time = cw.start
                    e_time = cw.end
                    cand_idx = k + 1
                    # Update global pointer to avoid reusing matched words
                    global_word_ptr = max(global_word_ptr, global_idx + 1)
                    match_found = True
                    break
            
            if not match_found:
                # Word missing in Whisper's window. 
                # Fill gap between last_end_time and the next available detection or line end.
                s_time = last_end_time
                if cand_idx < len(phrase_candidates):
                    e_time = phrase_candidates[cand_idx][0].start
                else:
                    e_time = line_end
            
            # ENFORCE BOUNDARIES: Timings must stay within the LRC phrase boundaries
            s_time = max(line_start, min(line_end, s_time))
            e_time = max(line_start, min(line_end, e_time))

            # Sanity check: Ensure times are strictly non-decreasing and non-overlapping
            s_time = max(s_time, last_end_time)
            if e_time < s_time:
                e_time = s_time + 0.01
            
            start_str = format_timestamp(s_time)
            end_str = format_timestamp(e_time)
            line_content += f" <{start_str}> {ow} <{end_str}>"
            last_end_time = e_time
            
        output_elrc_lines.append(line_content)
        
    # 4. Save output
    print(f"Writing enhanced LRC to '{args.output_path}'")
    with open(args.output_path, 'w', encoding='utf-8') as f:
        for line in output_elrc_lines:
            f.write(line + "\n")

    print("Success! Created .elrc file.")

if __name__ == "__main__":
    main()
