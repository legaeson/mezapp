#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import re

# Пробуем подключить pyperclip для автоматического копирования в буфер обмена
try:
    import pyperclip
    HAS_CLIPBOARD = True
except ImportError:
    HAS_CLIPBOARD = False


VOWELS_AND_SIGNS = set("аеёиоуыэюяАЕЁИОУЫЭЮЯъьЪЬaeyioɨuAEYIOƗUāǣĀǢæœəÆŒƏ")


def replace_ya(text: str) -> str:
    if not text:
        return text

    res = []
    for i, char in enumerate(text):
        if char in ('я', 'Я'):
            prev_idx = i - 1
            while prev_idx >= 0 and text[prev_idx] in ('Ӏ', 'ӏ', "'", "1"):
                prev_idx -= 1

            if prev_idx < 0:
                prev_char = ''
            else:
                prev_char = text[prev_idx]

            if not prev_char or not prev_char.isalpha() or prev_char in VOWELS_AND_SIGNS:
                res.append('Ja' if char == 'Я' else 'ja')
            else:
                res.append('Æ' if char == 'Я' else 'æ')
        else:
            res.append(char)
    return "".join(res)


def cyrillic_to_latin(text: str) -> str:
    if not text:
        return text

    # 1. Нормализуем варианты палочек (I, l, 1, Ӏ) после смычных согласных
    text = re.sub(r'(?i)(?<=[кптцчх])[I1l!|]', 'Ӏ', text)

    # 2. Буква «Й»: всегда -> 'j' / 'J'
    text = text.replace('й', 'j').replace('Й', 'J')

    # 3. Позиционная замена «Я»:
    # В начале слова, после гласных и знаков -> ja / Ja
    # После согласных -> æ / Æ
    text = replace_ya(text)

    # 4. Полный словарь подстановок (по убыванию длины)
    mapping = [
        ("чӀ", "ch'"), ("ЧӀ", "Ch'"), ("ЧӀ", "CH'"),
        ("дж", "dzh"), ("Дж", "Dzh"), ("ДЖ", "DZH"),
        ("дз", "dz"),  ("Дз", "Dz"),  ("ДЗ", "DZ"),
        ("цӀ", "c'"),  ("ЦӀ", "C'"),  ("ЦӀ", "C'"),
        ("кӀ", "k'"),  ("КӀ", "K'"),  ("КӀ", "K'"),
        ("пӀ", "p'"),  ("ПӀ", "P'"),  ("ПӀ", "P'"),
        ("тӀ", "t'"),  ("ТӀ", "T'"),  ("ТӀ", "T'"),
        ("кь", "q'"),  ("Кь", "Q'"),  ("КЬ", "Q'"),
        ("къ", "q"),   ("Къ", "Q"),   ("КЪ", "Q"),
        ("хъ", "qh"),  ("Хъ", "Qh"),  ("ХЪ", "QH"),
        ("гъ", "gh"),  ("Гъ", "Gh"),  ("ГЪ", "GH"),
        ("гь", "h"),   ("Гь", "H"),   ("ГЬ", "H"),
        ("хӀ", "h"),   ("ХӀ", "H"),   ("ХӀ", "H"),
        ("хь", "h"),   ("Хь", "H"),   ("ХЬ", "H"),

        ("аь", "æ"),   ("Аь", "Æ"),   ("АЬ", "Æ"),
        ("оь", "œ"),   ("Оь", "Œ"),   ("ОЬ", "Œ"),
        ("уь", "y"),   ("Уь", "Y"),   ("УЬ", "Y"),

        ("ч", "ch"),   ("Ч", "Ch"),
        ("ш", "sh"),   ("Ш", "Sh"),
        ("ж", "zh"),   ("Ж", "Zh"),
        ("щ", "shch"), ("Щ", "Shch"),

        ("ю", "ju"),   ("Ю", "Ju"),
        ("ё", "jo"),   ("Ё", "Jo"),

        ("а", "a"), ("А", "A"),
        ("б", "b"), ("Б", "B"),
        ("в", "w"), ("В", "W"),
        ("г", "g"), ("Г", "G"),
        ("д", "d"), ("Д", "D"),
        ("е", "e"), ("Е", "E"),
        ("э", "e"), ("Э", "E"),
        ("з", "z"), ("З", "Z"),
        ("и", "i"), ("И", "I"),
        ("к", "k"), ("К", "K"),
        ("л", "l"), ("Л", "L"),
        ("м", "m"), ("М", "M"),
        ("н", "n"), ("Н", "N"),
        ("о", "o"), ("О", "O"),
        ("п", "p"), ("П", "P"),
        ("р", "r"), ("Р", "R"),
        ("с", "s"), ("С", "S"),
        ("т", "t"), ("Т", "T"),
        ("у", "u"), ("У", "U"),
        ("ф", "f"), ("Ф", "F"),
        ("х", "x"), ("Х", "X"),
        ("ц", "c"), ("Ц", "C"),
        ("ы", "ə"), ("Ы", "Ə"),

        ("ъ", ""),  ("Ъ", ""),
        ("ь", ""),  ("Ь", ""),
        ("Ӏ", "")
    ]

    for cyr, lat in mapping:
        text = text.replace(cyr, lat)

    return text


def transliterate(text: str, mazin: bool = False) -> str:
    """Совместимая функция транслитерации для использования другими скриптами и модулями."""
    return cyrillic_to_latin(text)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = sys.argv[1:]
    if args:
        # Режим прямой передачи текста через аргументы командной строки
        text = " ".join(args)
        print(cyrillic_to_latin(text))
        return

    print("=" * 60)
    print("        ТРАНСЛИТЕРАТОР (КИРИЛЛИЦА -> ЛАТИНИЦА)")
    print("=" * 60)
    print("Инструкция:")
    print(" 1. Вставьте любой текст (можно многострочный).")
    print(" 2. Нажмите Enter, затем комбинацию:")
    print("    • Windows: Ctrl + Z, затем Enter")
    print("    • Mac / Linux: Ctrl + D")
    print("    (Или просто введите слово 'END' с новой строки)")
    print(" 3. Для выхода нажмите Ctrl + C")
    print("=" * 60 + "\n")

    while True:
        print(">>> Вставьте текст ниже:")
        lines = []
        try:
            while True:
                line = sys.stdin.readline()
                if not line:  # Сигнал конца файла (Ctrl+D / Ctrl+Z)
                    break
                if line.strip() == "END":
                    break
                lines.append(line)
        except KeyboardInterrupt:
            print("\nВыход из программы. До свидания!")
            break

        input_text = "".join(lines)
        if not input_text.strip():
            print("Текст не был введен.\n")
            continue

        result = cyrillic_to_latin(input_text)

        print("\n" + "-" * 25 + " РЕЗУЛЬТАТ " + "-" * 25)
        print(result)
        print("-" * 61)

        # Копирование в буфер
        if HAS_CLIPBOARD:
            try:
                pyperclip.copy(result)
                print(" Текст автоматически скопирован в буфер обмена (Ctrl+V)!\n")
            except Exception:
                print(" Не удалось записать в буфер обмена. Скопируйте текст вручную.\n")
        else:
            print(" (Подсказка: установите 'pip install pyperclip', чтобы текст копировался сам)\n")

        print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
