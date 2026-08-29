import json
import sqlite3
import sys

def verify():
    print("Запуск проверки целостности данных...")
    
    # 1. Проверяем words.json
    try:
        with open('words.json', 'r', encoding='utf-8') as f:
            words = json.load(f)
        print(f"[JSON] Файл прочитан. Всего записей: {len(words)}")
    except Exception as e:
        print(f"[JSON] Ошибка чтения words.json: {e}")
        sys.exit(1)
        
    # 2. Проверяем SQLite words.db
    try:
        conn = sqlite3.connect('words.db')
        cursor = conn.cursor()
        
        # Проверяем структуру таблицы
        cursor.execute("PRAGMA table_info(words)")
        columns = {c[1]: c[2] for c in cursor.fetchall()}
        expected_cols = {'id', 'lz', 'ru', 'cat', 'ex', 'status', 'mazin', 'mazin_lat', 'mazin_academic', 'mazin_academic_lat', 'mazin_ru', 'lz_lat'}
        missing = expected_cols - set(columns.keys())
        if missing:
            print(f"[DB] Ошибка: отсутствуют колонки в БД: {missing}")
            sys.exit(1)
        print(f"[DB] Структура таблицы верна.")
        
        # Проверяем количество строк
        cursor.execute("SELECT count(*) FROM words")
        db_count = cursor.fetchone()[0]
        print(f"[DB] Всего строк в БД: {db_count}")
        
        if len(words) != db_count:
            print(f"[КРИТИЧЕСКИ] Несовпадение количества записей: JSON ({len(words)}) != DB ({db_count})")
            sys.exit(1)
        else:
            print("[УСПЕХ] Количество записей совпадает.")
            
        # 3. Проверяем наличие транслитерации lz_lat
        cursor.execute("SELECT id, lz, lz_lat FROM words WHERE lz_lat IS NOT NULL AND lz_lat != '' LIMIT 3")
        rows = cursor.fetchall()
        if not rows:
            print("[Ошибка] Поле lz_lat пустое в БД!")
            sys.exit(1)
        print("[Тест наличия lz_lat в БД]:")
        for r in rows:
            print(f"  ID={r[0]}, lz={r[1]} -> lz_lat={r[2]}")
            
        # Проверяем новое добавленное слово из диалектов
        cursor.execute("SELECT id, lz, ru, mazin FROM words WHERE id LIKE 'w_m_%' LIMIT 3")
        new_rows = cursor.fetchall()
        print("[Тест новых слов из БД]:")
        for nr in new_rows:
            print(f"  ID={nr[0]}, lz={nr[1]}, ru={nr[2]}, mazin={nr[3]}")
            
    except Exception as e:
        print(f"[DB] Ошибка при работе с БД: {e}")
        sys.exit(1)
    finally:
        conn.close()
        
    print("[УСПЕХ] Все тесты проверки пройдены!")

if __name__ == '__main__':
    verify()
