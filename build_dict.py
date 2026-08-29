import json
import sqlite3
import re
import os

def stem_ru(word):
    word = word.lower().strip()
    endings = [
        'ующие', 'ующий', 'ующая', 'ующее',
        'вление', 'вления', 'аться', 'еться', 'иться', 'ться',
        'овать', 'евать', 'ировать',
        'ями', 'ами', 'ов', 'ей', 'ий', 'ые', 'ых', 'ым', 'ое', 'ая', 'яя', 'ее', 'ие',
        'ть', 'у', 'ю', 'а', 'я', 'о', 'е', 'и', 'ы', 'в', 'м', 'х', 'й', 'л'
    ]
    for e in endings:
        if word.endswith(e) and len(word) - len(e) >= 3:
            return word[:-len(e)]
    return word

def clean_and_stem_words(text):
    if not text: return set()
    text = text.lower().replace('ё', 'е').replace('i', 'ı')
    words_list = re.findall(r'[а-яa-z0-9ı\+I]+', text)
    return {stem_ru(w) for w in words_list}

def norm(s):
    if not s: return ''
    return s.strip().lower().replace('ё', 'е').replace('i', 'ı')

SYNONYMS = [
    {"мокрый", "влажный", "сырой"},
    {"вещество", "вещь", "затI"},
    {"размер", "количество", "величина"},
    {"хватка", "держать", "ловить", "поймать"},
    {"после", "потом", "затем"},
    {"знать", "узнавать", "изучать"},
    {"давать", "дадим", "дать"},
    {"говорить", "скажем", "сказать", "речь"},
    {"смерть", "гибель"},
    {"холодный", "прохладный"},
    {"девушка", "девочка"},
    {"время", "пора"}
]

def have_semantic_overlap(ru1, ru2):
    set1 = {norm(w) for w in re.findall(r'[а-яa-z0-9ı\+I]+', ru1.lower())}
    set2 = {norm(w) for w in re.findall(r'[а-яa-z0-9ı\+I]+', ru2.lower())}
    if set1.intersection(set2):
        return True
    stemmed1 = clean_and_stem_words(ru1)
    stemmed2 = clean_and_stem_words(ru2)
    if stemmed1.intersection(stemmed2):
        return True
    for syn_set in SYNONYMS:
        if any(w in set1 for w in syn_set) and any(w in set2 for w in syn_set):
            return True
    return False

SECTION_MAP = {
    'Глаголы': 'глаголы',
    'Деепричастия': 'глаголы',
    'Местоимения': 'местоимения',
    'Наречия': 'наречия',
    'Пословицы': 'фразы',
    'Причастия': 'глаголы',
    'Существительные': 'общее',
    'Топонимы': 'места',
    'Фонетические примеры': 'общее',
    'Числительные': 'числа'
}

