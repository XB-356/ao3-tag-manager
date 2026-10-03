"""找出 i18n 词典里的重复键（后面的会覆盖前面，容易埋坑）。"""
import io
import os
import re
import sys

PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "lib", "i18n.js"))
with io.open(PATH, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if line.strip() == "const PHRASES = {":
        start = i
    elif start is not None and line.strip() == "};":
        end = i
        break

dups = []
seen = {}
for i in range(start + 1, end):
    match = re.match(r"\s*'((?:[^'\\]|\\.)*)':", lines[i])
    if not match:
        continue
    key = match.group(1)
    if key in seen:
        dups.append((key, seen[key] + 1, i + 1))
    else:
        seen[key] = i

print("重复键:", len(dups))
for key, first, second in dups:
    print("  %-28s 首次第 %d 行，重复第 %d 行" % (key, first, second))

# 一致性：键值都不为空
bad = []
for i in range(start + 1, end):
    match = re.match(r"\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'", lines[i])
    if lines[i].strip() and not match and not lines[i].strip().startswith("//"):
        bad.append(i + 1)
print("格式异常行:", bad)

sys.exit(1 if dups or bad else 0)
