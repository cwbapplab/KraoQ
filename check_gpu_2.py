import onnxruntime as ort
import os
import sys

def check():
    providers = ort.get_available_providers()
    print(f"PROVIDERS: {providers}")
    
    # Try to see if we can get device details
    for provider in providers:
        try:
            options = ort.get_provider_options()
            if provider in options:
                print(f"OPTIONS for {provider}: {options[provider]}")
        except:
            pass

if __name__ == "__main__":
    check()
