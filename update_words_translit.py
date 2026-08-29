#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sqlite3
import os
import sys
from translit import transliterate

def main():
    print("Запуск наполнения поля lz_lat для всех слов...")

    json_path = 'words.json'
    db_path = 'words.db'

    if not os.path.exists(json_path):
        print(f"Ошибка: {json_path} не найден!")
        sys.exit(1)

    # 1. Обновление words.json
    with open(json_path, 'r', encoding='utf-8') as f:
        words = json.load(f)

    updated_count = 0
    for w in words:
        lz_text = w.get('lz', '')
        # Передаем mazin=True, если у слова есть диалектная метка
        is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
        w['lz_lat'] = transliterate(lz_text, mazin=is_mazin)
        updated_count += 1

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    print(f"[JSON] Успешно обновлено записей в {json_path}: {updated_count}")

    # 2. Обновление SQLite words.db
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Проверяем наличие колонки lz_lat
        cursor.execute("PRAGMA table_info(words)")
        cols = [c[1] for c in cursor.fetchall()]
        if 'lz_lat' not in cols:
            cursor.execute("ALTER TABLE words ADD COLUMN lz_lat TEXT")
            print("[DB] Добавлена новая колонка lz_lat в таблицу words.")

        db_updates = 0
        for w in words:
            word_id = w['id']
            lz_lat = w['lz_lat']
            cursor.execute("UPDATE words SET lz_lat = ? WHERE id = ?", (lz_lat, word_id))
            db_updates += cursor.rowcount

        conn.commit()
        conn.close()
        print(f"[DB] Успешно обновлено строк в {db_path}: {db_updates}")
    else:
        print(f"[DB] Предупреждение: {db_path} не найден.")

    print("[УСПЕХ] Транслитерация успешно заполнена во всех файлах данных!")

if __name__ == '__main__':
    main()
