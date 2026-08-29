import json
import sqlite3
import sys

def fix():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    with open('words.json', 'r', encoding='utf-8') as f:
        words = json.load(f)

    count = 0
    for w in words:
        if w.get('mazin') == 'В слове':
            w.pop('mazin', None)
            w.pop('mazin_lat', None)
            w.pop('mazin_academic', None)
            w.pop('mazin_academic_lat', None)
            w.pop('mazin_ru', None)
            count += 1
            print(f"Очищена запись {w['id']}: {w['lz']}")

    with open('words.json', 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    conn = sqlite3.connect('words.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE words SET mazin=NULL, mazin_lat=NULL, mazin_academic=NULL, mazin_academic_lat=NULL, mazin_ru=NULL WHERE mazin='В слове'")
    print(f"Обновлено строк в БД: {cursor.rowcount}")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    fix()
