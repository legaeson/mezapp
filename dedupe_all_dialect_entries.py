#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sqlite3
import os
import sys
from translit import transliterate

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Запуск полной чистки и объединения дубликатов по русскому переводу...")

    with open('words.json', 'r', encoding='utf-8') as f:
        words = json.load(f)

    # 1. Формируем группу по русскому переводу
    ru_map = {}
    for w in words:
        ru = w.get('ru', '').strip().lower()
        if ru:
            ru_map.setdefault(ru, []).append(w)

    to_remove_ids = set()

    for ru, group in ru_map.items():
        if len(group) > 1:
            # Находим идеальное литературное слово (приоритет у не-w_m_ записей или записей без диалектных букв)
            best_literary = None
            for item in group:
                if not item['id'].startswith('w_m_'):
                    best_literary = item
                    break

            # Если все в группе w_m_, выбираем то, у которого lz более стандартное (например, Цири для черемши)
            if not best_literary:
                # Специальная обработка для черемши: Цири (w_m_958) превосходит Журуь (w_m_362)
                for item in group:
                    if item['lz'] == 'Цири':
                        best_literary = item
                        break
                if not best_literary:
                    best_literary = group[0]

            # Объединяем диалектную информацию из других вариантов в best_literary
            for item in group:
                if item['id'] == best_literary['id']:
                    continue

                dialect_val = item.get('mazin') or item.get('lz')
                if dialect_val and dialect_val != best_literary['lz'] and not best_literary.get('mazin'):
                    best_literary['mazin'] = dialect_val
                    best_literary['mazin_lat'] = transliterate(dialect_val, mazin=True)

                to_remove_ids.add(item['id'])

    final_words = [w for w in words if w['id'] not in to_remove_ids]

    # Обновляем lz_lat для всех оставшихся элементов
    for w in final_words:
        is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
        w['lz_lat'] = transliterate(w['lz'], mazin=is_mazin)

    print(f"Удалено дублирующих вариантов: {len(to_remove_ids)}")
    print(f"Итоговое количество слов: {len(final_words)}")

    with open('words.json', 'w', encoding='utf-8') as f:
        json.dump(final_words, f, ensure_ascii=False, indent=2)

    # Обновляем SQLite words.db
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

    for w in final_words:
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
    print(f"[DB] База данных {db_path} пересобрана ({len(final_words)} строк).")

if __name__ == '__main__':
    main()
