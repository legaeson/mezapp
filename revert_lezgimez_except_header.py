#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys

TARGET_DIR = '.'
EXTENSIONS = {'.html', '.js', '.json', '.txt', '.xml', '.php', '.bat', '.htaccess'}

def replace_in_file(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    new_content = content
    new_content = re.sub(r'LezgiAPP', 'LezgiMez', new_content)
    new_content = re.sub(r'Lezgiapp', 'LezgiMez', new_content)
    new_content = re.sub(r'lezgiapp', 'lezgimez', new_content)
    new_content = re.sub(r'LEZGIAPP', 'LEZGIMEZ', new_content)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Восстановлено имя LezgiMez в файле: {file_path}")

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Возврат основного имени проекта на LezgiMez...")

    for root, dirs, files in os.walk(TARGET_DIR):
        if '.git' in root or '.system_generated' in root or 'brain' in root:
            continue
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXTENSIONS or file in {'.htaccess', 'robots.txt'}:
                full_path = os.path.join(root, file)
                replace_in_file(full_path)

    # Задаем логотип LezgiAPP β в шапке index.html (десктоп сидебар и мобильная шапка)
    index_path = 'index.html'
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            idx_content = f.read()

        # Заменяем только контейнеры с логотипом в шапке на LezgiAPP β
        updated_idx = re.sub(
            r'(<span class="font-bold text-2xl tracking-tighter">)LezgiMez( <span class="text-emerald-500">β</span></span>)',
            r'\1LezgiAPP\2',
            idx_content
        )

        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(updated_idx)
        print("В шапке index.html установлен логотип LezgiAPP β.")

    print("Операция завершена!")

if __name__ == '__main__':
    main()
