#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sqlite3
import os
import sys
from translit import transliterate

PROVERB_MAPPING = [
    ('w_m_93', 'w23_khleb'),       # Хлеб (Фу)
    ('w_m_96', 'w2180_glupets'),   # Глупец (Ахмакь)
    ('w_m_122', 'w1390_schaste'),  # Счастье (Бахт)
    ('w_m_151', 'w124_rodina'),    # Родина (Ватан)
    ('w_m_165', 'w129_med'),       # Мед (Вирт)
    ('w_m_267', 'w1374_osel'),     # Осел (Лам)
    ('w_m_268', 'w1379_pokoy'),    # Покой (Рагьатвал)
    ('w_m_345', 'w15_mat'),        # Мать (Диде)
    ('w_m_391', 'w382_trud'),      # Труд (Зегьмет)
    ('w_m_417', 'w700_muzhchina'), # Мужчина (Итим)
    ('w_m_511', 'w28_rabota'),     # Работа (КIвалах)
    ('w_m_538', 'w1641_postel'),   # Постель (Мес)
    ('w_m_548', 'w3046_plov'),     # Плов (Аш)
    ('w_m_556', 'w28_rabota'),     # Работа (КIвалах)
    ('w_m_658', 'w95_yazyk'),      # Язык (ЧIал)
    ('w_m_746', 'w203_zhivot'),    # Живот (Руфун)
]

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Запуск переноса пословиц в свойства примеров (ex)...")

    with open('words.json', 'r', encoding='utf-8') as f:
        words = json.load(f)

    words_by_id = {w['id']: w for w in words}
    removed_ids = set()

    for proverb_id, target_id in PROVERB_MAPPING:
        p_item = words_by_id.get(proverb_id)
        t_item = words_by_id.get(target_id)

        if p_item and t_item:
            ex_str = f"{p_item['lz']} | {p_item['ru']}"
            if t_item.get('ex'):
                t_item['ex'] = t_item['ex'] + " // " + ex_str
            else:
                t_item['ex'] = ex_str

            removed_ids.add(proverb_id)
            print(f"Пословица '{p_item['lz']}' перенесена в слово '{t_item['lz']}' ({t_item['id']})")

    final_words = [w for w in words if w['id'] not in removed_ids]

    # Обновляем lz_lat для всех оставшихся элементов
    for w in final_words:
        is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
        w['lz_lat'] = transliterate(w['lz'], mazin=is_mazin)

    print(f"[JSON] Удалено отделяемых пословиц из главного списка: {len(removed_ids)}")
    print(f"[JSON] Итоговое количество слов в словаре: {len(final_words)}")

    with open('words.json', 'w', encoding='utf-8') as f:
        json.dump(final_words, f, ensure_ascii=False, indent=2)

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

    cursor.execute('CREATE INDEX idx_words_lz ON words(lz)')
    cursor.execute('CREATE INDEX idx_words_ru ON words(ru)')
    cursor.execute('CREATE INDEX idx_words_cat ON words(cat)')
    cursor.execute('CREATE INDEX idx_words_mazin ON words(mazin)')
    cursor.execute('CREATE INDEX idx_words_lz_lat ON words(lz_lat)')

    conn.commit()
    conn.close()
    print(f"[DB] Основная база данных {db_path} пересобрана ({len(final_words)} строк).")

if __name__ == '__main__':
    main()