def main():
    print("Запуск слияния словарей...")
    
    # 1. Загрузка основного словаря words.json
    words_file = 'words.json'
    if not os.path.exists(words_file):
        print(f"Ошибка: {words_file} не найден!")
        return
        
    with open(words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
    print(f"Загружено слов из {words_file}: {len(words)}")

    # 2. Подключение к mazin_dict_final.db и извлечение записей
    db_file = 'mazin_dict_final.db'
    if not os.path.exists(db_file):
        print(f"Ошибка: {db_file} не найден!")
        return
        
    conn = sqlite3.connect(db_file)
    db_rows = conn.execute(
        'SELECT id, lezgi, lezgi_lat, russian, mazin, mazin_lat, mazin_academic, mazin_academic_lat, section, page FROM dictionary'
    ).fetchall()
    print(f"Загружено строк из базы диалектов: {len(db_rows)}")

    # Группируем строки из БД по нормализованной форме стандартного лезгинского слова
    db_by_lz = {}
    for r in db_rows:
        lz_val = norm(r[1])
        if lz_val:
            db_by_lz.setdefault(lz_val, []).append(r)

    matched_ids = set() # id строк из БД, которые были сопоставлены со словами из words.json
    merged_count = 0

    # 3. Первый проход: дополняем существующие слова диалектом
    for w in words:
        wl_lz = norm(w.get('lz', ''))
        wl_ru = norm(w.get('ru', ''))
        
        lz_variants = [norm(v) for v in wl_lz.split('/') if norm(v)]
        
        best_match = None
        for lv in lz_variants:
            if lv in db_by_lz:
                for r in db_by_lz[lv]:
                    if have_semantic_overlap(wl_ru, r[3]):
                        best_match = r
                        break
                if best_match:
                    break
                    
        if best_match:
            # Сопоставление найдено! Добавляем диалектные поля
            w['mazin'] = best_match[4]
            w['mazin_lat'] = best_match[5]
            w['mazin_academic'] = best_match[6]
            w['mazin_academic_lat'] = best_match[7]
            w['mazin_ru'] = best_match[3] # сохраняем точный русский перевод из базы диалектов
            matched_ids.add(best_match[0])
            merged_count += 1

    print(f"Успешно объединено существующих слов: {merged_count}")

    # 4. Второй проход: добавляем несовпавшие слова из базы диалектов как новые словарные статьи
    new_words_count = 0
    for r in db_rows:
        db_id = r[0]
        if db_id in matched_ids:
            continue
            
        # Формируем новую словарную статью
        new_word = {
            'id': f'w_m_{db_id}',
            'lz': r[1],
            'ru': r[3],
            'cat': SECTION_MAP.get(r[8], 'общее'),
            'ex': '',
            'mazin': r[4],
            'mazin_lat': r[5],
            'mazin_academic': r[6],
            'mazin_academic_lat': r[7],
            'mazin_ru': r[3]
        }
        words.append(new_word)
        new_words_count += 1

    print(f"Добавлено новых слов из базы диалектов: {new_words_count}")
    print(f"Итоговое количество слов в объединенном словаре: {len(words)}")

    # 5. Сохранение копии словаря в JSON
    with open(words_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)
    print(f"Копия словаря сохранена в {words_file}")

    # 6. Запись всего словаря в основной SQLite файл базы данных words.db
    sqlite_db = 'words.db'
    if os.path.exists(sqlite_db):
        os.remove(sqlite_db) # удаляем старую бд для чистоты записи
        
    conn_out = sqlite3.connect(sqlite_db)
    cursor_out = conn_out.cursor()
    
    # Создаем таблицу основной БД
    cursor_out.execute('''
    CREATE TABLE words (
        id TEXT PRIMARY KEY,
        lz TEXT NOT NULL,
        ru TEXT NOT NULL,
        cat TEXT NOT NULL,
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
    
    from translit import transliterate
    # Вставляем данные
    for w in words:
        is_mazin = bool(w.get('mazin') or w.get('cat') == 'диалект' or w.get('id', '').startswith('w_m_'))
        w['lz_lat'] = transliterate(w.get('lz', ''), mazin=is_mazin)
        cursor_out.execute('''
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
        
    # Создаем индексы в основной БД для быстрого поиска
    cursor_out.execute('CREATE INDEX idx_words_lz ON words(lz)')
    cursor_out.execute('CREATE INDEX idx_words_ru ON words(ru)')
    cursor_out.execute('CREATE INDEX idx_words_cat ON words(cat)')
    cursor_out.execute('CREATE INDEX idx_words_mazin ON words(mazin)')
    cursor_out.execute('CREATE INDEX idx_words_lz_lat ON words(lz_lat)')
    
    conn_out.commit()
    conn_out.close()
    
    print(f"Основная база данных успешно создана в {sqlite_db}")

    # 7. Экспорт копии базы данных для разработчика в words.json
    with open(words_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)
    print(f"Копия для разработчика экспортирована в {words_file}")
    print("Сборка базы данных завершена успешно!")

if __name__ == '__main__':
    main()
