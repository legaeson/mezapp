#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sqlite3
import re
import os
import sys
from translit import transliterate

def clean_neologism_text(text):
    if not text:
        return text
    # Удаляем пометки (неологизм), (неолог.), (адаптирование)
    t = re.sub(r'\s*\((?:неологизм|неолог\.|адаптирование)\)\s*', ' / ', text, flags=re.IGNORECASE)
    t = re.sub(r'\s*/\s*', ' / ', t)
    t = re.sub(r'\s+', ' ', t).strip(' /').strip()
    return t

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Запуск очистки пометок (неологизм) из словаря...")

    with open('words.json', 'r', encoding='utf-8') as f:
        words = json.load(f)

    cleaned_count = 0
    for w in words:
        orig_lz = w.get('lz', '')
        if re.search(r'неолог|адаптирование', orig_lz, re.IGNORECASE):
            new_lz = clean_neologism_text(orig_lz)
            w['lz'] = new_lz
            is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
            w['lz_lat'] = transliterate(new_lz, mazin=is_mazin)
            cleaned_count += 1
            print(f"Очищено {w['id']}: '{orig_lz}' -> '{new_lz}' (lz_lat: {w['lz_lat']})")

    print(f"[JSON] Всего очищено помет: {cleaned_count}")

    with open('words.json', 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    # Пересобираем основной файл БД SQLite words.db
    db_path = 'words.db'
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE words (
        id TEXT PRIMARY KEY,
        lz TEXT NOT NULL,
        ru TEXT NOT NULL,
        cat TEXT,
        ex TEXT,
        status TEXT,
        mazin TEXT,
        mazin_lat TEXT,
        mazin_academic TEXT,
        mazin_academic_lat TEXT,
        mazin_ru TEXT,
        lz_lat TEXT
    )
    ''')

    for w in words:
        cursor.execute('''
        INSERT INTO words (id, lz, ru, cat, ex, status, mazin, mazin_lat, mazin_academic, mazin_academic_lat, mazin_ru, lz_lat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            w.get('id'),
            w.get('lz'),
            w.get('ru'),
            w.get('cat'),
            w.get('ex', ''),
            w.get('status'),
            w.get('mazin'),
            w.get('mazin_lat'),
            w.get('mazin_academic'),
            w.get('mazin_academic_lat'),
            w.get('mazin_ru'),
            w.get('lz_lat')
        ))

    cursor.execute('CREATE INDEX idx_words_lz ON words(lz)')
    cursor.execute('CREATE INDEX idx_words_ru ON words(ru)')
    cursor.execute('CREATE INDEX idx_words_cat ON words(cat)')
    cursor.execute('CREATE INDEX idx_words_mazin ON words(mazin)')
    cursor.execute('CREATE INDEX idx_words_lz_lat ON words(lz_lat)')

    conn.commit()
    conn.close()
    print(f"[DB] Основная база данных {db_path} пересобрана ({len(words)} строк).")

if __name__ == '__main__':
    main()
