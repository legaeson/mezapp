#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sqlite3
import re
import os
import sys
from translit import transliterate

def clean_phonetic_lz(text):
    if not text:
        return text
    # Удаляем знаки кольца, дефисы разделения слогов в диалектной записи, специфические спирантные 'h' после согласных
    t = text.replace('˚', '').replace('-', '')
    t = re.sub(r'([КкТтПпЦцЧч])h', r'\1', t)
    t = re.sub(r'([а-яА-Я])h$', r'\1', t)
    return t.strip()

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Запуск консолидации диалектов и приведения к литературному стандарту...")

    with open('words.json', 'r', encoding='utf-8') as f:
        words = json.load(f)

    # Индексируем стандартные слова (не имеющие префикса w_m_)
    standard_by_ru = {}
    standard_by_lz = {}

    for w in words:
        if not w['id'].startswith('w_m_'):
            ru_key = w.get('ru', '').strip().lower()
            lz_key = w.get('lz', '').strip().lower()
            if ru_key:
                standard_by_ru.setdefault(ru_key, []).append(w)
            if lz_key:
                standard_by_lz.setdefault(lz_key, []).append(w)

    merged_count = 0
    cleaned_count = 0
    remaining_words = []

    for w in words:
        w_id = w['id']

        if w_id.startswith('w_m_'):
            ru_val = w.get('ru', '').strip().lower()
            lz_val = w.get('lz', '').strip().lower()

            # 1. Поиск совпадения со стандартным литературным словом
            matched_std = None
            if ru_val in standard_by_ru:
                for std in standard_by_ru[ru_val]:
                    # Проверяем схожесть по русскому переводу
                    matched_std = std
                    break

            if matched_std:
                # Переносим диалектную информацию в литературное слово, если у него её нет
                dialect_val = w.get('mazin') or w.get('lz')
                if dialect_val and not matched_std.get('mazin'):
                    matched_std['mazin'] = dialect_val
                    matched_std['mazin_lat'] = transliterate(dialect_val, mazin=True)
                    matched_std['mazin_ru'] = w.get('ru')

                merged_count += 1
                # Не добавляем дубликат w_m_ в итоговый массив
                continue

            # 2. Если слово w_m_ уникальное, проверяем не содержит ли lz диалектных знаков
            orig_lz = w.get('lz', '')
            if '˚' in orig_lz or 'h' in orig_lz or '-' in orig_lz:
                if not w.get('mazin'):
                    w['mazin'] = orig_lz
                    w['mazin_lat'] = transliterate(orig_lz, mazin=True)

                cleaned_lz = clean_phonetic_lz(orig_lz)
                w['lz'] = cleaned_lz
                cleaned_count += 1

        remaining_words.append(w)

    # Пересчитываем lz_lat для всех оставшихся слов
    for w in remaining_words:
        is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
        w['lz_lat'] = transliterate(w['lz'], mazin=is_mazin)

    print(f"[JSON] Объединено и удалено дубликатов: {merged_count}")
    print(f"[JSON] Очищено заголовков от диалектных знаков: {cleaned_count}")
    print(f"[JSON] Всего слов в итоговом словаре: {len(remaining_words)}")

    # Сохраняем words.json
    with open('words.json', 'w', encoding='utf-8') as f:
        json.dump(remaining_words, f, ensure_ascii=False, indent=2)

    # Пересобираем words.db
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

    for w in remaining_words:
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

    conn.commit()
    conn.close()
    print(f"[DB] Успешно пересобрана БД {db_path} ({len(remaining_words)} строк)")

if __name__ == '__main__':
    main()
