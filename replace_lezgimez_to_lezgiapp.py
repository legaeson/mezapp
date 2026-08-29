#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re

TARGET_DIR = '.'

# Перечень расширений для замены
EXTENSIONS = {'.html', '.js', '.json', '.txt', '.xml', '.php', '.bat', '.htaccess'}

def replace_in_file(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    new_content = content
    # 1. Точная замена основных написаний
    new_content = re.sub(r'LezgiMez', 'LezgiAPP', new_content)
    new_content = re.sub(r'Lezgimez', 'LezgiAPP', new_content)
    new_content = re.sub(r'lezgimez', 'lezgiapp', new_content)
    new_content = re.sub(r'LEZGIMEZ', 'LEZGIAPP', new_content)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Обновлен файл: {file_path}")

def main():
    print("Замена 'LezgiMez' на 'LezgiAPP' по всему проекту...")

    for root, dirs, files in os.walk(TARGET_DIR):
        if '.git' in root or '.system_generated' in root or 'brain' in root:
            continue
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXTENSIONS or file in {'.htaccess', 'robots.txt'}:
                full_path = os.path.join(root, file)
                replace_in_file(full_path)

    print("Замена завершена успешно!")

if __name__ == '__main__':
    main()
