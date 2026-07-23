#!/usr/bin/env python3
"""
PlateQ — PP-OCR ONNX Recognition Engine Model & Dictionary Exporter
====================================================================
Downloads the PP-OCR recognition ONNX model (ch_PP-OCRv4_rec.onnx)
and character dictionary into public/models/ for zero-latency local
browser inference via onnxruntime-web (WebGPU/WASM).
"""

import os
import sys
import urllib.request

MODELS_DIR = "public/models"
DICT_FILE = os.path.join(MODELS_DIR, "ppocr-dict.txt")
MODEL_FILE = os.path.join(MODELS_DIR, "ppocr-rec.onnx")

DICT_URL = "https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/ppocr/utils/ppocr_keys_v1.txt"
MODEL_URL = "https://huggingface.co/OleehyO/paddleocrv4.onnx/resolve/main/ch_PP-OCRv4_rec.onnx"

def main():
    print("=" * 65)
    print("  PlateQ — PP-OCR Recognition Engine Setup")
    print("=" * 65)

    os.makedirs(MODELS_DIR, exist_ok=True)

    # 1. Download Dictionary
    print("\n[1/2] Fetching character dictionary (ppocr_keys_v1.txt) ...")
    try:
        urllib.request.urlretrieve(DICT_URL, DICT_FILE)
        lines = len(open(DICT_FILE, encoding="utf-8").readlines())
        print(f"      Saved: {DICT_FILE} ({lines} characters)")
    except Exception as e:
        print(f"      Error fetching dictionary: {e}")
        sys.exit(1)

    # 2. Download ONNX Model
    print("\n[2/2] Fetching PP-OCRv4 Recognition ONNX Model ...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE)
        size_mb = os.path.getsize(MODEL_FILE) / 1024 / 1024
        print(f"      Saved: {MODEL_FILE} ({size_mb:.2f} MB)")
    except Exception as e:
        print(f"      Error fetching ONNX model: {e}")
        sys.exit(1)

    print(f"\n{'=' * 65}")
    print("  ✅ PP-OCR ONNX Recognition Engine setup complete!")
    print(f"  Model Path : {MODEL_FILE}")
    print(f"  Dict Path  : {DICT_FILE}")
    print(f"  Execution  : Browser ONNX Runtime Web (WebGPU -> WASM)")
    print(f"{'=' * 65}\n")

if __name__ == "__main__":
    main()
